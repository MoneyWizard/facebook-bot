'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { randomDelay, humanType } = require('../src/utils/humanBehavior');
const { safeClick, dismissOverlays, recordAction } = require('../src/utils/sessionBehavior');
const logger = require('../src/utils/logger');
const { generateShortWithClip } = require('./generate-clip-short');

const YOUTUBE_COOKIES_FILE = path.resolve('./cookies/youtube_session.json');
const YOUTUBE_STUDIO_URL = 'https://studio.youtube.com/';

const SHORTS_METADATA = {
  pocket: {
    title: 'Weldon Giles - "Pocket Full Of Fucks" (Official Single) #Shorts',
    description: `🚨 OFFICIAL RELEASE ANNOUNCEMENT 🚨\n\n"Pocket Full Of Fucks"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nOfficial Single Release: November 6, 2026\n\nPre-save now on Spotify, Apple Music, and all platforms:\n👉 https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks\n\n#Shorts #WeldonGiles #HexNemesisProductions #PocketFullOfFucks #NewMusic #DistroKid #PreSave`,
    defaultClip: 'D:/Videos/20250914_153640-CINEMATIC.mp4',
    shortVideoPath: path.resolve('./data/youtube_shorts/pocket_youtube_short.webm'),
  },
  choir: {
    title: 'Weldon Giles - "Too Mean For The Choir" (Official Single) #Shorts',
    description: `🔥 OFFICIAL RELEASE ANNOUNCEMENT 🔥\n\n"Too Mean For The Choir"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nOfficial Single Release: November 13, 2026\n\nPre-save & stream early:\n👉 https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir\n\n#Shorts #WeldonGiles #HexNemesisProductions #TooMeanForTheChoir #NewMusic #DistroKid #PreSaveNow`,
    defaultClip: 'D:/Videos/995f53bd544de140d4d3347d5630f8de.mp4',
    shortVideoPath: path.resolve('./data/youtube_shorts/choir_youtube_short.webm'),
  }
};

async function loadYouTubeCookies(context) {
  if (!fs.existsSync(YOUTUBE_COOKIES_FILE)) {
    logger.warn('[YouTubeShorts] No saved session cookies found at ' + YOUTUBE_COOKIES_FILE);
    return false;
  }
  try {
    const raw = fs.readFileSync(YOUTUBE_COOKIES_FILE, 'utf8');
    const cookies = JSON.parse(raw);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await context.addCookies(cookies);
      logger.info(`[YouTubeShorts] Loaded ${cookies.length} session cookies.`);
      return true;
    }
  } catch (err) {
    logger.warn(`[YouTubeShorts] Error loading cookies: ${err.message}`);
  }
  return false;
}

async function saveYouTubeCookies(context) {
  try {
    const cookies = await context.cookies();
    fs.mkdirSync(path.dirname(YOUTUBE_COOKIES_FILE), { recursive: true });
    fs.writeFileSync(YOUTUBE_COOKIES_FILE, JSON.stringify(cookies, null, 2), 'utf8');
    logger.info(`[YouTubeShorts] Saved ${cookies.length} session cookies.`);
  } catch (err) {
    logger.warn(`[YouTubeShorts] Error saving cookies: ${err.message}`);
  }
}

