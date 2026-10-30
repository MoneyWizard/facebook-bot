'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadTikTokCookies, saveTikTokCookies } = require('../src/actions/tiktok');
const { randomDelay, humanType } = require('../src/utils/humanBehavior');
const { safeClick, dismissOverlays, recordAction } = require('../src/utils/sessionBehavior');
const logger = require('../src/utils/logger');
const { renderMusicTeaser, TRACKS } = require('./generate-music-teaser');

const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload?from=creator_center';

async function uploadTrackToTikTok(trackKey) {
  const track = TRACKS[trackKey];
  if (!track) throw new Error(`Unknown track key: ${trackKey}`);

  logger.info(`[TikTokMusicDrop] Starting deployment for "${track.title}"...`);

  // 1. Render fresh 9:16 animated teaser video
  const { videoPath } = await renderMusicTeaser(trackKey, 10000);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Rendered video file not found: ${videoPath}`);
  }
  const videoSizeKB = (fs.statSync(videoPath).size / 1024).toFixed(1);
  logger.info(`[TikTokMusicDrop] Teaser asset ready: ${videoPath} (${videoSizeKB} KB)`);

  // 2. Launch browser with TikTok session
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadTikTokCookies(context);
    if (!hasCookies) {
      throw new Error('No TikTok cookies found in cookies/tiktok_session.json');
    }

    logger.info('[TikTokMusicDrop] Navigating to TikTok Studio Upload...');
    await page.goto(TIKTOK_UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);
    await dismissOverlays(page);

    // Check if redirected to login
    if (page.url().includes('/login')) {
      throw new Error('TikTok session expired or redirected to login.');
    }

    // 3. Trigger file chooser via "Select video" button
    logger.info('[TikTokMusicDrop] Triggering video upload file chooser...');
    const selectBtnSelectors = [
      'button:has-text("Select video")',
      'div[role="button"]:has-text("Select video")',
      'button:has-text("Upload")',
      'input[type="file"]'
    ];

    let directInput = await page.$('input[type="file"]');
    if (directInput) {
      logger.info('[TikTokMusicDrop] Direct file input detected in DOM. Attaching video...');
      await directInput.setInputFiles(videoPath);
    } else {
      const selectBtn = await page.$('button:has-text("Select video"), div[role="button"]:has-text("Select video")');
      if (!selectBtn) {
        await page.screenshot({ path: 'logs/tiktok-select-btn-missing.png' });
        throw new Error('Could not find "Select video" button or file input');
      }

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 15000 }),
        selectBtn.click({ force: true }),
      ]);
      await fileChooser.setFiles(videoPath);
      logger.info('[TikTokMusicDrop] File chooser intercepted. Video file attached!');
    }

    // 4. Wait for upload preview & caption editor to mount
    logger.info('[TikTokMusicDrop] Waiting for video upload processing & caption editor...');
    await randomDelay(8000, 12000);

    const captionSelectors = [
      'div[contenteditable="true"][aria-label*="caption" i]',
      'div[contenteditable="true"][data-placeholder*="caption" i]',
      'div[contenteditable="true"]',
      'div[role="combobox"]',
      '.notranslate[contenteditable="true"]',
      'textarea'
    ];

    let captionBox = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      for (const sel of captionSelectors) {
        captionBox = await page.$(sel);
        if (captionBox && await captionBox.isVisible().catch(() => false)) break;
      }
      if (captionBox) break;
      await page.waitForTimeout(3000);
    }

    if (captionBox) {
      logger.info('[TikTokMusicDrop] Caption editor mounted. Typing official release copy...');
      await safeClick(page, captionBox);
      await randomDelay(800, 1500);

      // Clear default text if any
      await page.keyboard.press('Control+A').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});

      await humanType(page, captionBox, track.tiktokCaption);
      logger.info('[TikTokMusicDrop] ✓ Release caption & music hashtags typed.');
      await randomDelay(2500, 4500);
    } else {
      logger.warn('[TikTokMusicDrop] Caption box not found; continuing with upload state...');
    }

    // Take screenshot of upload stage before posting
    await page.screenshot({ path: `logs/tiktok-before-post-${trackKey}.png` });

    // 5. Click Post / Publish button
    const postBtnSelectors = [
      'button:has-text("Post")',
      'button:has-text("Publish")',
      'div[role="button"]:has-text("Post")',
      'button[data-e2e="post_video_button"]'
    ];

    let postBtn = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      for (const sel of postBtnSelectors) {
        const candidate = await page.$(sel);
        if (candidate && await candidate.isVisible().catch(() => false)) {
          const isDisabled = await candidate.getAttribute('disabled');
          const ariaDisabled = await candidate.getAttribute('aria-disabled');
          if (!isDisabled && ariaDisabled !== 'true') {
            postBtn = candidate;
            break;
          }
        }
      }
      if (postBtn) break;
      logger.info('[TikTokMusicDrop] Waiting for Post button to become enabled...');
      await page.waitForTimeout(4000);
    }

    if (!postBtn) {
      await page.screenshot({ path: `logs/tiktok-post-btn-missing-${trackKey}.png` });
      logger.warn('[TikTokMusicDrop] Post button not yet clickable or upload still processing. Check screenshot.');
      return { success: false, reason: 'post_button_disabled_or_missing', track: track.title };
    }

    logger.info('[TikTokMusicDrop] Post button ready. Firing publication strike...');
    await safeClick(page, postBtn);
    await randomDelay(3000, 5000);

    // Check for TikTok confirmation modals ("Turn on automatic content checks", "Got it")
    const modalConfirmSelectors = [
      'button:has-text("Turn on")',
      'div[role="dialog"] button:has-text("Turn on")',
      'button:has-text("Got it")',
      'div[role="dialog"] button:has-text("Got it")',
      'button:has-text("Post now")',
    ];

    for (const mSel of modalConfirmSelectors) {
      const mBtn = await page.$(mSel);
      if (mBtn && await mBtn.isVisible().catch(() => false)) {
        logger.info(`[TikTokMusicDrop] Dismissing confirmation modal via: ${mSel}`);
        await safeClick(page, mBtn);
        await randomDelay(2500, 4000);
        break;
      }
    }

    await randomDelay(5000, 8000);

    // Save final screenshot
    await page.screenshot({ path: `logs/tiktok-post-submitted-${trackKey}.png` });
    await saveTikTokCookies(context);
    recordAction('post');

    logger.info(`[TikTokMusicDrop] ✓ Successfully submitted "${track.title}" to TikTok!`);
    return { success: true, track: track.title, videoPath };

  } catch (err) {
    logger.error(`[TikTokMusicDrop] Error dropping "${track.title}": ${err.message}`);
    await page.screenshot({ path: `logs/tiktok-error-${trackKey}.png` }).catch(() => {});
    return { success: false, error: err.message };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function dropAllMusicReleases() {
  const tracksToDrop = ['pocket', 'choir'];
  const results = [];

  for (const t of tracksToDrop) {
    const res = await uploadTrackToTikTok(t);
    results.push(res);
    console.log('TIKTOK_RESULT:', JSON.stringify(res));
    logger.info('Waiting 20s between TikTok drops...');
    await new Promise(r => setTimeout(r, 20000));
  }

  return results;
}

if (require.main === module) {
  dropAllMusicReleases().then(res => {
    console.log('ALL TIKTOK DROPS COMPLETED:', JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  uploadTrackToTikTok,
  dropAllMusicReleases,
};
