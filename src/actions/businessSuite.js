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
    const currentUrl = page.url();
    logger.info(`[BusinessSuite] Arrived at: ${currentUrl} (Title: "${pageTitle}")`);
    if (!pageTitle.toLowerCase().includes('business suite')) {
      logger.warn(`Unexpected title on Business Suite: "${pageTitle}"`);
    }

    // 1. Locate text editor area (wait for React SPA to mount)
    const combinedEditorSelector = 'div[data-lexical-editor="true"], div[role="textbox"], div[contenteditable="true"], textarea';
    await page.waitForSelector(combinedEditorSelector, { timeout: 30000 }).catch(() => {});

    // Ensure Facebook and Instagram placements are enabled in the Share To section
    try {
      const placementArea = await page.$('span[data-surface*="share_to" i], div[aria-label*="share to" i], div:has-text("Share to")');
      if (placementArea) {
        const placementCheckboxes = await placementArea.$$('div[role="checkbox"], input[type="checkbox"]');
        for (const cb of placementCheckboxes) {
          const isChecked = (await cb.getAttribute('aria-checked')) === 'true' || await cb.isChecked().catch(() => false);
          if (!isChecked) {
            await cb.click().catch(() => {});
            logger.info('[BusinessSuite] Enabled Share-to placement checkbox');
            await page.waitForTimeout(300);
          }
        }
      }
    } catch {}

    // Dismiss any open dropdown popovers or modals
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    await dismissOverlays(page);

    const editorSelectors = [
      'div[data-lexical-editor="true"]',
      'div[contenteditable="true"][aria-label*="dialogue box" i]',
      'div[contenteditable="true"][aria-label*="text" i]',
      'div[contenteditable="true"][aria-label*="what\'s on your mind" i]',
      'div[role="textbox"][contenteditable="true"]',
      'div[role="textbox"]',
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
      const debugScreenshot = path.resolve('logs/business-suite-debug.png');
      await page.screenshot({ path: debugScreenshot, fullPage: true }).catch(() => {});
      logger.error(`[BusinessSuite] Composer text editor not found. Saved debug screenshot to ${debugScreenshot}`);
      throw new Error(`Business Suite Composer text editor not found. (URL: ${currentUrl})`);
    }

    logger.info(`[BusinessSuite] Editor focused via "${matchedSelector || 'element'}"`);
    await safeClick(page, editor);
    await editor.evaluate(el => el.focus()).catch(() => {});
    await randomDelay(800, 1500);
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
          let attached = false;

          // Strategy A: Direct file input already in DOM
          const existingInput = await page.$('input[type="file"]');
          if (existingInput) {
            try {
              await existingInput.setInputFiles(imagePath);
              attached = true;
            } catch {}
          }

          // Strategy B: File chooser triggered via Add Photo button
          if (!attached) {
            const addPhotoBtn = await page.$(
              'div[role="button"]:has-text("Add photo"), button:has-text("Add photo"), ' +
              'div[role="button"]:has-text("Add media"), button:has-text("Add media"), ' +
              'div[aria-label*="Add photo" i], div:has-text("Add photo")'
            );

            if (addPhotoBtn) {
              try {
                const [fileChooser] = await Promise.all([
                  page.waitForEvent('filechooser', { timeout: 4000 }),
                  safeClick(page, addPhotoBtn),
                ]);
                await fileChooser.setFiles(imagePath);
                attached = true;
              } catch {
                // If it opened a menu instead of direct file chooser, click "Upload from desktop"
                const uploadOption = await page.$('div[role="menuitem"]:has-text("Upload"), span:has-text("Upload"), div:has-text("Upload from desktop")');
                if (uploadOption) {
                  try {
                    const [fileChooser] = await Promise.all([
                      page.waitForEvent('filechooser', { timeout: 4000 }),
                      safeClick(page, uploadOption),
                    ]);
                    await fileChooser.setFiles(imagePath);
                    attached = true;
                  } catch {}
                }
              }
            }
          }

          // Strategy C: Check if input[type="file"] mounted after click
          if (!attached) {
            const mountedInput = await page.$('input[type="file"]');
            if (mountedInput) {
              try {
                await mountedInput.setInputFiles(imagePath);
                attached = true;
              } catch {}
            }
          }

          if (attached) {
            attachedImage = imagePath;
            logger.info(`[BusinessSuite] ✓ Attached blueprint visual: ${imagePath}`);
            await randomDelay(5000, 8000); // Wait for image upload to process
          } else {
            logger.warn('[BusinessSuite] Media upload input not found — post proceeded as text-only');
          }
        }
      } catch (attachErr) {
        logger.warn(`[BusinessSuite] Failed to attach visual: ${attachErr.message}`);
      }
    }

    // 3. Find and click "Publish"
    // Scroll composer dialog/window to ensure footer is in view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.$$eval('div[role="dialog"]', dialogs => dialogs.forEach(d => d.scrollTo(0, d.scrollHeight))).catch(() => {});

    const publishSelectors = [
      'button:has-text("Publish")',
      'div[role="button"]:has-text("Publish")',
      'span:has-text("Publish")',
      'div[aria-label*="Publish" i][role="button"]',
      'button[aria-label*="Publish" i]',
      'button:has-text("Share")',
      'div[role="button"]:has-text("Share")',
      'span:has-text("Share")',
      'button:has-text("Post")',
      'div[role="button"]:has-text("Post")',
    ];

    let publishBtn = null;
    // Poll for up to 15 seconds for publish button to be ready and enabled
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const sel of publishSelectors) {
        const candidate = await page.$(sel);
        if (candidate && await candidate.isVisible().catch(() => false)) {
          publishBtn = candidate;
          break;
        }
      }
      if (publishBtn) break;
      await page.waitForTimeout(3000);
    }

    if (!publishBtn) {
      const debugScreenshot = path.resolve('logs/business-suite-publish-debug.png');
      await page.screenshot({ path: debugScreenshot, fullPage: true }).catch(() => {});
      const visibleButtons = await page.$$eval('button, div[role="button"], span[role="button"]', els =>
        els.map(e => e.innerText?.trim()?.replace(/\s+/g, ' ')).filter(Boolean)
      ).catch(() => []);
      logger.error(`[BusinessSuite] Publish button not found. Visible buttons: ${JSON.stringify(visibleButtons)}`);
      throw new Error(`Business Suite Publish button not found. Visible buttons: [${visibleButtons.slice(0, 15).join(', ')}]`);
    }

    logger.info('[BusinessSuite] Clicking "Publish" button...');
    await safeClick(page, publishBtn);
    await randomDelay(6000, 10000); // Wait for publishing roundtrip

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
