'use strict';

const { config } = require('../config');

// ─── Gaussian / Normal Distribution ──────────────────────────────────────────
// Box-Muller transform: converts uniform random into normal distribution.
// Much more human-like than flat uniform random — most actions cluster near
// the mean, with occasional outliers (like real humans).

function gaussianRandom(mean, stdDev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return Math.round(Math.abs(num * stdDev + mean));
}

/**
 * Gaussian delay clustered around a mean with stddev spread.
 * Falls back to [min, max] clamp so it never goes negative.
 */
async function gaussianDelay(mean, stdDev, min = 200, max = 30000) {
  const ms = Math.min(Math.max(gaussianRandom(mean, stdDev), min), max);
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Main action delay — Gaussian centered around the configured mean.
 * Avg ~4s, most between 1.5s–8s, occasional 10s+ outliers.
 */
async function randomDelay(
  min = config.scraping.delayMin,
  max = config.scraping.delayMax
) {
  const mean = (min + max) / 2;
  const stdDev = (max - min) / 4;
  return gaussianDelay(mean, stdDev, min, max);
}

/**
 * Short micro-delay for between clicks/keypresses.
 * Gaussian centered around 150ms.
 */
async function microDelay(minMs = 60, maxMs = 350) {
  return gaussianDelay((minMs + maxMs) / 2, (maxMs - minMs) / 4, minMs, maxMs);
}

/**
 * Occasionally do nothing for 3–15 seconds — simulates reading / distraction.
 * Called randomly during browsing.
 */
async function maybeIdle(probability = 0.15) {
  if (Math.random() < probability) {
    const idleMs = gaussianRandom(6000, 3000);
    const clamped = Math.min(Math.max(idleMs, 2000), 18000);
    await new Promise((r) => setTimeout(r, clamped));
  }
}

// ─── Bezier Curve Mouse Movement ──────────────────────────────────────────────

/**
 * Cubic Bezier interpolation for natural curved mouse paths.
 * Real mouse movements are never straight lines.
 */
function bezierPoint(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

/**
 * Move the mouse from its current position to (targetX, targetY)
 * along a randomized Bezier curve path.
 *
 * @param {import('playwright').Page} page
 * @param {number} targetX
 * @param {number} targetY
 * @param {Object} opts  { steps, jitter }
 */
async function moveMouse(page, targetX, targetY, opts = {}) {
  try {
    const steps = opts.steps ?? gaussianRandom(22, 8);
    const jitter = opts.jitter ?? true;

    // Current mouse position (approximated — Playwright doesn't expose it)
    const viewport = page.viewportSize() || { width: 1280, height: 800 };
    const startX = Math.random() * viewport.width;
    const startY = Math.random() * viewport.height;

    // Random control points for the curve
    const cp1x = startX + (Math.random() - 0.5) * viewport.width * 0.6;
    const cp1y = startY + (Math.random() - 0.5) * viewport.height * 0.6;
    const cp2x = targetX + (Math.random() - 0.5) * viewport.width * 0.4;
    const cp2y = targetY + (Math.random() - 0.5) * viewport.height * 0.4;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Ease-in-out: slow at start/end, fast in middle
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      let x = bezierPoint(eased, startX, cp1x, cp2x, targetX);
      let y = bezierPoint(eased, startY, cp1y, cp2y, targetY);

      // Add tiny per-step jitter (hand tremor simulation)
      if (jitter) {
        x += (Math.random() - 0.5) * 2;
        y += (Math.random() - 0.5) * 2;
      }

      await page.mouse.move(
        Math.round(Math.max(0, Math.min(x, viewport.width))),
        Math.round(Math.max(0, Math.min(y, viewport.height)))
      );

      // Variable step speed: faster in middle of movement
      const stepDelay = t > 0.2 && t < 0.8 ? gaussianRandom(8, 3) : gaussianRandom(18, 6);
      await new Promise((r) => setTimeout(r, Math.max(2, stepDelay)));
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Move the mouse to a random spot on the page (simulates wandering).
 * @param {import('playwright').Page} page
 */
async function simulateMouseMove(page) {
  try {
    const viewport = page.viewportSize() || { width: 1280, height: 800 };
    const moves = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < moves; i++) {
      const x = Math.floor(Math.random() * viewport.width * 0.9) + viewport.width * 0.05;
      const y = Math.floor(Math.random() * viewport.height * 0.9) + viewport.height * 0.05;
      await moveMouse(page, x, y);
      await microDelay(100, 400);
    }
  } catch {}
}

/**
 * Click an element with a natural Bezier mouse approach + optional pre-hover.
 * @param {import('playwright').Page} page
 * @param {import('playwright').ElementHandle} element
 */
async function humanClick(page, element) {
  try {
    const box = await element.boundingBox();
    if (!box) {
      await element.click();
      return;
    }

    // Target a slightly random point within the element (not always dead center)
    const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
    const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

    // Move to element
    await moveMouse(page, targetX, targetY);
    // Brief hover pause (humans pause before clicking)
    await gaussianDelay(120, 60, 50, 400);
    // Click
    await page.mouse.click(targetX, targetY);
  } catch {
    // Fallback to regular click
    await element.click().catch(() => {});
  }
}

// ─── Realistic Scroll Physics ─────────────────────────────────────────────────

/**
 * Scroll with acceleration + deceleration (ease-in/ease-out physics).
 * Humans don't scroll at constant speed.
 *
 * @param {import('playwright').Page} page
 * @param {Object} opts  { direction: 'down'|'up'|'random', distance: number }
 */
async function randomScroll(page, opts = {}) {
  try {
    const direction = opts.direction || (Math.random() > 0.12 ? 'down' : 'up');
    const totalDistance = opts.distance || gaussianRandom(550, 250);
    const sign = direction === 'down' ? 1 : -1;

    // Break the scroll into micro-steps with eased speed
    const chunks = Math.floor(gaussianRandom(6, 2));
    const chunkSize = Math.round(totalDistance / chunks);

    for (let i = 0; i < chunks; i++) {
      const t = i / chunks;
      // Ease: fast in middle, slow at start/end
      const speedFactor = Math.sin(t * Math.PI) + 0.3;
      const dist = Math.round(chunkSize * speedFactor * sign);

      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'auto' }), dist);
      await new Promise((r) => setTimeout(r, gaussianRandom(60, 25)));
    }

    // Occasionally scroll back up a little (re-reading behavior)
    if (Math.random() < 0.2) {
      await new Promise((r) => setTimeout(r, gaussianRandom(800, 300)));
      const backAmount = Math.round(totalDistance * (0.1 + Math.random() * 0.3));
      await page.evaluate((d) => window.scrollBy({ top: d }), -backAmount * sign);
    }
  } catch {}
}

