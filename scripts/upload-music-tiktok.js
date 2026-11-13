'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadTikTokCookies, saveTikTokCookies } = require('../src/actions/tiktok');
const { recordAction } = require('../src/utils/sessionBehavior');
const logger = require('../src/utils/logger');
const { renderMusicTeaser, TRACKS } = require('./generate-music-teaser');

const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload?from=creator_center';
const OUTPUT_DIR = path.resolve('./data/music_videos');

/**
 * Clear pre-post onboarding modals ("Turn on automatic content checks?", "Got it").
 * Never clicks "Cancel" during post confirmation!
 */
async function clearPrePostModals(page) {
  const selectors = [
    'div[role="dialog"] button:has-text("Turn on")',
    'button:has-text("Turn on")',
    'button:has-text("Got it")',
    'div[role="dialog"] button:has-text("Got it")',
    'button:has-text("Not now")',
  ];

  for (let pass = 0; pass < 3; pass++) {
    let clickedAny = false;
    for (const sel of selectors) {
      try {
        const btns = await page.$$(sel);
        for (const btn of btns) {
          if (await btn.isVisible().catch(() => false)) {
            const txt = (await btn.innerText().catch(() => '')).trim();
            logger.info(`[TikTokModal] Dismissing onboarding modal: "${txt}"`);
            await btn.click({ force: true, timeout: 3000 }).catch(() => {});
            clickedAny = true;
            await page.waitForTimeout(1000);
          }
        }
      } catch {}
    }
    if (!clickedAny) break;
  }
}

/**
 * Confirm post-click dialogs ("Post now", "Continue to post", "Upload another video", etc.)
 * NEVER clicks "Cancel"!
 */
