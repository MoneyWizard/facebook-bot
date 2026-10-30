'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const logger = require('../src/utils/logger');

const OUTPUT_DIR = path.resolve('./data/music_videos');

const TRACKS = {
  pocket: {
    title: 'Pocket Full Of Fucks',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    date: 'NOVEMBER 6, 2026',
    coverArt: path.resolve('./data/release_assets/pocket_full_of_fucks.png'),
    accent: '#ff0055',
    subAccent: '#ff5500',
    tagline: 'PRE-SAVE NOW • LINK IN BIO',
    outputFile: 'pocket_full_of_fucks_teaser.webm',
    tiktokCaption: '🚨 Weldon Giles - "Pocket Full Of Fucks" [Official Single]\nProduced by HexNemesis Productions.\nDropping NOV 6, 2026 on all platforms.\nPre-save link in bio! 🩸\n\n#weldongiles #pocketfulloffucks #hexnemesisproductions #newmusic #distrokid #presave #officialrelease #indiemusic #singlerelease',
  },
  choir: {
    title: 'Too Mean For The Choir',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    date: 'NOVEMBER 13, 2026',
    coverArt: path.resolve('./data/release_assets/too_mean_for_the_choir.png'),
    accent: '#00f0ff',
    subAccent: '#7b00ff',
    tagline: 'PRE-SAVE NOW • LINK IN BIO',
    outputFile: 'too_mean_for_the_choir_teaser.webm',
    tiktokCaption: '🔥 Weldon Giles - "Too Mean For The Choir" [Official Single]\nProduced by HexNemesis Productions.\nDropping NOV 13, 2026 worldwide.\nPre-save link in bio! ⚡\n\n#weldongiles #toomeanforthechoir #hexnemesisproductions #newmusic #distrokid #presavenow #singledrop #indiemusic',
  }
};

