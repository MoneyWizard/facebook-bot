'use strict';

const { config } = require('../config');

/**
 * Wait a random amount of milliseconds between min and max.
 * Simulates human reading/thinking time.
 */
async function randomDelay(
  min = config.scraping.delayMin,
  max = config.scraping.delayMax
) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Short delay for between micro-actions (clicks, key presses).
 */
async function microDelay(min = 80, max = 300) {
  return randomDelay(min, max);
}

/**
 * Simulate human-like mouse movement to a random point on the page.
 * @param {import('playwright').Page} page
 */
async function simulateMouseMove(page) {
  try {
    const viewport = page.viewportSize();
    if (!viewport) return;

    const steps = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < steps; i++) {
      const x = Math.floor(Math.random() * viewport.width);
      const y = Math.floor(Math.random() * viewport.height);
      await page.mouse.move(x, y, {
        steps: Math.floor(Math.random() * 10) + 5,
      });
      await microDelay(50, 150);
    }
  } catch {
    // Non-fatal — continue without mouse simulation
  }
}

/**
 * Scroll the page in a human-like pattern (random depth, variable speed).
 * @param {import('playwright').Page} page
 */
async function randomScroll(page) {
  try {
    const scrollSteps = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < scrollSteps; i++) {
      const distance = Math.floor(Math.random() * 400) + 100;
      const direction = Math.random() > 0.15 ? distance : -distance; // mostly scroll down
      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), direction);
      await microDelay(300, 900);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Type text with human-like per-character delays.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 */
async function humanType(page, selector, text) {
  await page.click(selector);
  await microDelay(100, 400);
  for (const char of text) {
    await page.keyboard.type(char);
    await microDelay(40, 180);
  }
}

module.exports = {
  randomDelay,
  microDelay,
  simulateMouseMove,
  randomScroll,
  humanType,
};
