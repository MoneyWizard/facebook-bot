'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, randomScroll } = require('../utils/humanBehavior');
const logger = require('../utils/logger');
const { config } = require('../config');

const FB_BASE = 'https://www.facebook.com';

/**
 * Scrape a Facebook profile by URL or username.
 *
 * @param {string} urlOrUsername  Full URL or FB username (e.g. "zuck" or "https://facebook.com/zuck")
 * @returns {Promise<Object>} Scraped profile data
 */
async function scrapeProfile(urlOrUsername) {
  const profileUrl = urlOrUsername.startsWith('http')
    ? urlOrUsername
    : `${FB_BASE}/${urlOrUsername}`;

  logger.info(`Scraping profile: ${profileUrl}`);

  const browser = await launchBrowser();
  const context = await createContext(browser);
  const page = await context.newPage();

  // Block unnecessary resources to reduce fingerprint surface + speed up
  await page.route('**/*.{mp4,avi,mov,wmv,flv}', (r) => r.abort());

  try {
    await loadCookies(context);

    // Navigate to profile
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(1500, 3000);

    // Handle cookie consent banner if present
    await dismissCookieBanner(page);

    // Check if we hit a login wall
    const isLoginWall = await page.$('[data-testid="royal_login_form"]') !== null ||
      await page.$('form[action="/login/"]') !== null;

    if (isLoginWall) {
      logger.warn('Hit Facebook login wall — load cookies from a logged-in session for full access.');
    }

    // Simulate human behavior
    await simulateMouseMove(page);
    await randomScroll(page);
    await randomDelay();

    // ── Extract profile data ──────────────────────────────────────────────
    const profile = await page.evaluate((maxPosts) => {
      const getText = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.innerText.trim() : null;
      };

      const getAllText = (sel) =>
        Array.from(document.querySelectorAll(sel)).map((el) => el.innerText.trim());

      // Name — try multiple selectors (FB changes these often)
      const name =
        document.querySelector('h1')?.innerText?.trim() ||
        document.querySelector('[data-testid="profile_name_in_profile_page"]')?.innerText?.trim() ||
        null;

      // Bio / Intro
      const bio =
        document.querySelector('[data-testid="profile_intro_card_bio"]')?.innerText?.trim() ||
        document.querySelector('div[dir="auto"] > div[dir="auto"]')?.innerText?.trim() ||
        null;

      // Avatar
      const avatarEl = document.querySelector('image[xlink\\:href]') ||
        document.querySelector('img[data-imgperflogname="profileCoverPhoto"]');
      const avatarUrl = avatarEl?.getAttribute('xlink:href') || avatarEl?.src || null;

      // Work, Education, Location — scraped from the intro section
      const introItems = Array.from(
        document.querySelectorAll('[data-pagelet="ProfileTilesFeed_0"] span, [data-testid="profile_intro_card_bio"] ~ div span')
      ).map((el) => el.innerText.trim()).filter(Boolean);

      // Attempt to extract location and hometown from intro text
      const locationEl = document.querySelector('[data-testid="profile_intro_card_locations"]');
      const location = locationEl ? locationEl.innerText.trim() : null;

      // Posts — collect visible post text
      const postEls = Array.from(document.querySelectorAll(
        '[data-testid="post_message"], div[data-ad-preview="message"]'
      )).slice(0, maxPosts);
      const posts = postEls.map((el) => ({
        text: el.innerText.trim().slice(0, 500),
        timestamp: null, // timestamps require deeper parsing
      })).filter((p) => p.text.length > 0);

      return { name, bio, location, avatarUrl, introItems, posts };
    }, config.scraping.maxPosts);

    // More scrolling to load additional posts
    for (let i = 0; i < 2; i++) {
      await randomScroll(page);
      await randomDelay(1500, 3000);
    }

    // Save refreshed cookies
    await saveCookies(context);

    const result = {
      url: profileUrl,
      username: extractUsername(profileUrl),
      name: profile.name,
      bio: profile.bio,
      location: profile.location,
      hometown: null,
      work: [],
      education: [],
      posts: profile.posts,
      avatarUrl: profile.avatarUrl,
      introItems: profile.introItems,
      scrapedAt: new Date().toISOString(),
    };

    logger.info(`Profile scraped: ${result.name || 'Unknown'} — ${result.posts.length} posts found`);
    return result;

  } catch (err) {
    logger.error(`Profile scrape failed for ${profileUrl}: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function dismissCookieBanner(page) {
  try {
    // Try to click "Allow all cookies" or "Accept" buttons
    const selectors = [
      '[data-cookiebanner="accept_button"]',
      'button[title="Allow all cookies"]',
      'button:has-text("Accept All")',
      'button:has-text("Allow essential and optional cookies")',
    ];
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await randomDelay(500, 1200);
        break;
      }
    }
  } catch {
    // Non-fatal
  }
}

function extractUsername(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, '').split('?')[0] || null;
  } catch {
    return null;
  }
}

module.exports = { scrapeProfile };