async function renderMusicTeaser(trackKey, durationMs = 10000) {
  const track = TRACKS[trackKey];
  if (!track) throw new Error(`Unknown track key: ${trackKey}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const coverBase64 = fs.readFileSync(track.coverArt).toString('base64');
  const coverDataUri = `data:image/png;base64,${coverBase64}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 720px;
      height: 1280px;
      background: radial-gradient(circle at 50% 30%, #1a1020 0%, #0a0610 60%, #020105 100%);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 60px 40px;
      overflow: hidden;
      position: relative;
    }

    /* Ambient pulse glow */
    .glow-bg {
      position: absolute;
      top: 30%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, ${track.accent}33 0%, transparent 70%);
      filter: blur(40px);
      animation: pulse 2.5s ease-in-out infinite alternate;
      z-index: 1;
    }

    @keyframes pulse {
      0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
      100% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
    }

    /* Header */
    .header {
      z-index: 2;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 8px 24px;
      background: linear-gradient(90deg, ${track.accent}, ${track.subAccent});
      border-radius: 30px;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      box-shadow: 0 4px 20px ${track.accent}66;
      animation: badgeGlow 1.8s infinite alternate;
    }

    @keyframes badgeGlow {
      0% { box-shadow: 0 0 10px ${track.accent}55; }
      100% { box-shadow: 0 0 25px ${track.accent}aa; }
    }

    /* Center Artwork Showcase */
    .art-container {
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .art-frame {
      width: 440px;
      height: 440px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 50px rgba(0,0,0,0.8), 0 0 35px ${track.accent}44;
      border: 3px solid rgba(255,255,255,0.15);
      animation: floatArt 3s ease-in-out infinite alternate;
    }
    .art-frame img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    @keyframes floatArt {
      0% { transform: translateY(0px) scale(0.98); }
      100% { transform: translateY(-12px) scale(1.02); }
    }

    /* Track Meta */
    .meta-container {
      z-index: 2;
      text-align: center;
      margin-top: 25px;
    }
    .artist-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #e0e0e0;
      margin-bottom: 6px;
    }
    .song-title {
      font-size: 40px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      background: linear-gradient(135deg, #ffffff 30%, ${track.accent} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
      line-height: 1.1;
    }
    .producer-credit {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #888899;
    }

    /* Audio Equalizer Bars */
    .visualizer {
      z-index: 2;
      display: flex;
      align-items: flex-end;
      gap: 7px;
      height: 70px;
      margin: 15px 0;
    }
    .bar {
      width: 9px;
      background: linear-gradient(to top, ${track.accent}, ${track.subAccent});
      border-radius: 5px;
      animation: bounce 0.6s ease-in-out infinite alternate;
    }

    @keyframes bounce {
      0% { height: 10px; opacity: 0.4; }
      100% { height: 65px; opacity: 1; }
    }

    /* Footer / CTA */
    .footer {
      z-index: 2;
      text-align: center;
    }
    .release-date {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #fff;
      margin-bottom: 10px;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 40px;
      background: #ffffff;
      color: #000;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 2px;
      border-radius: 40px;
      box-shadow: 0 4px 25px rgba(255,255,255,0.4);
      animation: ctaPulse 1.5s infinite alternate;
    }

    @keyframes ctaPulse {
      0% { transform: scale(0.97); }
      100% { transform: scale(1.03); box-shadow: 0 6px 30px rgba(255,255,255,0.7); }
    }
  </style>
</head>
<body>
  <div class="glow-bg"></div>

  <div class="header">
    <div class="badge">🔥 OFFICIAL RELEASE ANNOUNCEMENT 🔥</div>
  </div>

  <div class="art-container">
    <div class="art-frame">
      <img src="${coverDataUri}" />
    </div>
    <div class="meta-container">
      <div class="artist-name">${track.artist}</div>
      <div class="song-title">${track.title}</div>
      <div class="producer-credit">PRODUCED BY ${track.producer}</div>
    </div>
  </div>

  <div class="visualizer" id="visualizer"></div>

  <div class="footer">
    <div class="release-date">DROPPING ${track.date}</div>
    <div class="cta-button">${track.tagline}</div>
  </div>

  <script>
    // Generate dynamic equalizer bars with staggered delays
    const container = document.getElementById('visualizer');
    const barCount = 28;
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      const duration = (0.35 + Math.random() * 0.45).toFixed(2);
      const delay = (Math.random() * 0.5).toFixed(2);
      bar.style.animationDuration = duration + 's';
      bar.style.animationDelay = delay + 's';
      container.appendChild(bar);
    }
  </script>
</body>
</html>
`;

  const htmlPath = path.join(OUTPUT_DIR, `${trackKey}_render.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  logger.info(`[MusicVideoGenerator] Recording ${durationMs / 1000}s video for "${track.title}"...`);

  const browser = await chromium.launch({ headless: true });
  const videoTempDir = path.join(OUTPUT_DIR, `temp_${trackKey}`);
  fs.mkdirSync(videoTempDir, { recursive: true });

  const context = await browser.newContext({
    recordVideo: {
      dir: videoTempDir,
      size: { width: 720, height: 1280 }
    },
    viewport: { width: 720, height: 1280 }
  });

  const page = await context.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });

  // Record for requested duration
  await page.waitForTimeout(durationMs);

  await page.close();
  await context.close();
  await browser.close();

  // Find recorded video in temp dir
  const files = fs.readdirSync(videoTempDir);
  const recordedVideo = files.find(f => f.endsWith('.webm'));
  if (!recordedVideo) {
    throw new Error('Recorded video file not found in ' + videoTempDir);
  }

  const finalVideoPath = path.join(OUTPUT_DIR, track.outputFile);
  fs.copyFileSync(path.join(videoTempDir, recordedVideo), finalVideoPath);

  // Clean temp dir
  fs.rmSync(videoTempDir, { recursive: true, force: true });

  const stats = fs.statSync(finalVideoPath);
  logger.info(`✓ Successfully rendered vertical music teaser: ${finalVideoPath} (${(stats.size / 1024).toFixed(1)} KB)`);

  return {
    videoPath: finalVideoPath,
    track,
  };
}

module.exports = {
  renderMusicTeaser,
  TRACKS,
};

if (require.main === module) {
  (async () => {
    try {
      const pocket = await renderMusicTeaser('pocket', 8000);
      console.log('POCKET_VIDEO:', pocket.videoPath);
      const choir = await renderMusicTeaser('choir', 8000);
      console.log('CHOIR_VIDEO:', choir.videoPath);
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
