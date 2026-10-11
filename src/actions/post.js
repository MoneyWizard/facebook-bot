'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { warmupSession, canPerformAction, recordAction } = require('../utils/sessionBehavior');
const { generatePostContent } = require('../ai/promoter');
const logger = require('../utils/logger');

/**
 * Create a new post on your Facebook timeline or a target Group/Page.
 *
 * @param {Object} opts
 * @param {string} [opts.targetUrl="https://www.facebook.com/"] - Target page, group, or home feed
 * @param {string} [opts.text] - Post text (if omitted, AI generates content promoting hexnemesis.com)
 * @param {string} [opts.promoLink="https://hexnemesis.com"] - Promo link if auto-generating text
 * @returns {Promise<Object>} { success, action, message }
 */
async function createPost(opts = {}) {
  const targetUrl = opts.targetUrl || 'https://www.facebook.com/';
  const promoLink = opts.promoLink || 'https://hexnemesis.com/home.html';
  const isPagePost = Boolean(opts.asPage) ||
    targetUrl.includes('61588703994992') ||
    targetUrl.toLowerCase().includes('hexnemesis');

  logger.info(`[Action] Create Post on ${targetUrl} (asPage: ${isPagePost})`);

  if (!canPerformAction('post')) {
    return { success: false, action: 'daily_limit', message: 'Daily posting limit reached.' };
  }

  // Generate text via AI if not provided
  let postText = opts.text;
  if (!postText) {
    postText = await generatePostContent({ link: promoLink, topic: opts.topic, tone: opts.tone });
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context, { asPage: isPagePost });
    if (!hasCookies) {
      return { success: false, action: 'no_session', message: 'Load session cookies first.' };
    }

    await warmupSession(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(2000, 4500);
    await dismissCookieBanner(page);

    await simulateMouseMove(page);
    await randomDelay(1000, 2500);

    // If Facebook displays a "Switch to HexNemesis Productions" button or prompt, click it
    if (isPagePost) {
      await handlePageSwitchPrompt(page);
    }

    // Look for the "What's on your mind?" create post box (Personal or Page)
    const createPostSelectors = [
      'div[role="button"]:has-text("What\'s on your mind")',
      'span:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("Create a public post")',
      'div[role="button"]:has-text("Write something...")',
      'span:has-text("Write something...")',
      'div[role="button"]:has-text("Create a post")',
      'div[role="button"]:has-text("Create post")',
      'div[aria-label*="Create a post" i]',
      'div[aria-label*="Write a post" i]',
      'div[aria-label*="What\'s on your mind" i]',
    ];

    let createBox = null;
    for (const sel of createPostSelectors) {
      createBox = await page.$(sel);
      if (createBox) break;
    }

    if (!createBox) {
      logger.warn('Create post box not found on page.');
      return { success: false, action: 'not_found', message: 'Could not find post creation box.' };
    }

    await createPostBoxClick(page, createBox);
    await randomDelay(2000, 3500);

    // Locate the active text area in the post modal
    const inputSelector = 'div[role="dialog"] div[contenteditable="true"], div[role="dialog"] div[aria-label*="What\'s on your mind" i], div[role="dialog"] div[aria-label*="Create a post" i], div[role="dialog"] div[aria-label*="Write something" i]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });

    // Type post text using human typing delays
    await humanType(page, inputSelector, postText);
    await randomDelay(2500, 4500);

    // Find and click "Post" button
    const postBtnSelectors = [
      'div[role="dialog"] div[aria-label="Post"]',
      'div[role="dialog"] div[role="button"]:has-text("Post")',
      'div[role="dialog"] button:has-text("Post")',
      'div[role="dialog"] div[aria-label*="Post" i][role="button"]',
    ];

    let postBtn = null;
    for (const sel of postBtnSelectors) {
      postBtn = await page.$(sel);
      if (postBtn) break;
    }

    if (!postBtn) {
      return { success: false, action: 'not_found', message: 'Post submit button not found.' };
    }

    try {
      await postBtn.click({ timeout: 8000 });
    } catch {
      try {
        await postBtn.click({ force: true, timeout: 5000 });
      } catch {
        await page.evaluate(el => el.click(), postBtn);
      }
    }

    await randomDelay(4000, 8000); // Wait for post upload to complete

    await saveCookies(context, { asPage: isPagePost });
    recordAction('post');

    logger.info(`✓ Post successfully created on ${targetUrl} (asPage: ${isPagePost})`);
    return { success: true, action: 'posted', message: 'Post created successfully.', text: postText, targetUrl, isPagePost };

  } catch (err) {
    logger.error(`createPost failed: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

async function createPostBoxClick(page, element) {
  try {
    await element.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await microDelay(200, 500);
    await element.click({ timeout: 5000 });
  } catch (err) {
    logger.debug(`Standard click failed, falling back to force click: ${err.message}`);
    try {
      await element.click({ force: true, timeout: 5000 });
    } catch {
      await page.evaluate(el => el.click(), element);
    }
  }
}

async function handlePageSwitchPrompt(page) {
  const switchSelectors = [
    'div[aria-label*="Switch to" i]',
    'div[role="button"]:has-text("Switch Now")',
    'div[role="button"]:has-text("Switch now")',
    'div[role="button"]:has-text("Use Page")',
    'div[role="button"]:has-text("Switch")',
    'span:has-text("Switch now")',
    'span:has-text("Use Page")',
  ];
  for (const sel of switchSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        logger.info(`[Action] Clicking Page switch prompt: ${sel}`);
        await btn.click({ force: true });
        await randomDelay(2000, 4000);
        break;
      }
    } catch {}
  }
}

async function dismissCookieBanner(page) {
  try {
    const sels = ['[data-cookiebanner="accept_button"]', 'button[title="Allow all cookies"]'];
    for (const s of sels) { const b = await page.$(s); if (b) { await b.click(); break; } }
  } catch {}
}

module.exports = { createPost };