// ─── Human Typing ─────────────────────────────────────────────────────────────

/**
 * Type text with variable per-character delays, occasional typos + corrections.
 *
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 * @param {Object} opts  { typoRate: 0.03 }
 */
async function humanType(page, selector, text, opts = {}) {
  const typoRate = opts.typoRate ?? 0.03;

  await page.click(selector);
  await microDelay(150, 500);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Occasionally make a typo and correct it
    if (Math.random() < typoRate && char.match(/[a-z]/i)) {
      const adjacentKeys = getAdjacentKey(char);
      await page.keyboard.type(adjacentKeys);
      await new Promise((r) => setTimeout(r, gaussianRandom(200, 80)));
      await page.keyboard.press('Backspace');
      await new Promise((r) => setTimeout(r, gaussianRandom(150, 60)));
    }

    await page.keyboard.type(char);

    // Variable delay — faster for common letter combos, slower after punctuation
    let delay;
    if ('.!?,;:'.includes(char)) {
      delay = gaussianRandom(320, 100); // pause after punctuation
    } else if (' ' === char) {
      delay = gaussianRandom(110, 45);
    } else {
      delay = gaussianRandom(75, 35);
    }
    await new Promise((r) => setTimeout(r, Math.max(20, delay)));
  }
}

// ─── Time-of-Day Awareness ────────────────────────────────────────────────────

/**
 * Returns a delay multiplier based on the current hour (local time).
 * Slower at "odd" hours when real users are less active.
 * Faster during typical browsing hours (9am–10pm).
 */
function getTimeOfDayMultiplier() {
  const hour = new Date().getHours();
  if (hour >= 23 || hour < 6) return 2.0;   // late night — very slow
  if (hour >= 6  && hour < 9) return 1.4;   // early morning
  if (hour >= 9  && hour < 12) return 0.9;  // morning peak
  if (hour >= 12 && hour < 14) return 1.1;  // lunch
  if (hour >= 14 && hour < 18) return 0.95; // afternoon
  if (hour >= 18 && hour < 22) return 0.85; // evening peak
  if (hour >= 22) return 1.5;               // late evening
  return 1.0;
}

/**
 * A full "think and act" pause that combines time-of-day + Gaussian noise.
 */
async function thinkingPause() {
  const base = gaussianRandom(3500, 1500);
  const multiplied = Math.round(base * getTimeOfDayMultiplier());
  await new Promise((r) => setTimeout(r, Math.max(1000, Math.min(multiplied, 25000))));
}

// ─── Misc Helpers ─────────────────────────────────────────────────────────────

function getAdjacentKey(char) {
  const adjacency = {
    q:'w', w:'e', e:'r', r:'t', t:'y', y:'u', u:'i', i:'o', o:'p',
    a:'s', s:'d', d:'f', f:'g', g:'h', h:'j', j:'k', k:'l',
    z:'x', x:'c', c:'v', v:'b', b:'n', n:'m',
  };
  return adjacency[char.toLowerCase()] || char;
}

/**
 * Pick a random integer between min and max (inclusive).
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  gaussianRandom,
  gaussianDelay,
  randomDelay,
  microDelay,
  maybeIdle,
  moveMouse,
  simulateMouseMove,
  humanClick,
  randomScroll,
  humanType,
  thinkingPause,
  getTimeOfDayMultiplier,
  randInt,
};