async function publishYouTubeShort(trackKey = 'pocket', opts = {}) {
  const meta = SHORTS_METADATA[trackKey];
  if (!meta) throw new Error(`Unknown track key: ${trackKey}`);

  // Ensure short video file exists or generate it
  let videoPath = meta.shortVideoPath;
  if (!fs.existsSync(videoPath) || opts.regenerate) {
    logger.info(`[YouTubeShorts] Rendering fresh short video for "${trackKey}"...`);
    const genRes = await generateShortWithClip(trackKey, opts.clipPath || meta.defaultClip, opts.durationMs || 12000);
    videoPath = genRes.shortPath;
  }

  logger.info(`[YouTubeShorts] Prepared short video payload: ${videoPath}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadYouTubeCookies(context);
    logger.info('[YouTubeShorts] Navigating to YouTube Studio...');
    await page.goto(YOUTUBE_STUDIO_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    const pageTitle = await page.title();
    logger.info(`[YouTubeShorts] Studio arrived at: ${currentUrl} (Title: "${pageTitle}")`);

    // Check for login redirect
    if (currentUrl.includes('accounts.google.com') || !hasCookies) {
      logger.warn('[YouTubeShorts] YouTube / Google login required. Please export cookies to cookies/youtube_session.json');
      await page.screenshot({ path: 'logs/youtube-login-required.png' });
      return {
        success: false,
        action: 'auth_required',
        message: 'Google / YouTube session cookies required at cookies/youtube_session.json',
        videoReady: videoPath,
        currentUrl,
      };
    }

    // Locate Create / Upload button
    const createBtn = await page.$('ytcp-button#create-icon, button[aria-label="Create"], #create-icon');
    if (createBtn) {
      await safeClick(page, createBtn);
      await randomDelay(1000, 2000);
      const uploadItem = await page.$('ytcp-text-menu-item:has-text("Upload videos"), [test-id="upload-beta"]');
      if (uploadItem) await safeClick(page, uploadItem);
    }

    await randomDelay(3000, 5000);

    // Locate File Input
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      await page.screenshot({ path: 'logs/youtube-upload-missing-input.png' });
      throw new Error('YouTube Studio file input element not found');
    }

    logger.info('[YouTubeShorts] Attaching short video file...');
    await fileInput.setInputFiles(videoPath);
    await randomDelay(8000, 12000);

    // Fill Title
    const titleBox = await page.$('div#textbox[aria-label*="title" i], div#textbox[contenteditable="true"]');
    if (titleBox) {
      await safeClick(page, titleBox);
      await page.keyboard.press('Control+A').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});
      await humanType(page, titleBox, meta.title);
      logger.info('[YouTubeShorts] ✓ Typed title with #Shorts tag.');
      await randomDelay(2000, 3000);
    }

    // Fill Description
    const descBox = await page.$('div#description-textarea div#textbox, div[aria-label*="description" i]');
    if (descBox) {
      await safeClick(page, descBox);
      await humanType(page, descBox, meta.description);
      logger.info('[YouTubeShorts] ✓ Typed description with HyperFollow link.');
      await randomDelay(2000, 3000);
    }

    // Set "Not made for kids" (required)
    const notForKidsRadio = await page.$('tp-yt-paper-radio-button[name="NOT_MADE_FOR_KIDS"], [name="NOT_MADE_FOR_KIDS"]');
    if (notForKidsRadio) {
      await safeClick(page, notForKidsRadio);
      logger.info('[YouTubeShorts] ✓ Selected "Not made for kids".');
      await randomDelay(1000, 2000);
    }

    // Advance through wizard
    for (let step = 0; step < 3; step++) {
      const nextBtn = await page.$('ytcp-button#next-button, button:has-text("Next")');
      if (nextBtn && await nextBtn.isVisible().catch(() => false)) {
        await safeClick(page, nextBtn);
        await randomDelay(2000, 3500);
      }
    }

    // Visibility: Public
    const publicRadio = await page.$('tp-yt-paper-radio-button[name="PUBLIC"], [name="PUBLIC"]');
    if (publicRadio) {
      await safeClick(page, publicRadio);
      logger.info('[YouTubeShorts] ✓ Set visibility to Public.');
      await randomDelay(1500, 2500);
    }

    // Click Publish / Done
    const doneBtn = await page.$('ytcp-button#done-button, button:has-text("Save"), button:has-text("Publish")');
    if (doneBtn) {
      await safeClick(page, doneBtn);
      logger.info('[YouTubeShorts] ✓ Clicked Publish button!');
      await randomDelay(6000, 9000);
    }

    await page.screenshot({ path: `logs/youtube-published-${trackKey}.png` });
    await saveYouTubeCookies(context);
    recordAction('post');

    logger.info(`[YouTubeShorts] ✓ Successfully published YouTube Short for "${trackKey}"!`);
    return {
      success: true,
      trackKey,
      title: meta.title,
      videoPath,
    };

  } catch (err) {
    logger.error(`[YouTubeShorts] Error: ${err.message}`);
    await page.screenshot({ path: `logs/youtube-error-${trackKey}.png` }).catch(() => {});
    return { success: false, error: err.message };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

module.exports = {
  publishYouTubeShort,
  loadYouTubeCookies,
  saveYouTubeCookies,
  SHORTS_METADATA,
  YOUTUBE_COOKIES_FILE,
};

if (require.main === module) {
  publishYouTubeShort('pocket').then(res => {
    console.log('YOUTUBE_RESULT:', JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
