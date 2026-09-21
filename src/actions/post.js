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
  const promoLink = opts.promoLink || 'https://hexnemesis.com';

  logger.info(`[Action] Create Post on ${targetUrl}`);

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
    const hasCookies = await loadCookies(context);
    if (!hasCookies) {
      return { success: false, action: 'no_session', message: 'Load session cookies first.' };
    }

    await warmupSession(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);
    await dismissCookieBanner(page);

    await simulateMouseMove(page);
    await randomDelay(1000, 2500);

    // Look for the "What's on your mind?" create post box
    const createPostSelectors = [
      'div[role="button"]:has-text("What\'s on your mind")',
      'span:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("Create a public post")',
      'div[role="button"]:has-text("Write something...")',
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
    await randomDelay(1500, 3000);

    // Locate the active text area in the post modal
    const inputSelector = 'div[role="dialog"] div[contenteditable="true"], div[role="dialog"] div[aria-label*="What\'s on your mind"]';
    await page.waitForSelector(inputSelector, { timeout: 10000 });

    // Type post text using human typing delays
    await humanType(page, inputSelector, postText);
    await randomDelay(2000, 4000);

    // Find and click "Post" button
    const postBtnSelectors = [
      'div[role="dialog"] div[aria-label="Post"]',
      'div[role="dialog"] div[role="button"]:has-text("Post")',
      'div[role="dialog"] button:has-text("Post")',
    ];

    let postBtn = null;
    for (const sel of postBtnSelectors) {
      postBtn = await page.$(sel);
      if (postBtn) break;
    }

    if (!postBtn) {
      return { success: false, action: 'not_found', message: 'Post submit button not found.' };
    }

    await postBtn.click();
    await randomDelay(4000, 8000); // Wait for post upload to complete

    await saveCookies(context);
    recordAction('post');

    logger.info(`✓ Post successfully created on ${targetUrl}`);
    return { success: true, action: 'posted', message: 'Post created successfully.', text: postText, targetUrl };

  } catch (err) {
    logger.error(`createPost failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function createPostBoxClick(page, element) {
  await element.scrollIntoViewIfNeeded();
  await microDelay(200, 500);
  await element.click();
}

async function dismissCookieBanner(page) {
  try {
    const sels = ['[data-cookiebanner="accept_button"]', 'button[title="Allow all cookies"]'];
    for (const s of sels) { const b = await page.$(s); if (b) { await b.click(); break; } }
  } catch {}
}

module.exports = { createPost };
