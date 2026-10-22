'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { canPerformAction, recordAction, safeClick, dismissOverlays } = require('../utils/sessionBehavior');
const { generatePostContent } = require('../ai/promoter');
const { generateVisualDiagram } = require('./visualGenerator');
const logger = require('../utils/logger');

const BUSINESS_SUITE_ASSET_ID = '1137934072744765';
const BUSINESS_SUITE_ID = '1687520913385551';
const COMPOSER_URL = `https://business.facebook.com/latest/composer?asset_id=${BUSINESS_SUITE_ASSET_ID}&business_id=${BUSINESS_SUITE_ID}`;
const INBOX_URL = `https://business.facebook.com/latest/inbox/all?asset_id=${BUSINESS_SUITE_ASSET_ID}&business_id=${BUSINESS_SUITE_ID}`;

/**
 * Publish simultaneously to Facebook Page and Instagram via Meta Business Suite.
 *
 * @param {Object} [opts={}]
 * @returns {Promise<Object>}
 */
async function createBusinessSuitePost(opts = {}) {
  logger.info('[BusinessSuite] Launching unified Facebook + Instagram cross-publish on Meta Business Suite...');

  if (!canPerformAction('post')) {
    logger.warn('[DailyLimit] Daily limit reached for "post". Skipping Business Suite post.');
    return { success: false, action: 'daily_limit', message: 'Daily limit reached for posts.' };
  }

  const promoLink = opts.promoLink || 'https://hexnemesis.com/home.html';
  const postText = opts.text || await generatePostContent({
    promoLink,
    topic: opts.topic || 'construction master layout calculators, rafter birdsmouth angles, and precision cabinetry math',
  });

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await page.goto(COMPOSER_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 5000);
    await dismissOverlays(page);

    // Verify we're on the Business Suite Composer
    const pageTitle = await page.title();
    if (!pageTitle.toLowerCase().includes('business suite')) {
      logger.warn(`Unexpected title on Business Suite: "${pageTitle}"`);
    }

    // 1. Locate text editor area
    const editorSelectors = [
      'div[role="combobox"][contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="dialogue box" i]',
      'div[contenteditable="true"]',
      'textarea',
    ];

    let editor = null;
    let matchedSelector = null;
    for (const sel of editorSelectors) {
      editor = await page.$(sel);
      if (editor && await editor.isVisible().catch(() => false)) {
        matchedSelector = sel;
        break;
      }
    }

    if (!editor) {
      throw new Error('Business Suite Composer text editor not found.');
    }

    await editor.click();
    await randomDelay(500, 1200);
    await humanType(page, matchedSelector || editor, postText);
    await randomDelay(1500, 3000);

    // 2. Attach visual architectural blueprint diagram
    let attachedImage = null;
    if (opts.attachDiagram !== false) {
      try {
        const diagramTypes = ['rafter', 'stairs', 'cabinetry'];
        const chosenType = opts.diagramType || diagramTypes[Math.floor(Math.random() * diagramTypes.length)];
        const imagePath = opts.imagePath || await generateVisualDiagram(chosenType);

        if (imagePath && fs.existsSync(imagePath)) {
          // Look for "Add photo/video" or upload button
          const addPhotoBtn = await page.$('div[role="button"]:has-text("Add photo/video"), button:has-text("Add photo/video"), div[role="button"]:has-text("Add photo")');
          if (addPhotoBtn) {
            await addPhotoBtn.click();
            await randomDelay(1000, 2000);

            // Click "Upload from desktop" option if opened in a popup menu
            const uploadOption = await page.$('div[role="menuitem"]:has-text("Upload from desktop"), span:has-text("Upload from desktop")');
            if (uploadOption) {
              await uploadOption.click();
              await randomDelay(1000, 2000);
            }
          }

          // Locate file input
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.setInputFiles(imagePath);
            attachedImage = imagePath;
            logger.info(`[BusinessSuite] ✓ Attached blueprint visual: ${imagePath}`);
            await randomDelay(4000, 7000); // Wait for image upload to process
          }
        }
      } catch (attachErr) {
        logger.warn(`[BusinessSuite] Failed to attach visual: ${attachErr.message}`);
      }
    }

    // 3. Find and click "Publish"
    const publishSelectors = [
      'button:has-text("Publish")',
      'div[role="button"]:has-text("Publish")',
      'div[aria-label="Publish"][role="button"]',
    ];

    let publishBtn = null;
    for (const sel of publishSelectors) {
      publishBtn = await page.$(sel);
      if (publishBtn && await publishBtn.isVisible().catch(() => false)) break;
    }

    if (!publishBtn) {
      throw new Error('Business Suite Publish button not found.');
    }

    logger.info('[BusinessSuite] Clicking "Publish" button...');
    await safeClick(page, publishBtn);
    await randomDelay(5000, 9000); // Wait for publishing roundtrip

    await saveCookies(context, { asPage: true });
    recordAction('post');

    logger.info('[BusinessSuite] ✓ Successfully cross-published to Facebook Page & Instagram via Meta Business Suite!');
    return {
      success: true,
      action: 'business_suite_posted',
      text: postText,
      attachedImage,
      platforms: ['facebook_page', 'instagram'],
    };

  } catch (err) {
    logger.error(`[BusinessSuite] createBusinessSuitePost error: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

/**
 * Check the unified Meta Business Suite inbox for incoming leads, messages, and comments.
 *
 * @returns {Promise<Object>}
 */
async function checkBusinessSuiteInbox() {
  logger.info('[BusinessSuite] Checking Unified Inbox (Facebook + Instagram)...');

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await page.goto(INBOX_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 6000);
    await dismissOverlays(page);

    logger.info(`[BusinessSuite] Unified Inbox active: ${page.url()}`);
    // Extract unread threads count if visible
    const unreadCount = await page.$$eval('[aria-label*="unread" i], span:has-text("unread")', els => els.length).catch(() => 0);

    await saveCookies(context, { asPage: true });
    return { success: true, action: 'business_suite_inbox_checked', unreadThreads: unreadCount };

  } catch (err) {
    logger.error(`[BusinessSuite] checkBusinessSuiteInbox error: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

module.exports = {
  createBusinessSuitePost,
  checkBusinessSuiteInbox,
  COMPOSER_URL,
  INBOX_URL,
};
