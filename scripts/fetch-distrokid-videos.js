'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const logger = require('../src/utils/logger');

const VAULT_DIR = path.resolve('./data/music_videos/vault');

const DISTROKID_VIDEOS = [
  { id: 'mv-0wZ7lQRs0', url: 'https://distrokid.com/videos/watch/mv-0wZ7lQRs0', track: 'pocket', filename: 'distrokid_pfof_mini.mp4' },
  { id: 'mv-i6MTy4X9o', url: 'https://distrokid.com/videos/watch/mv-i6MTy4X9o', track: 'pocket', filename: 'distrokid_pfof_rope.mp4' },
  { id: 'mv-8Nt2fVVq0', url: 'https://distrokid.com/videos/watch/mv-8Nt2fVVq0', track: 'choir', filename: 'distrokid_choir_dock.mp4' },
  { id: 'mv-Cc80zYM2z', url: 'https://distrokid.com/videos/watch/mv-Cc80zYM2z', track: 'choir', filename: 'distrokid_choir_flames.mp4' },
];

function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(fileUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(destPath)));
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function harvestDistroKidVideos() {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const harvested = [];

  try {
    for (const item of DISTROKID_VIDEOS) {
      const dest = path.join(VAULT_DIR, item.filename);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 50000) {
        logger.info(`[DistroKidHarvest] Already exists: ${item.filename}`);
        harvested.push({ ...item, dest, status: 'cached' });
        continue;
      }

      logger.info(`[DistroKidHarvest] Inspecting ${item.url} ...`);
      let mediaUrls = [];
      page.on('response', (resp) => {
        const u = resp.url();
        const ct = resp.headers()['content-type'] || '';
        if (u.includes('.mp4') || ct.includes('video/')) {
          mediaUrls.push(u);
        }
      });

      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(4000);

      const domVideoSrc = await page.evaluate(() => {
        const v = document.querySelector('video');
        const s = document.querySelector('video source');
        const og = document.querySelector('meta[property="og:video"], meta[property="og:video:secure_url"]');
        return v?.src || s?.src || og?.content || null;
      }).catch(() => null);

      const targetSrc = domVideoSrc || mediaUrls[0];
      if (targetSrc && targetSrc.startsWith('http')) {
        logger.info(`[DistroKidHarvest] Found video stream for ${item.id}: ${targetSrc.slice(0, 80)}...`);
        try {
          await downloadFile(targetSrc, dest);
          const kb = (fs.statSync(dest).size / 1024).toFixed(1);
          logger.info(`[DistroKidHarvest] ✓ Downloaded ${item.filename} (${kb} KB)`);
          harvested.push({ ...item, dest, sizeKB: kb, status: 'downloaded' });
        } catch (dlErr) {
          logger.warn(`[DistroKidHarvest] Direct download failed (${dlErr.message}); capturing via browser fetch...`);
        }
      } else {
        logger.warn(`[DistroKidHarvest] No direct MP4 source exposed on ${item.url}`);
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return harvested;
}

if (require.main === module) {
  harvestDistroKidVideos().then((res) => {
    console.log('HARVESTED:', JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { harvestDistroKidVideos };
