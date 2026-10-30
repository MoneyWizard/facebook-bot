'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadCookies, saveCookies } = require('../src/browser/cookies');
const { randomDelay, simulateMouseMove, humanType } = require('../src/utils/humanBehavior');
const { canPerformAction, recordAction } = require('../src/utils/sessionBehavior');
const logger = require('../src/utils/logger');

const RELEASES = [
  {
    title: 'Too Mean For The Choir',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    type: 'Single',
    releaseDate: 'November 13, 2026',
    url: 'https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir',
    imagePath: path.resolve('./data/release_assets/too_mean_for_the_choir.png'),
    postText: `🔥 NEW MUSIC RELEASE ANNOUNCEMENT 🔥\n\n"Too Mean For The Choir"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nType: Official Single\nRelease Date: November 13, 2026\n\nPre-save & stream early:\n👉 https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir\n\n#WeldonGiles #HexNemesisProductions #TooMeanForTheChoir #NewMusic #DistroKid #SingleRelease`,
  },
  {
    title: 'Pocket Full Of Fucks',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    type: 'Single',
    releaseDate: 'November 6, 2026',
    url: 'https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks',
    imagePath: path.resolve('./data/release_assets/pocket_full_of_fucks.png'),
    postText: `🚨 OFFICIAL RELEASE ANNOUNCEMENT 🚨\n\n"Pocket Full Of Fucks"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nType: Official Single\nRelease Date: November 6, 2026\n\nTap in, pre-save, and lock in for the drop:\n👉 https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks\n\n#WeldonGiles #HexNemesisProductions #PocketFullOfFucks #NewMusicAlert #DistroKid #PreSaveNow #OfficialRelease`,
  }
];

async function postDirectToTimeline(release) {
  logger.info(`[DirectPost] Starting direct timeline drop for "${release.title}"...`);
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context, { asPage: false });
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 5000);

    // Look for post trigger
    const createPostSelectors = [
      'div[role="button"]:has-text("What\'s on your mind")',
      'span:has-text("What\'s on your mind")',
      'div[aria-label*="What\'s on your mind" i]',
      'div[role="button"]:has-text("Create a post")',
    ];

    let createBox = null;
    for (const sel of createPostSelectors) {
      createBox = await page.$(sel);
      if (createBox) {
        logger.info(`[DirectPost] Found create box with: ${sel}`);
        break;
      }
    }

    if (!createBox) {
      logger.warn('[DirectPost] Create box not found on feed, navigating to profile directly...');
      await page.goto('https://www.facebook.com/profile.php?id=61584889229860', { waitUntil: 'domcontentloaded', timeout: 35000 });
      await randomDelay(3000, 5000);
      for (const sel of createPostSelectors) {
        createBox = await page.$(sel);
        if (createBox) break;
      }
    }

    if (!createBox) {
      throw new Error('Could not locate create post input on Facebook feed or profile.');
    }

    await createBox.click({ force: true });
    await randomDelay(2000, 3500);

    // Wait for text input in modal
    const inputSelector = 'div[role="dialog"] div[contenteditable="true"], div[role="dialog"] div[aria-label*="What\'s on your mind" i]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    logger.info('[DirectPost] Dialog opened. Typing release announcement...');

    // Type post text
    await humanType(page, inputSelector, release.postText);
    await randomDelay(2000, 3500);

    // Attach high-res cover art
    if (release.imagePath && fs.existsSync(release.imagePath)) {
      logger.info(`[DirectPost] Attaching cover art: ${release.imagePath}`);
      let fileInput = await page.$('div[role="dialog"] input[type="file"]');
      if (!fileInput) {
        const photoBtn = await page.$('div[role="dialog"] div[aria-label*="Photo/video" i], div[role="dialog"] div[aria-label*="Add to your post" i]');
        if (photoBtn) {
          await photoBtn.click().catch(() => {});
          await randomDelay(1000, 2000);
        }
        fileInput = await page.$('div[role="dialog"] input[type="file"]');
      }
      if (fileInput) {
        await fileInput.setInputFiles(release.imagePath);
        logger.info('[DirectPost] Cover art file uploaded.');
        await randomDelay(4000, 6000);
      }
    }

    // Submit post
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

    if (!postBtn) throw new Error('Post submit button not found');

    logger.info('[DirectPost] Clicking Post button...');
    await postBtn.click({ force: true });
    await randomDelay(6000, 9000);

    recordAction('post');
    logger.info(`[DirectPost] ✓ Successfully published "${release.title}" to Facebook Timeline.`);
    return { success: true, title: release.title };

  } catch (err) {
    logger.error(`[DirectPost] Error posting "${release.title}": ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function runDirectDrops() {
  for (const rel of RELEASES) {
    const res = await postDirectToTimeline(rel);
    console.log('RESULT:', JSON.stringify(res));
    logger.info('Resting 25s between drops...');
    await new Promise(r => setTimeout(r, 25000));
  }
}

runDirectDrops().then(() => {
  console.log('ALL DROPS FINISHED.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
