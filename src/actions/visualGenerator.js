'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const logger = require('../utils/logger');

const OUTPUT_DIR = path.resolve('./data/generated_visuals');

/**
 * Visual blueprints configuration with crisp architectural SVG blueprints.
 */
const BLUEPRINTS = {
  rafter: {
    title: 'HEXNEMESIS RAFTER MATH ENGINE',
    subtitle: 'Common Rafter Plumb Cut & Birdsmouth Layout',
    pitch: '8 / 12 Pitch (33.69°)',
    specs: [
      { label: 'Total Run', val: "14' - 0\"" },
      { label: 'Total Rise', val: "9' - 4\"" },
      { label: 'Line Length', val: "16' - 9 7/8\"" },
      { label: 'Plumb Cut Angle', val: '33.7°' },
      { label: 'Seat Cut (Level)', val: '56.3°' },
      { label: 'Birdsmouth Seat', val: '3 1/2" (2x4 top plate)' },
      { label: 'Ridge Deduction', val: '3/4" (1.5" ridge board)' },
    ],
    svg: `
      <svg viewBox="0 0 800 450" width="100%" height="320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="neonGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#39ff14" />
            <stop offset="100%" stop-color="#00ffff" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Grid lines -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#162516" stroke-width="1"/>
        </pattern>
        <rect width="800" height="450" fill="url(#grid)" />

        <!-- Wall Top Plate -->
        <rect x="120" y="360" width="70" height="50" fill="#1b2a1c" stroke="#39ff14" stroke-width="2"/>
        <text x="125" y="390" fill="#888" font-size="12" font-family="monospace">2x4 PLATE</text>

        <!-- Ridge Board -->
        <rect x="680" y="60" width="30" height="90" fill="#1b2a1c" stroke="#00ffff" stroke-width="2"/>
        <text x="660" y="50" fill="#00ffff" font-size="12" font-family="monospace">RIDGE BEAM</text>

        <!-- Rafter Main Body -->
        <polygon points="120,360 680,60 695,85 165,395 120,395" fill="rgba(57,255,20,0.12)" stroke="url(#neonGlow)" stroke-width="4" filter="url(#glow)"/>

        <!-- Birdsmouth Cut Notch -->
        <path d="M 120 360 L 165 360 L 165 395" fill="none" stroke="#ff0055" stroke-width="3" stroke-dasharray="4,4"/>
        <text x="175" y="380" fill="#ff0055" font-size="13" font-weight="bold" font-family="monospace">BIRDSMOUTH: 3.5" x 1.5"</text>

        <!-- Overhang Tail -->
        <polygon points="120,360 70,390 85,415 120,395" fill="rgba(57,255,20,0.2)" stroke="#39ff14" stroke-width="2"/>
        <text x="50" y="435" fill="#39ff14" font-size="12" font-family="monospace">12" OVERHANG</text>

        <!-- Dimension Lines -->
        <line x1="120" y1="420" x2="680" y2="420" stroke="#888" stroke-width="1.5" stroke-dasharray="3,3"/>
        <text x="360" y="440" fill="#fff" font-size="14" font-family="monospace">RUN: 14' - 0"</text>

        <!-- Slope Indicator -->
        <polygon points="400,200 460,200 460,160" fill="none" stroke="#ffea00" stroke-width="2"/>
        <text x="420" y="218" fill="#ffea00" font-size="13" font-family="monospace">12</text>
        <text x="470" y="185" fill="#ffea00" font-size="13" font-family="monospace">8</text>
      </svg>
    `
  },
  stairs: {
    title: 'HEXNEMESIS STAIR STRINGER CALCULATOR',
    subtitle: 'Code-Compliant Unit Rise & Run Stringer Geometry',
    pitch: 'IRC Compliant (Max 7 3/4" Rise)',
    specs: [
      { label: 'Total Rise (Floor to Floor)', val: '104 1/2"' },
      { label: 'Unit Rise (14 Risers)', val: '7 7/16"' },
      { label: 'Unit Run (13 Treads)', val: '10 1/2"' },
      { label: 'Total Stringer Run', val: "11' - 4 1/2\"" },
      { label: 'Incline Angle', val: '35.3°' },
      { label: 'Bottom Tread Deduction', val: '1 1/8" (Tread thickness)' },
      { label: 'Headroom Clearance', val: '6\' - 11" (Min 6\'8")' }
    ],
    svg: `
      <svg viewBox="0 0 800 450" width="100%" height="320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cyanGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#00ffff" />
            <stop offset="100%" stop-color="#39ff14" />
          </linearGradient>
          <filter id="glowStairs">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Steps Profile -->
        <path d="M 80 400 
                 L 140 400 L 140 340 
                 L 200 340 L 200 280 
                 L 260 280 L 260 220 
                 L 320 220 L 320 160 
                 L 380 160 L 380 100 
                 L 440 100 L 440 40 
                 L 520 40 L 520 70 
                 L 200 430 L 80 430 Z" 
              fill="rgba(0,255,255,0.15)" stroke="url(#cyanGlow)" stroke-width="4" filter="url(#glowStairs)"/>
        
        <!-- Dimensions on step 2 -->
        <line x1="200" y1="260" x2="260" y2="260" stroke="#ffea00" stroke-width="2"/>
        <text x="210" y="250" fill="#ffea00" font-size="13" font-family="monospace">RUN: 10.5"</text>

        <line x1="270" y1="280" x2="270" y2="220" stroke="#ff0055" stroke-width="2"/>
        <text x="280" y="255" fill="#ff0055" font-size="13" font-family="monospace">RISE: 7 7/16"</text>

        <!-- Throat Dimension -->
        <line x1="260" y1="280" x2="310" y2="345" stroke="#39ff14" stroke-width="2" stroke-dasharray="3,3"/>
        <text x="320" y="325" fill="#39ff14" font-size="12" font-family="monospace">MIN THROAT 5"</text>

        <!-- Floor Line -->
        <line x1="40" y1="400" x2="760" y2="400" stroke="#555" stroke-width="2"/>
        <text x="600" y="425" fill="#888" font-size="13" font-family="monospace">FINISHED FIRST FLOOR</text>

        <!-- Header Connection -->
        <rect x="440" y="40" width="80" height="60" fill="#1b2a1c" stroke="#39ff14" stroke-width="2"/>
        <text x="450" y="75" fill="#39ff14" font-size="12" font-family="monospace">TOP HEADER</text>
      </svg>
    `
  },
  cabinetry: {
    title: 'HEXNEMESIS CABINETRY & PANEL ENGINE',
    subtitle: 'Symmetrical Wainscoting & Face Frame Calculator',
    pitch: 'Finish Carpentry Precision',
    specs: [
      { label: 'Total Wall Span', val: '144" (12 Feet)' },
      { label: 'Total Panels', val: '5 Equal Reveals' },
      { label: 'Stile Width', val: '3 1/2"' },
      { label: 'Rail Height', val: '4 1/2"' },
      { label: 'Calculated Panel Width', val: '22 5/16"' },
      { label: '32mm Shelf Pin Pitch', val: '37mm Front Setback' },
      { label: 'Coping Angle Offset', val: '45.0° Scribe Match' }
    ],
    svg: `
      <svg viewBox="0 0 800 450" width="100%" height="320" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glowCab">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <!-- Wall Outline -->
        <rect x="50" y="60" width="700" height="320" fill="#0d140d" stroke="#222" stroke-width="3"/>
        
        <!-- Baseboard -->
        <rect x="50" y="340" width="700" height="40" fill="#1b2a1c" stroke="#39ff14" stroke-width="2"/>
        <text x="350" y="365" fill="#39ff14" font-size="13" font-family="monospace">5 1/4" BASEBOARD</text>

        <!-- 5 Panels with Stiles -->
        <rect x="75" y="90" width="115" height="230" fill="rgba(57,255,20,0.06)" stroke="#39ff14" stroke-width="2"/>
        <rect x="215" y="90" width="115" height="230" fill="rgba(57,255,20,0.06)" stroke="#39ff14" stroke-width="2"/>
        <rect x="355" y="90" width="115" height="230" fill="rgba(57,255,20,0.06)" stroke="#39ff14" stroke-width="2"/>
        <rect x="495" y="90" width="115" height="230" fill="rgba(57,255,20,0.06)" stroke="#39ff14" stroke-width="2"/>
        <rect x="635" y="90" width="90" height="230" fill="rgba(57,255,20,0.06)" stroke="#39ff14" stroke-width="2"/>

        <line x1="75" y1="75" x2="190" y2="75" stroke="#ffea00" stroke-width="2"/>
        <text x="95" y="68" fill="#ffea00" font-size="12" font-family="monospace">22 5/16"</text>

        <line x1="190" y1="75" x2="215" y2="75" stroke="#00ffff" stroke-width="2"/>
        <text x="185" y="68" fill="#00ffff" font-size="12" font-family="monospace">3.5"</text>

        <text x="250" y="210" fill="#888" font-size="14" font-family="monospace">EQUAL REVEALS &amp; BALANCED STILES</text>
      </svg>
    `
  }
};

