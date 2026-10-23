'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../browser/launcher');
const logger = require('../utils/logger');

const REELS_OUTPUT_DIR = path.resolve('./data/generated_reels');

const REEL_TEMPLATES = [
  {
    type: 'rafter_speed_cut',
    hook: 'STOP RUINING 2x10s ON COMMON RAFTERS',
    sub: 'Birdsmouth Cut Math In 3 Seconds Flat',
    specs: [
      { label: 'Span', val: '24\' - 0"' },
      { label: 'Pitch', val: '7 / 12' },
      { label: 'Unit Run', val: '12.00"' },
      { label: 'Unit Rise', val: '7.00"' },
      { label: 'Rafter Length', val: '13\' - 11 3/8"' },
      { label: 'Plumb Cut', val: '30.26°' },
      { label: 'Seat Cut', val: '59.74°' },
    ],
    accent: '#00ffff',
  },
  {
    type: 'stair_stringer_geometry',
    hook: 'NEVER FAIL AN IRC STAIR INSPECTION AGAIN',
    sub: 'Exact Riser & Tread Tolerances (IRC 2024)',
    specs: [
      { label: 'Total Rise', val: '108.50" (9\' - 0 1/2")' },
      { label: 'Riser Height', val: '7.23" (7 1/4")' },
      { label: 'Tread Run', val: '10.50"' },
      { label: 'Total Steps', val: '15 Risers / 14 Treads' },
      { label: 'Stringer Throat', val: '5.25" Min' },
      { label: 'Headroom Clearance', val: '80.00" (Pass)' },
    ],
    accent: '#ffb300',
  },
  {
    type: 'cabinetry_overlay_precision',
    hook: 'PERFECT 1/8" REVEALS EVERY SINGLE TIME',
    sub: 'Face Frame & European Hinge Overlay Math',
    specs: [
      { label: 'Opening Width', val: '30.00"' },
      { label: 'Overlay Style', val: '1/2" Partial Overlay' },
      { label: 'Door Width (Pair)', val: '15.44" each' },
      { label: 'Reveal Gap', val: '0.125" (1/8")' },
      { label: 'Cup Bore Offset', val: '3.00mm' },
    ],
    accent: '#ff0055',
  },
];

/**
 * Generate a vertical 9:16 (1080x1920) short-form visual asset tailored for Reels & TikTok.
 *
 * @param {string} [templateType]
 * @returns {Promise<string>} File path to generated image asset
 */
async function generateReelAsset(templateType) {
  if (!fs.existsSync(REELS_OUTPUT_DIR)) {
    fs.mkdirSync(REELS_OUTPUT_DIR, { recursive: true });
  }

  const template = REEL_TEMPLATES.find(t => t.type === templateType) ||
    REEL_TEMPLATES[Math.floor(Math.random() * REEL_TEMPLATES.length)];

  logger.info(`[VideoGenerator] Rendering vertical 9:16 Reel blueprint for "${template.type}"...`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await page.setViewportSize({ width: 1080, height: 1920 });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; }
        body {
          width: 1080px; height: 1920px;
          background: radial-gradient(circle at 50% 20%, #151d2a 0%, #080c14 70%, #03060a 100%);
          color: #ffffff;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 80px 60px;
          position: relative;
        }
        /* Grid blueprint overlay */
        body::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: 
            linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
        }
        .header {
          position: relative;
          z-index: 10;
        }
        .brand-pill {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 14px 28px;
          border-radius: 40px;
          font-size: 24px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: ${template.accent};
          font-weight: 700;
          margin-bottom: 30px;
        }
        .hook-title {
          font-size: 64px;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -1px;
          text-transform: uppercase;
          background: linear-gradient(180deg, #ffffff 30%, #a0aec0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 20px;
        }
        .hook-sub {
          font-size: 32px;
          color: ${template.accent};
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        /* Central Blueprint Graphic Area */
        .diagram-container {
          position: relative;
          z-index: 10;
          background: rgba(10, 16, 26, 0.75);
          border: 2px solid ${template.accent}44;
          border-radius: 28px;
          padding: 50px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 30px ${template.accent}15;
        }
        .specs-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .spec-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          background: rgba(255, 255, 255, 0.03);
          border-left: 6px solid ${template.accent};
          border-radius: 8px;
        }
        .spec-label {
          font-size: 28px;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .spec-val {
          font-size: 38px;
          color: #ffffff;
          font-weight: 800;
          font-family: "SF Mono", monospace;
          text-shadow: 0 0 15px ${template.accent}88;
        }
        /* Footer / Call To Action */
        .footer {
          position: relative;
          z-index: 10;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px;
          text-align: center;
        }
        .cta-btn {
          display: inline-block;
          background: ${template.accent};
          color: #03060a;
          font-size: 36px;
          font-weight: 900;
          padding: 24px 60px;
          border-radius: 50px;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 0 40px ${template.accent}88;
          margin-bottom: 20px;
        }
        .cta-url {
          font-size: 32px;
          color: #ffffff;
          letter-spacing: 2px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand-pill">⚡ HEXNEMESIS PRO BUILDER TOOLS</div>
        <h1 class="hook-title">${template.hook}</h1>
        <div class="hook-sub">📐 ${template.sub}</div>
      </div>

      <div class="diagram-container">
        <div class="specs-grid">
          ${template.specs.map(s => `
            <div class="spec-row">
              <span class="spec-label">${s.label}</span>
              <span class="spec-val">${s.val}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="footer">
        <div class="cta-btn">RUN FREE LAYOUT CALCULATOR</div>
        <div class="cta-url">🔗 hexnemesis.com/home.html</div>
      </div>
    </body>
    </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'networkidle' });

    const fileName = `reel_${template.type}_${Date.now()}.png`;
    const outputPath = path.join(REELS_OUTPUT_DIR, fileName);

    await page.screenshot({ path: outputPath });
    logger.info(`[VideoGenerator] ✓ Saved high-impact 9:16 Reel asset to: ${outputPath}`);

    return outputPath;

  } catch (err) {
    logger.error(`[VideoGenerator] Error rendering reel asset: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

module.exports = {
  generateReelAsset,
  REELS_OUTPUT_DIR,
  REEL_TEMPLATES,
};