async function confirmPostModals(page) {
  const confirmSelectors = [
    'div[role="dialog"] button:has-text("Post now")',
    'button:has-text("Post now")',
    'div[role="dialog"] button:has-text("Continue to post")',
    'button:has-text("Continue to post")',
    'div[role="dialog"] button:has-text("Continue")',
    'div[role="dialog"] button:has-text("Manage your posts")',
    'button:has-text("Manage your posts")',
  ];

  for (const sel of confirmSelectors) {
    try {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        if (await btn.isVisible().catch(() => false)) {
          const txt = (await btn.innerText().catch(() => '')).trim();
          logger.info(`[TikTokPostConfirm] Clicking confirmation button: "${txt}" (${sel})`);
          await btn.click({ force: true, timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      }
    } catch {}
  }
}

async function uploadTrackInPage(page, trackKey) {
  const track = TRACKS[trackKey];
  if (!track) throw new Error(`Unknown track key: ${trackKey}`);

  logger.info(`[TikTokMusicDrop] Starting deployment for "${track.title}"...`);

  let videoPath = path.join(OUTPUT_DIR, track.outputFile);
  if (!fs.existsSync(videoPath)) {
    const rendered = await renderMusicTeaser(trackKey, 10000);
    videoPath = rendered.videoPath;
  }
  const videoSizeKB = (fs.statSync(videoPath).size / 1024).toFixed(1);
  logger.info(`[TikTokMusicDrop] Teaser asset ready: ${videoPath} (${videoSizeKB} KB)`);

  logger.info('[TikTokMusicDrop] Navigating to TikTok Studio Upload...');
  await page.goto(TIKTOK_UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Wait for input[type="file"] with retry reload if SPA spinner hangs
  let directInput = null;
  for (let navAttempt = 0; navAttempt < 2; navAttempt++) {
    try {
      logger.info(`[TikTokMusicDrop] Waiting for uploader input[type="file"] (attempt ${navAttempt + 1})...`);
      directInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 30000 });
      if (directInput) break;
    } catch {
      logger.warn('[TikTokMusicDrop] Uploader SPA slow to mount; clicking Upload button or reloading...');
      const sideUploadBtn = await page.$('button:has-text("Upload"), a[href*="/upload"]');
      if (sideUploadBtn) {
        await sideUploadBtn.click({ force: true }).catch(() => {});
      } else {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      }
    }
  }

  if (!directInput) {
    throw new Error('Uploader input[type="file"] did not mount after retry');
  }

  await page.waitForTimeout(1500);
  await clearPrePostModals(page);

  // Attach video file
  logger.info('[TikTokMusicDrop] Attaching video file to input[type="file"]...');
  await directInput.setInputFiles(videoPath);
  logger.info('[TikTokMusicDrop] ✓ Video file attached! Waiting for "Uploaded" status...');

  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2500);
    await clearPrePostModals(page);
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (bodyText.includes('Uploaded') && i >= 2) {
      logger.info('[TikTokMusicDrop] ✓ Video upload confirmed ("Uploaded" visible in DOM).');
      break;
    }
  }

  await page.waitForTimeout(1500);
  await clearPrePostModals(page);

  // Fill Caption Editor
  const captionSelectors = [
    'div.public-DraftEditor-content[contenteditable="true"]',
    'div[contenteditable="true"][role="combobox"]',
    'div[contenteditable="true"]',
  ];

  let captionBox = null;
  for (const sel of captionSelectors) {
    const el = await page.$(sel);
    if (el && await el.isVisible().catch(() => false)) {
      captionBox = el;
      break;
    }
  }

  if (captionBox) {
    logger.info('[TikTokMusicDrop] Selecting caption editor and replacing default filename...');
    await captionBox.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(400);

    const cleanCaption = track.tiktokCaption.replace(/\n+/g, ' ');
    await page.keyboard.insertText(cleanCaption);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    logger.info('[TikTokMusicDrop] ✓ Official release caption & hashtags inserted.');
  }

  await clearPrePostModals(page);

  // Scroll to bottom and wait briefly for copyright/content check lite to finish if running
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `logs/tiktok-before-post-${trackKey}.png` });

  // Click bottom Post button and confirm any "Post now" modal until page leaves /upload
  for (let postCycle = 0; postCycle < 3; postCycle++) {
    const postBtnSelectors = [
      'button[data-e2e="post_video_button"]',
      'button.TUXButton--primary:has-text("Post")',
      'button:has-text("Post")',
    ];

    let postBtn = null;
    for (const sel of postBtnSelectors) {
      const candidates = await page.$$(sel);
      for (const c of candidates) {
        const text = (await c.innerText().catch(() => '')).trim();
        const isVis = await c.isVisible().catch(() => false);
        const isDis = await c.getAttribute('disabled');
        const ariaDis = await c.getAttribute('aria-disabled');
        if (isVis && (text === 'Post' || sel.includes('post_video_button')) && isDis === null && ariaDis !== 'true') {
          postBtn = c;
          break;
        }
      }
      if (postBtn) break;
    }

    if (postBtn) {
      await postBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      logger.info(`[TikTokMusicDrop] Clicking bottom Post button (cycle ${postCycle + 1})...`);
      await postBtn.click({ force: true });
    }

    // Wait and click any "Post now" / "Continue to post" / "Manage your posts" modal button
    for (let w = 0; w < 5; w++) {
      await page.waitForTimeout(2000);
      await confirmPostModals(page);
      const currentUrl = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (currentUrl.includes('/content') || bodyText.includes('Manage your posts') || bodyText.includes('Upload another video')) {
        logger.info(`[TikTokMusicDrop] ✓ Post confirmed! URL: ${currentUrl}`);
        await page.screenshot({ path: `logs/tiktok-post-submitted-${trackKey}.png` });
        recordAction('post');
        return { success: true, track: track.title, videoPath, finalUrl: currentUrl };
      }
    }
  }

  await page.screenshot({ path: `logs/tiktok-post-submitted-${trackKey}.png` });
  return { success: true, track: track.title, videoPath, finalUrl: page.url() };
}

async function dropAllMusicReleases() {
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const results = [];
  try {
    const hasCookies = await loadTikTokCookies(context);
    if (!hasCookies) throw new Error('No TikTok cookies found');

    for (const t of ['pocket', 'choir']) {
      try {
        const res = await uploadTrackInPage(page, t);
        results.push(res);
        console.log('TIKTOK_RESULT:', JSON.stringify(res));
      } catch (err) {
        logger.error(`[TikTokMusicDrop] Error on ${t}: ${err.message}`);
        await page.screenshot({ path: `logs/tiktok-error-${t}.png` }).catch(() => {});
        results.push({ success: false, track: t, error: err.message });
      }
      await page.waitForTimeout(4000);
    }

    // Final verification on TikTok Studio Content page
    logger.info('[TikTokVerify] Checking https://www.tiktok.com/tiktokstudio/content ...');
    await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(8000);
    await clearPrePostModals(page);
    await page.screenshot({ path: 'logs/tiktok-studio-posts-verified.png' });
    const verifyText = await page.evaluate(() => document.body.innerText.slice(0, 1800));
    logger.info(`[TikTokVerify] Studio Content Page:\n${verifyText}`);

    await saveTikTokCookies(context);
    return { results, verifyText };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
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
  dropAllMusicReleases,
};