/**
 * Generate a high-contrast dark-mode architectural layout card.
 *
 * @param {'rafter'|'stairs'|'cabinetry'} [type='rafter']
 * @returns {Promise<string>} Path to saved PNG image file
 */
async function generateVisualDiagram(type = 'rafter') {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const bp = BLUEPRINTS[type] || BLUEPRINTS.rafter;
  const fileName = `diagram_${type}_${Date.now()}.png`;
  const outputPath = path.join(OUTPUT_DIR, fileName);

  logger.info(`[VisualGenerator] Generating architectural layout card for "${type}"...`);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 1200px;
      background: #060906;
      color: #f0f0f0;
      font-family: 'Rajdhani', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 60px;
      position: relative;
      overflow: hidden;
    }

    /* Ambient neon grid background */
    body::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(circle at 80% 20%, rgba(57, 255, 20, 0.08) 0%, transparent 60%),
                  radial-gradient(circle at 20% 80%, rgba(0, 255, 255, 0.06) 0%, transparent 60%);
      pointer-events: none;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1b2f1b;
      padding-bottom: 30px;
      position: relative;
      z-index: 2;
    }
    .brand {
      font-size: 38px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .brand span {
      color: #39ff14;
      text-shadow: 0 0 15px rgba(57, 255, 20, 0.5);
    }
    .tagline {
      font-size: 19px;
      color: #888;
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge {
      background: rgba(57, 255, 20, 0.12);
      border: 1px solid #39ff14;
      color: #39ff14;
      font-weight: 700;
      font-size: 16px;
      padding: 8px 20px;
      border-radius: 4px;
      letter-spacing: 2px;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Main Blueprint Display */
    .diagram-container {
      background: #090e09;
      border: 1px solid #1f351f;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      position: relative;
      z-index: 2;
    }
    .diagram-title {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
    }
    .diagram-pitch {
      color: #39ff14;
      font-family: 'JetBrains Mono', monospace;
      font-size: 20px;
    }

    /* Spec Grid */
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-top: 25px;
    }
    .spec-card {
      background: #0d160d;
      border: 1px solid #1d331d;
      border-radius: 6px;
      padding: 14px 18px;
    }
    .spec-label {
      font-size: 13px;
      color: #777;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
      margin-bottom: 5px;
    }
    .spec-val {
      font-size: 20px;
      font-weight: 700;
      color: #39ff14;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Footer Banner */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #090e09;
      border: 2px solid #39ff14;
      border-radius: 8px;
      padding: 24px 35px;
      position: relative;
      z-index: 2;
      box-shadow: 0 0 30px rgba(57, 255, 20, 0.15);
    }
    .cta-text {
      font-size: 24px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cta-text span {
      color: #39ff14;
    }
    .cta-url {
      font-size: 22px;
      font-weight: 700;
      color: #000;
      background: #39ff14;
      padding: 12px 28px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 0 0 20px rgba(57, 255, 20, 0.4);
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">HEX<span>NEMESIS</span> // THE ESTATE</div>
      <div class="tagline">Precision Builder Math &amp; Jobsite Layout Software</div>
    </div>
    <div class="badge">FREE WEBSUITE DEMO</div>
  </div>

  <div class="diagram-container">
    <div class="diagram-title">
      <span>${bp.title}</span>
      <span class="diagram-pitch">${bp.pitch}</span>
    </div>
    <div style="margin-top: 15px;">
      ${bp.svg}
    </div>

    <div class="specs-grid">
      ${bp.specs.slice(0, 4).map(s => `
        <div class="spec-card">
          <div class="spec-label">${s.label}</div>
          <div class="spec-val">${s.val}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="footer">
    <div class="cta-text">
      STOP GUESSING CUTS ON SITE. <span>EXECUTE WITH MATHEMATICAL PERFECTION.</span>
    </div>
    <div class="cta-url">HEXNEMESIS.COM</div>
  </div>
</body>
</html>
  `;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: outputPath, type: 'png' });
    logger.info(`[VisualGenerator] ✓ Saved high-resolution blueprint to: ${outputPath}`);
    return outputPath;
  } finally {
    await browser.close();
  }
}

module.exports = { generateVisualDiagram, BLUEPRINTS };
