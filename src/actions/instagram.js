'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { canPerformAction, recordAction } = require('../utils/sessionBehavior');
const { generateComment } = require('../ai/promoter');
const { recordLead } = require('../crm/leadExporter');
const logger = require('../utils/logger');

const IG_COOKIE_PATH = path.resolve('./cookies/ig_session.json');

/**
 * Load saved Instagram cookies if present, plus Facebook cookies for SSO login.
 */
async function loadIgSession(context) {
  await loadCookies(context, { asPage: false });
  if (fs.existsSync(IG_COOKIE_PATH)) {
    try {
      const igCookies = JSON.parse(fs.readFileSync(IG_COOKIE_PATH, 'utf8'));
      if (Array.isArray(igCookies) && igCookies.length > 0) {
        await context.addCookies(igCookies);
        logger.info(`[Instagram] Loaded ${igCookies.length} cached Instagram cookies`);
      }
    } catch (err) {
      logger.debug(`[Instagram] Could not load cached IG cookies: ${err.message}`);
    }
  }
}

/**
 * Save active Instagram cookies to disk so subsequent runs stay logged in.
 */
async function saveIgSession(context) {
  try {
    const allCookies = await context.cookies('https://www.instagram.com');
    if (allCookies && allCookies.length > 0) {
      fs.writeFileSync(IG_COOKIE_PATH, JSON.stringify(allCookies, null, 2));
      logger.info(`[Instagram] Saved ${allCookies.length} Instagram cookies to ${IG_COOKIE_PATH}`);
    }
  } catch (err) {
    logger.debug(`[Instagram] Failed to save IG cookies: ${err.message}`);
  }
}

/**
 * Ensure Instagram is authenticated via the linked Facebook account SSO.
 */
async function ensureInstagramLogin(page) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await randomDelay(2500, 4500);

  // Dismiss cookie consent if shown
  const cookieBtns = [
    'button:has-text("Allow all cookies")',
    'button:has-text("Accept All")',
    'button:has-text("Allow essential and optional cookies")',
  ];
  for (const sel of cookieBtns) {
    const btn = await page.$(sel).catch(() => null);
    if (btn) {
      await btn.click({ force: true }).catch(() => {});
      await randomDelay(1500, 2500);
      break;
    }
  }

  // Check if we see a "Continue as ..." or "Log in with Facebook" button
  const fbSsoSelectors = [
    'button:has-text("Continue as")',
    'button:has-text("Log in with Facebook")',
    'span:has-text("Log in with Facebook")',
    'div[role="button"]:has-text("Continue as")',
    'div[role="button"]:has-text("Log in with Facebook")',
  ];

  for (const sel of fbSsoSelectors) {
    const ssoBtn = await page.$(sel).catch(() => null);
    if (ssoBtn && await ssoBtn.isVisible().catch(() => false)) {
      logger.info(`[Instagram] Clicking linked Facebook SSO button: ${sel}`);
      await ssoBtn.click({ force: true }).catch(() => {});
      await randomDelay(4000, 7000);

      // If redirected to facebook.com/login/ or oauth confirmation dialog, click Continue
      if (page.url().includes('facebook.com')) {
        const fbContinueSels = [
          'div[aria-label*="Continue as" i]',
          'div[role="button"]:has-text("Continue as")',
          'button[name="__CONFIRM__"]',
          'button:has-text("Continue")',
        ];
        for (const cSel of fbContinueSels) {
          const cBtn = await page.$(cSel).catch(() => null);
          if (cBtn) {
            logger.info('[Instagram] Confirming Facebook -> Instagram OAuth handshake');
            await cBtn.click({ force: true }).catch(() => {});
            await randomDelay(4000, 7000);
            break;
          }
        }
      }
      break;
    }
  }

  // Dismiss "Turn on Notifications" or "Save Your Login Info?" modals
  const dismissModals = [
    'button:has-text("Save Info")',
    'button:has-text("Not Now")',
    'div[role="button"]:has-text("Not now")',
  ];
  for (const sel of dismissModals) {
    const btn = await page.$(sel).catch(() => null);
    if (btn && await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
      await randomDelay(1000, 2000);
    }
  }
}

/**
 * Autonomously discover, like, follow, and comment on contractor/carpenter posts on Instagram.
 *
 * @param {string} hashtagOrUrl - Hashtag (e.g. "framingcontractor") or full Instagram URL
 * @param {Object} [opts={}]
 * @returns {Promise<Object>}
 */
