'use strict';

/**
 * Dynamic Music Vault Mashup Generator
 * Takes existing vault clips or background footage and composites official Weldon Giles
 * artwork + Spotify / Apple Music / Amazon / HyperFollow callouts into new 9:16 vertical shorts.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const logger = require('../src/utils/logger');
const { TRACKS } = require('./generate-music-teaser');

const VAULT_DIR = path.resolve('./data/music_videos/vault');

async function generateVaultMashup(trackKey = 'pocket', sourceClipPath = null, outputName = null, durationMs = 11000) {
  const track = TRACKS[trackKey] || TRACKS.pocket;
  fs.mkdirSync(VAULT_DIR, { recursive: true });

  const candidates = fs.readdirSync(VAULT_DIR)
    .filter(f => f.endsWith('.mp4'))
    .map(f => path.join(VAULT_DIR, f));

  const chosenClip = sourceClipPath || candidates[Math.floor(Math.random() * candidates.length)];
  if (!chosenClip || !fs.existsSync(chosenClip)) {
    throw new Error('No source MP4 clip available for mashup generation');
  }

  const clipUrl = `file:///${chosenClip.replace(/\\/g, '/')}`;
  const coverBase64 = fs.readFileSync(track.coverArt).toString('base64');
  const coverDataUri = `data:image/png;base64,${coverBase64}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 720px;
      height: 1280px;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      position: relative;
    }
    .bg-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: contrast(1.12) saturate(1.15);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 25%, transparent 65%, rgba(0,0,0,0.92) 100%);
      z-index: 2;
    }
    .overlay {
      position: relative;
      z-index: 3;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 60px 36px;
    }
    .top-pill {
      padding: 10px 26px;
      border-radius: 999px;
      background: linear-gradient(90deg, ${track.accent}, ${track.subAccent});
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      box-shadow: 0 0 25px ${track.accent}aa;
    }
    .bottom-card {
      width: 100%;
      background: rgba(10, 10, 18, 0.78);
      border: 2px solid ${track.accent}88;
      border-radius: 22px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 15px 40px rgba(0,0,0,0.85);
    }
    .cover {
      width: 110px;
      height: 110px;
      border-radius: 14px;
      object-fit: cover;
      border: 2px solid #fff;
    }
    .meta h1 {
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .meta h2 {
      font-size: 17px;
      color: ${track.accent};
      font-weight: 800;
      margin-bottom: 8px;
    }
    .platforms {
      font-size: 13px;
      font-weight: 700;
      color: #d1d5db;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <video class="bg-video" src="${clipUrl}" autoplay loop muted playsinline></video>
  <div class="shade"></div>
  <div class="overlay">
    <div class="top-pill">STREAMING ON SPOTIFY • APPLE • AMAZON</div>
    <div class="bottom-card">
      <img class="cover" src="${coverDataUri}" />
      <div class="meta">
        <h1>${track.title}</h1>
        <h2>WELDON GILES • HEXNEMESIS PROD.</h2>
        <div class="platforms">🟢 SPOTIFY  🍎 APPLE MUSIC  📦 AMAZON</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const tempHtml = path.join(VAULT_DIR, `_temp_mashup_${trackKey}.html`);
  fs.writeFileSync(tempHtml, html, 'utf8');

  const browser = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({
    viewport: { width: 720, height: 1280 },
    recordVideo: { dir: VAULT_DIR, size: { width: 720, height: 1280 } },
  });

  const page = await context.newPage();
  await page.goto(`file:///${tempHtml.replace(/\\/g, '/')}`);
  await page.waitForTimeout(durationMs);

  const recVideo = page.video();
  await context.close();
  await browser.close();
  fs.unlinkSync(tempHtml);

  const recordedPath = await recVideo.path();
  const finalFilename = outputName || `mashup_${trackKey}_${Date.now()}.webm`;
  const finalPath = path.join(VAULT_DIR, finalFilename);
  if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
  fs.renameSync(recordedPath, finalPath);

  logger.info(`[VaultMashup] ✓ Generated mashup short: ${finalPath}`);
  return finalPath;
}

if (require.main === module) {
  (async () => {
    const p1 = await generateVaultMashup('pocket', null, 'mashup_pocket_spotify_apple.webm');
    const p2 = await generateVaultMashup('choir', null, 'mashup_choir_spotify_apple.webm');
    console.log('MASHUPS_READY:', JSON.stringify([p1, p2]));
    process.exit(0);
  })();
}

module.exports = { generateVaultMashup };
