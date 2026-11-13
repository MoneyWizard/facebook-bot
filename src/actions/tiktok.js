'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../browser/launcher');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { safeClick, dismissOverlays, recordAction, canPerformAction } = require('../utils/sessionBehavior');
const { generateReelAsset } = require('./videoGenerator');
const { createBusinessSuitePost } = require('./businessSuite');
const logger = require('../utils/logger');

const TIKTOK_COOKIES_FILE = path.resolve('./cookies/tiktok_session.json');
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/creator-center/upload?from=creator_center';

const VIRAL_TIKTOK_CAPTIONS = [
  '🚨 Weldon Giles - "Pocket Full Of Fucks" [Official Single] Produced by HexNemesis Productions. Dropping NOV 6, 2026 on all platforms. Pre-save link in bio! 🩸 #weldongiles #pocketfulloffucks #hexnemesisproductions #newmusic #distrokid #presave #officialrelease #indiemusic',
  '🔥 Weldon Giles - "Too Mean For The Choir" [Official Single] Produced by HexNemesis Productions. Dropping NOV 13, 2026 worldwide. Pre-save link in bio! ⚡ #weldongiles #toomeanforthechoir #hexnemesisproductions #newmusic #distrokid #presavenow #singledrop #indiemusic',
];

/**
 * Load TikTok session cookies.
 */
async function loadTikTokCookies(context) {
  if (!fs.existsSync(TIKTOK_COOKIES_FILE)) {
    logger.warn('[TikTok] No saved session cookies found at ' + TIKTOK_COOKIES_FILE);
    return false;
  }
  try {
    const raw = fs.readFileSync(TIKTOK_COOKIES_FILE, 'utf8');
    const cookies = JSON.parse(raw);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(cookies);
      logger.info(`[TikTok] Loaded ${cookies.length} session cookies.`);
      return true;
    }
  } catch (err) {
    logger.warn(`[TikTok] Error loading cookies: ${err.message}`);
  }
  return false;
}

/**
 * Save TikTok session cookies.
 */
async function saveTikTokCookies(context) {
  try {
    const cookies = await context.cookies();
    fs.mkdirSync(path.dirname(TIKTOK_COOKIES_FILE), { recursive: true });
    fs.writeFileSync(TIKTOK_COOKIES_FILE, JSON.stringify(cookies, null, 2), 'utf8');
    logger.info(`[TikTok] Saved ${cookies.length} session cookies.`);
  } catch (err) {
    logger.warn(`[TikTok] Error saving cookies: ${err.message}`);
  }
}

/**
 * Upload and publish a vertical short-form asset to TikTok Creator Center.
 *
 * @param {Object} [opts={}]
 * @param {string} [opts.assetPath] - Path to vertical 9:16 asset (if omitted, auto-rendered)
 * @param {string} [opts.caption]   - Custom caption (if omitted, auto-selected from viral templates)
 * @returns {Promise<Object>}
 */
async function publishTikTokShort(opts = {}) {
  logger.info('[TikTok] Launching TikTok Creator Center uploader...');

  const assetPath = opts.assetPath || await generateReelAsset();
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Asset file does not exist: ${assetPath}`);
  }

  const caption = opts.caption || VIRAL_TIKTOK_CAPTIONS[Math.floor(Math.random() * VIRAL_TIKTOK_CAPTIONS.length)];

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadTikTokCookies(context);
    await page.goto(TIKTOK_UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await randomDelay(3000, 5000);
    await dismissOverlays(page);

    const currentUrl = page.url();
    const pageTitle = await page.title();
    logger.info(`[TikTok] Creator Studio arrived at: ${currentUrl} (Title: "${pageTitle}")`);

    // Check if redirected to login page
    if (currentUrl.includes('/login') || !hasCookies) {
      logger.warn('[TikTok] Login required. Creator Center session cookies needed in cookies/tiktok_session.json.');
      // Save current state snapshot
      await page.screenshot({ path: 'logs/tiktok-login-required.png' }).catch(() => {});
      return {
        success: false,
        action: 'auth_required',
        message: 'TikTok authentication required. Please save session cookies to cookies/tiktok_session.json',
        currentUrl,
        assetPrepared: assetPath,
      };
    }

    // 1. Locate file uploader input or iframe
    let fileInput = await page.$('input[type="file"][accept*="video"], input[type="file"]');
    if (!fileInput) {
      // Check inside creator studio iframe if present
      const uploadFrame = page.frames().find(f => f.url().includes('upload') || f.name().includes('upload'));
      if (uploadFrame) {
        fileInput = await uploadFrame.$('input[type="file"]');
      }
    }

    if (fileInput) {
      await fileInput.setInputFiles(assetPath);
      logger.info(`[TikTok] ✓ Injected vertical short asset: ${assetPath}`);
      await randomDelay(6000, 10000); // Wait for upload and transcoding
    } else {
      logger.warn('[TikTok] File input element not found in upload interface.');
    }

    // 2. Locate and fill caption
    const captionSelectors = [
      'div[contenteditable="true"][aria-label*="caption" i]',
      'div[contenteditable="true"]',
      'div[role="combobox"]',
      '.notranslate[contenteditable="true"]',
      'textarea',
    ];

    let captionBox = null;
    for (const sel of captionSelectors) {
      captionBox = await page.$(sel);
      if (captionBox && await captionBox.isVisible().catch(() => false)) break;
    }

    if (captionBox) {
      await safeClick(page, captionBox);
      await randomDelay(800, 1500);
      await humanType(page, captionBox, caption);
      logger.info('[TikTok] ✓ Typed viral builder caption and hashtags.');
      await randomDelay(2000, 4000);
    }

    // 3. Find and click "Post" button
    const postBtnSelectors = [
      'button:has-text("Post")',
      'div[role="button"]:has-text("Post")',
      'button[data-e2e="post_video_button"]',
      'button:has-text("Publish")',
    ];

    let postBtn = null;
    for (const sel of postBtnSelectors) {
      postBtn = await page.$(sel);
      if (postBtn && await postBtn.isVisible().catch(() => false)) break;
    }

    if (postBtn) {
      logger.info('[TikTok] Clicking "Post" button...');
      await safeClick(page, postBtn);
      await randomDelay(5000, 9000);
      logger.info('[TikTok] ✓ Published short-form video asset!');
    }

    await saveTikTokCookies(context);
    recordAction('post');

    return {
      success: true,
      action: 'tiktok_published',
      assetPath,
      caption,
    };

  } catch (err) {
    logger.error(`[TikTok] publishTikTokShort error: ${err.message}`);
    await page.screenshot({ path: 'logs/tiktok-error.png' }).catch(() => {});
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

/**
 * Universal Short-Form Syndicator:
 * Generates a single high-impact vertical CAD blueprint and syndicates it across
 * TikTok, Instagram Reels, and Facebook Reels in a synchronized deployment.
 *
 * @param {Object} [opts={}]
 * @returns {Promise<Object>}
 */
async function syndicateShortForm(opts = {}) {
  logger.info('[Syndicator] Launching autonomous Music Vault TikTok deployment...');
  const { deployVaultBatch } = require('../../scripts/rotate-tiktok-vault');
  const vaultResult = await deployVaultBatch(opts.count || 1);
  return {
    timestamp: new Date().toISOString(),
    platforms: {
      tiktok: vaultResult,
    },
  };
}

module.exports = {
  publishTikTokShort,
  syndicateShortForm,
  loadTikTokCookies,
  saveTikTokCookies,
  TIKTOK_COOKIES_FILE,
};