async function engageInstagram(hashtagOrUrl = 'carpenter', opts = {}) {
  const cleanTag = hashtagOrUrl
    .replace(/^https?:\/\/(www\.)?instagram\.com\/explore\/tags\//i, '')
    .replace(/^#/, '')
    .replace(/\/$/, '')
    .trim() || 'carpenter';

  const targetUrl = hashtagOrUrl.startsWith('http')
    ? hashtagOrUrl
    : `https://www.instagram.com/explore/tags/${encodeURIComponent(cleanTag)}/`;

  const promoLink = opts.promoLink || 'https://hexnemesis.com/home.html';

  logger.info(`[Instagram] Launching autonomous outreach on: ${targetUrl}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadIgSession(context);
    await ensureInstagramLogin(page);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 5000);
    await simulateMouseMove(page);

    // Find post/reel links on hashtag or explore page
    const postLinks = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (els) =>
      Array.from(new Set(els.map(e => e.href))).slice(0, 6)
    ).catch(() => []);

    if (!postLinks.length) {
      logger.warn(`[Instagram] No posts found at ${targetUrl} (login wall or empty tag).`);
      await saveIgSession(context);
      return { success: false, action: 'no_posts_found', targetUrl, message: 'No Instagram posts accessible on page.' };
    }

    // Pick a random top post/reel to engage with
    const chosenPost = postLinks[Math.floor(Math.random() * Math.min(postLinks.length, 4))];
    logger.info(`[Instagram] Engaging contractor post: ${chosenPost}`);

    await page.goto(chosenPost, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2500, 4500);

    // Extract author handle if visible (skip root '/' and system nav paths)
    const authorHandle = await page.$$eval('header a[href^="/"], article a[href^="/"], a[role="link"][href^="/"]', (els) => {
      const reserved = new Set(['explore', 'reels', 'direct', 'accounts', 'p', 'reel', 'stories', 'about', 'legal']);
      for (const el of els) {
        const raw = (el.getAttribute('href') || '').split('?')[0];
        const parts = raw.split('/').filter(Boolean);
        if (parts.length === 1 && !reserved.has(parts[0].toLowerCase())) {
          return parts[0].trim();
        }
      }
      return '';
    }).catch(() => '') || `ig_${cleanTag}_builder`;

    const authorUrl = `https://www.instagram.com/${authorHandle}/`;

    // Record discovered Instagram contractor into CRM spreadsheet
    recordLead({
      name: `@${authorHandle} (Instagram)`,
      url: authorUrl,
      location: `IG #${cleanTag}`,
      bio: `Discovered via Instagram #${cleanTag} (${chosenPost})`,
      status: 'IG Engaged',
    });

    let liked = false;
    let followed = false;
    let commented = false;

    // 1. Like the post
    if (canPerformAction('like')) {
      const likeSvg = await page.$('svg[aria-label="Like"][height="24"], span svg[aria-label="Like"]').catch(() => null);
      if (likeSvg) {
        await likeSvg.click({ force: true }).catch(() => {});
        recordAction('like');
        liked = true;
        logger.info(`[Instagram] ✓ Liked post ${chosenPost}`);
        await randomDelay(1200, 2500);
      }
    }

    // 2. Follow the builder
    if (canPerformAction('follow')) {
      const followBtn = await page.$('header button:has-text("Follow"), div[role="button"]:has-text("Follow")').catch(() => null);
      if (followBtn) {
        const txt = (await followBtn.innerText().catch(() => '')).trim();
        if (txt === 'Follow') {
          await followBtn.click({ force: true }).catch(() => {});
          recordAction('follow');
          followed = true;
          logger.info(`[Instagram] ✓ Followed @${authorHandle}`);
          await randomDelay(1500, 3000);
        }
      }
    }

    // 3. Leave AI-generated comment if comment box is available
    if (canPerformAction('comment')) {
      const commentInputSelector = 'textarea[aria-label*="Add a comment" i], textarea[placeholder*="Add a comment" i]';
      const commentBox = await page.$(commentInputSelector).catch(() => null);
      if (commentBox) {
        const captionText = await page.$eval('h1', el => el.innerText).catch(() => `Great ${cleanTag} craftsmanship and layout work!`);
        const commentText = await generateComment(captionText, promoLink);
        if (commentText) {
          await commentBox.click({ force: true }).catch(() => {});
          await microDelay(300, 700);
          await humanType(page, commentInputSelector, commentText);
          await randomDelay(1000, 2000);

          const postCommentBtn = await page.$('div[role="button"]:has-text("Post"), button:has-text("Post")').catch(() => null);
          if (postCommentBtn) {
            await postCommentBtn.click({ force: true }).catch(() => {});
            await randomDelay(2500, 4500);
            recordAction('comment');
            commented = true;
            logger.info(`[Instagram] ✓ Posted AI comment on ${chosenPost}`);
          }
        }
      }
    }

    await saveIgSession(context);
    await saveCookies(context, { asPage: false });

    return {
      success: true,
      action: 'ig_engaged',
      postUrl: chosenPost,
      authorHandle,
      liked,
      followed,
      commented,
    };

  } catch (err) {
    logger.error(`[Instagram] engageInstagram error: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

module.exports = { engageInstagram, ensureInstagramLogin };
