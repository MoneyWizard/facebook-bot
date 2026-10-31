'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const logger = require('../src/utils/logger');
const { TRACKS } = require('./generate-music-teaser');

const SHORTS_OUTPUT_DIR = path.resolve('./data/youtube_shorts');

const SAMPLE_CLIPS = [
  'D:/Videos/20250914_153640-CINEMATIC.mp4',
  'D:/Videos/995f53bd544de140d4d3347d5630f8de.mp4',
  'D:/Videos/f17c3415e5de1bf48547b6dd05d7211a.mp4'
];

async function generateShortWithClip(trackKey = 'pocket', clipPath = null, durationMs = 12000) {
  const track = TRACKS[trackKey];
  if (!track) throw new Error(`Unknown track key: ${trackKey}`);

  fs.mkdirSync(SHORTS_OUTPUT_DIR, { recursive: true });

  const chosenClip = clipPath || SAMPLE_CLIPS.find(p => fs.existsSync(p)) || SAMPLE_CLIPS[0];
  if (!fs.existsSync(chosenClip)) {
    throw new Error(`Video clip not found at: ${chosenClip}`);
  }

  const clipUrl = `file:///${chosenClip.replace(/\\/g, '/')}`;
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
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      position: relative;
    }

    /* Video background */
    .bg-video {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.65;
      filter: contrast(1.15) brightness(0.85);
    }

    /* Cinematic vignettes & gradient overlays */
    .vignette {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0.95) 100%);
      z-index: 1;
    }

    .top-bottom-shade {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(to bottom, rgba(5,5,10,0.85) 0%, transparent 20%, transparent 70%, rgba(5,5,10,0.95) 100%);
      z-index: 2;
    }

    /* Main Content Wrapper */
    .content-overlay {
      position: relative;
      z-index: 3;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 70px 40px;
    }

    /* Header Badge */
    .header {
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 10px 28px;
      background: linear-gradient(90deg, ${track.accent}, ${track.subAccent});
      border-radius: 40px;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 3px;
      text-transform: uppercase;
      box-shadow: 0 4px 25px ${track.accent}88;
      border: 1px solid rgba(255,255,255,0.4);
      animation: pulseBadge 2s infinite alternate;
    }

    @keyframes pulseBadge {
      0% { transform: scale(0.96); box-shadow: 0 0 15px ${track.accent}66; }
      100% { transform: scale(1.04); box-shadow: 0 0 30px ${track.accent}cc; }
    }

    /* Artwork showcase card */
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(15, 12, 25, 0.65);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      padding: 30px 25px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.85), 0 0 40px ${track.accent}33;
      width: 100%;
      max-width: 580px;
      animation: floatCard 3.5s ease-in-out infinite alternate;
    }

    @keyframes floatCard {
      0% { transform: translateY(0px); }
      100% { transform: translateY(-10px); }
    }

    .art-img {
      width: 320px;
      height: 320px;
      border-radius: 16px;
      object-fit: cover;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      border: 2px solid rgba(255,255,255,0.2);
    }

    .artist {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: #eaeaea;
      margin-top: 18px;
    }

    .title {
      font-size: 38px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-align: center;
      background: linear-gradient(135deg, #ffffff 40%, ${track.accent} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-top: 6px;
      line-height: 1.15;
    }

    .producer {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #a0a0b0;
      margin-top: 6px;
    }

    /* Equalizer Waveform */
    .equalizer {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 60px;
      margin: 10px 0;
    }
    .eq-bar {
      width: 8px;
      background: linear-gradient(to top, ${track.accent}, #fff);
      border-radius: 4px;
      animation: eqBounce 0.55s ease-in-out infinite alternate;
    }

    @keyframes eqBounce {
      0% { height: 8px; opacity: 0.3; }
      100% { height: 55px; opacity: 1; }
    }

    /* Footer CTAs */
    .footer {
      text-align: center;
      width: 100%;
    }
    .date-alert {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: #fff;
      margin-bottom: 14px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.9);
    }
    .presave-btn {
      display: inline-block;
      padding: 16px 45px;
      background: #ffffff;
      color: #050505;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      border-radius: 50px;
      box-shadow: 0 4px 30px rgba(255,255,255,0.6);
      animation: btnPulse 1.6s infinite alternate;
    }

    @keyframes btnPulse {
      0% { transform: scale(0.97); }
      100% { transform: scale(1.03); box-shadow: 0 8px 35px rgba(255,255,255,0.9); }
    }
  </style>
</head>
<body>
  <video class="bg-video" autoplay loop muted playsinline>
    <source src="${clipUrl}" type="video/mp4">
  </video>
  <div class="vignette"></div>
  <div class="top-bottom-shade"></div>

  <div class="content-overlay">
    <div class="header">
      <div class="badge">🔥 OFFICIAL RELEASE PROMO 🔥</div>
    </div>

    <div class="card">
      <img class="art-img" src="${coverDataUri}" />
      <div class="artist">${track.artist}</div>
      <div class="title">${track.title}</div>
      <div class="producer">PRODUCED BY ${track.producer}</div>
      <div class="equalizer" id="equalizer"></div>
    </div>

    <div class="footer">
      <div class="date-alert">DROPPING ${track.date}</div>
      <div class="presave-btn">PRE-SAVE ON DISTROKID • LINK IN BIO</div>
    </div>
  </div>

  <script>
    const eq = document.getElementById('equalizer');
    for (let i = 0; i < 24; i++) {
      const b = document.createElement('div');
      b.className = 'eq-bar';
      b.style.animationDuration = (0.35 + Math.random() * 0.4).toFixed(2) + 's';
      b.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      eq.appendChild(b);
    }
  </script>
</body>
</html>
`;

  const htmlPath = path.join(SHORTS_OUTPUT_DIR, `${trackKey}_clip_short.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  logger.info(`[ShortsGenerator] Rendering ${durationMs / 1000}s YouTube Short with clip for "${track.title}"...`);

  const browser = await chromium.launch({ headless: true });
  const videoTempDir = path.join(SHORTS_OUTPUT_DIR, `temp_${trackKey}`);
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
  await page.waitForTimeout(durationMs);

  await page.close();
  await context.close();
  await browser.close();

  const files = fs.readdirSync(videoTempDir);
  const recordedVideo = files.find(f => f.endsWith('.webm'));
  if (!recordedVideo) throw new Error('Video record failed in ' + videoTempDir);

  const finalShortPath = path.join(SHORTS_OUTPUT_DIR, `${trackKey}_youtube_short.webm`);
  fs.copyFileSync(path.join(videoTempDir, recordedVideo), finalShortPath);
  fs.rmSync(videoTempDir, { recursive: true, force: true });

  const sizeKB = (fs.statSync(finalShortPath).size / 1024).toFixed(1);
  logger.info(`✓ Successfully rendered YouTube Shorts video with background clip: ${finalShortPath} (${sizeKB} KB)`);

  return {
    shortPath: finalShortPath,
    track,
    clipUsed: chosenClip,
  };
}

module.exports = {
  generateShortWithClip,
  SAMPLE_CLIPS,
};

if (require.main === module) {
  (async () => {
    try {
      const res = await generateShortWithClip('pocket', 'D:/Videos/20250914_153640-CINEMATIC.mp4', 10000);
      console.log('GENERATED_SHORT:', res.shortPath);
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
