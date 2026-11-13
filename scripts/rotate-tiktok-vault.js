'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadTikTokCookies, saveTikTokCookies } = require('../src/actions/tiktok');
const { recordAction } = require('../src/utils/sessionBehavior');
const { MUSIC_CATALOG, buildClipCaption } = require('../src/config/musicCatalog');
const logger = require('../src/utils/logger');

const VAULT_DIR = path.resolve('./data/music_videos/vault');
const LEDGER_FILE = path.resolve('./data/tiktok-vault-ledger.json');
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload?from=creator_center';

function loadVaultLedger() {
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
    }
  } catch {}
  return { posted: {}, history: [] };
}

function saveVaultLedger(ledger) {
  fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2), 'utf8');
}

function inferTrackFromFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('choir') || lower.includes('elaine') || lower.includes('dock') || lower.includes('flames')) {
    return 'choir';
  }
  return 'pocket';
}

function getVaultVideos() {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  const files = fs.readdirSync(VAULT_DIR).filter(f => /\.(mp4|webm|mov)$/i.test(f));
  return files.map(f => ({
    filename: f,
    fullPath: path.join(VAULT_DIR, f),
    sizeKB: parseFloat((fs.statSync(path.join(VAULT_DIR, f)).size / 1024).toFixed(1)),
    trackKey: inferTrackFromFilename(f),
  }));
}

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

async function confirmPostModals(page) {
  const confirmSelectors = [
    'div[role="dialog"] button:has-text("Post now")',
    'button:has-text("Post now")',
    'div[role="dialog"] button:has-text("Continue to post")',
    'button:has-text("Continue to post")',
    'div[role="dialog"] button:has-text("Continue")',
  ];

  for (const sel of confirmSelectors) {
    try {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        if (await btn.isVisible().catch(() => false)) {
          const txt = (await btn.innerText().catch(() => '')).trim();
          logger.info(`[TikTokVault] Clicking confirmation button: "${txt}"`);
          await btn.click({ force: true, timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      }
    } catch {}
  }
}

async function uploadVaultVideoInPage(page, videoItem) {
  const track = MUSIC_CATALOG[videoItem.trackKey] || MUSIC_CATALOG.pocket;
  const caption = buildClipCaption(videoItem.filename, videoItem.trackKey);

  logger.info(`[TikTokVault] Deploying "${videoItem.filename}" (${videoItem.sizeKB} KB) -> Track: "${track.title}"`);
  await page.goto(TIKTOK_UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  let directInput = null;
  for (let navAttempt = 0; navAttempt < 2; navAttempt++) {
    try {
      directInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 30000 });
      if (directInput) break;
    } catch {
      const sideUploadBtn = await page.$('button:has-text("Upload"), a[href*="/upload"]');
      if (sideUploadBtn) {
        await sideUploadBtn.click({ force: true }).catch(() => {});
      } else {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      }
    }
  }

  if (!directInput) {
    throw new Error('Uploader input[type="file"] did not mount');
  }

  await page.waitForTimeout(1500);
  await clearPrePostModals(page);

  await directInput.setInputFiles(videoItem.fullPath);
  logger.info(`[TikTokVault] ✓ Attached ${videoItem.filename}. Waiting for "Uploaded"...`);

  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(2500);
    await clearPrePostModals(page);
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    if (bodyText.includes('Uploaded') && i >= 2) {
      logger.info(`[TikTokVault] ✓ Upload confirmed for ${videoItem.filename}`);
      break;
    }
  }

  await page.waitForTimeout(1500);
  await clearPrePostModals(page);

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
    await captionBox.click({ force: true });
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(400);

    const cleanCaption = caption.replace(/\n+/g, ' ');
    await page.keyboard.insertText(cleanCaption);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    logger.info('[TikTokVault] ✓ Official streaming links & hashtags injected.');
  }

  await clearPrePostModals(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);

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
      await postBtn.click({ force: true });
    }

    for (let w = 0; w < 5; w++) {
      await page.waitForTimeout(2000);
      await confirmPostModals(page);
      const currentUrl = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (currentUrl.includes('/content') || bodyText.includes('Manage your posts') || bodyText.includes('Upload another video')) {
        logger.info(`[TikTokVault] ✓ Published "${videoItem.filename}"!`);
        recordAction('post');
        return { success: true, filename: videoItem.filename, track: track.title, caption };
      }
    }
  }

  return { success: true, filename: videoItem.filename, track: track.title, caption };
}

/**
 * Deploy 1 single video per scheduled drip cycle (never dump all at once),
 * prioritizing unposted or oldest-posted clips. When all clips have been cycled,
 * automatically generates a fresh mashup variation for the vault.
 */
async function deployVaultBatch(maxDrops = 1) {
  let videos = getVaultVideos();
  if (!videos.length) {
    return { success: false, message: 'No videos in vault' };
  }

  const ledger = loadVaultLedger();
  const unposted = videos.filter(v => !(ledger.posted[v.filename]?.count > 0));
  if (unposted.length === 0) {
    try {
      const { generateVaultMashup } = require('./generate-vault-mashups');
      const nextTrack = Math.random() < 0.5 ? 'pocket' : 'choir';
      logger.info(`[TikTokVault] All vault videos cycled once — minting fresh "${nextTrack}" mashup variation...`);
      await generateVaultMashup(nextTrack);
      videos = getVaultVideos();
    } catch (e) {
      logger.warn(`[TikTokVault] Mashup generation skipped: ${e.message}`);
    }
  }
  // Sort by least times posted, then oldest timestamp
  videos.sort((a, b) => {
    const countA = ledger.posted[a.filename]?.count || 0;
    const countB = ledger.posted[b.filename]?.count || 0;
    if (countA !== countB) return countA - countB;
    const lastA = ledger.posted[a.filename]?.lastPostedAt || '';
    const lastB = ledger.posted[b.filename]?.lastPostedAt || '';
    return lastA.localeCompare(lastB);
  });

  const batch = videos.slice(0, maxDrops);
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const results = [];
  try {
    const hasCookies = await loadTikTokCookies(context);
    if (!hasCookies) throw new Error('No TikTok session cookies');

    for (const v of batch) {
      try {
        const res = await uploadVaultVideoInPage(page, v);
        results.push(res);
        ledger.posted[v.filename] = {
          count: (ledger.posted[v.filename]?.count || 0) + 1,
          lastPostedAt: new Date().toISOString(),
          trackKey: v.trackKey,
        };
        ledger.history.unshift({
          timestamp: new Date().toISOString(),
          filename: v.filename,
          track: res.track,
        });
        if (ledger.history.length > 100) ledger.history.pop();
        saveVaultLedger(ledger);
      } catch (err) {
        logger.error(`[TikTokVault] Error deploying ${v.filename}: ${err.message}`);
        results.push({ success: false, filename: v.filename, error: err.message });
      }
      await page.waitForTimeout(5000);
    }

    // Verify on TikTok Studio Content page
    await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(7000);
    await clearPrePostModals(page);
    await page.screenshot({ path: 'logs/tiktok-studio-posts-verified.png' });
    await saveTikTokCookies(context);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return { success: true, deployed: results, totalVaultVideos: videos.length };
}

if (require.main === module) {
  const count = parseInt(process.argv[2] || '1', 10);
  deployVaultBatch(count).then(res => {
    console.log('VAULT_BATCH_RESULT:', JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  deployVaultBatch,
  getVaultVideos,
  loadVaultLedger,
};
