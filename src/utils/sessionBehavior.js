'use strict';

const { randomDelay, randomScroll, simulateMouseMove, maybeIdle, thinkingPause, gaussianRandom } = require('./humanBehavior');
const logger = require('./logger');

// ─── Warmup Browsing ──────────────────────────────────────────────────────────

const WARMUP_URLS = [
  'https://www.facebook.com/',
  'https://www.facebook.com/marketplace/',
  'https://www.facebook.com/groups/feed/',
  'https://www.facebook.com/watch/',
  'https://www.facebook.com/friends/',
];

/**
 * Browse 1–3 random Facebook pages before performing a target action.
 * This establishes a "natural" session before doing something that could be flagged.
 *
 * @param {import('playwright').Page} page
 * @param {Object} opts  { steps: number }
 */
async function warmupSession(page, opts = {}) {
  const steps = opts.steps ?? Math.floor(Math.random() * 2) + 1; // 1–2 warmup pages
  const pool = [...WARMUP_URLS].sort(() => Math.random() - 0.5);

  logger.debug(`[Session] Warmup: visiting ${steps} page(s) before action`);

  for (let i = 0; i < steps; i++) {
    const url = pool[i];
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await randomDelay(1500, 3500);
      await simulateMouseMove(page);
      await randomScroll(page);
      await maybeIdle(0.3);
      await randomDelay(1000, 2500);
      logger.debug(`[Session] Warmup page ${i + 1}: ${url}`);
    } catch {
      // Skip failed warmup pages — non-fatal
    }
  }
}

// ─── Daily Action Limiter ─────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const LIMITS_FILE = path.resolve('./data/daily-limits.json');
const DEFAULT_LIMITS = {
  follow: 50,
  unfollow: 50,
  addFriend: 30,
  cancelRequest: 30,
  post: 20,
  like: 50,
  comment: 25,
  scrape: 200,
};

function loadLimits() {
  try {
    if (!fs.existsSync(LIMITS_FILE)) return {};
    return JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveLimits(data) {
  fs.mkdirSync(path.dirname(LIMITS_FILE), { recursive: true });
  fs.writeFileSync(LIMITS_FILE, JSON.stringify(data, null, 2));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-09-21"
}

/**
 * Check whether an action type is still within today's daily limit.
 * Returns true if allowed, false if limit reached.
 *
 * @param {'follow'|'unfollow'|'addFriend'|'cancelRequest'|'scrape'} action
 * @returns {boolean}
 */
function canPerformAction(action) {
  const data = loadLimits();
  const today = getTodayKey();
  const count = data?.[today]?.[action] ?? 0;
  const limit = DEFAULT_LIMITS[action] ?? 50;

  if (count >= limit) {
    logger.warn(`[DailyLimit] "${action}" limit reached (${count}/${limit} today). Skipping.`);
    return false;
  }
  return true;
}

/**
 * Record that an action was performed (increments daily counter).
 *
 * @param {'follow'|'unfollow'|'addFriend'|'cancelRequest'|'scrape'} action
 */
function recordAction(action) {
  const data = loadLimits();
  const today = getTodayKey();
  if (!data[today]) data[today] = {};
  data[today][action] = (data[today][action] ?? 0) + 1;
  saveLimits(data);
}

/**
 * Get today's action counts.
 */
function getTodayCounts() {
  const data = loadLimits();
  return data[getTodayKey()] || {};
}

// ─── Pre-action Random Detour ─────────────────────────────────────────────────

/**
 * Sometimes visit the target profile's feed or friends before taking action.
 * Makes the session look like organic browsing before a social interaction.
 *
 * @param {import('playwright').Page} page
 * @param {string} profileUrl
 */
async function browseProfileBeforeAction(page, profileUrl) {
  const shouldBrowse = Math.random() < 0.6; // 60% chance to browse first
  if (!shouldBrowse) return;

  try {
    // First visit the main profile
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await randomDelay(2000, 5000);
    await simulateMouseMove(page);
    await randomScroll(page);
    await maybeIdle(0.25);

    // Then maybe visit their photos or about page
    const extras = ['/photos', '/about', '/friends'];
    if (Math.random() < 0.4) {
      const tab = extras[Math.floor(Math.random() * extras.length)];
      const base = profileUrl.replace(/\/$/, '');
      await page.goto(`${base}${tab}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await randomDelay(1500, 4000);
      await simulateMouseMove(page);
      await randomScroll(page);
    }

    logger.debug('[Session] Pre-action profile browse complete');
  } catch {
    // Non-fatal — proceed to action anyway
  }
}

// ─── Session Pause Manager ────────────────────────────────────────────────────

/**
 * After N consecutive actions, take a longer "human break".
 * @param {number} actionCount  How many actions have been done this session
 */
async function maybeTakeBreak(actionCount) {
  // Every 5–8 actions, take a 30–120s break
  const breakThreshold = gaussianRandom(6, 2);
  if (actionCount > 0 && actionCount % breakThreshold === 0) {
    const breakMs = gaussianRandom(60000, 25000);
    const clamped = Math.min(Math.max(breakMs, 20000), 180000);
    logger.info(`[Session] Taking a ${Math.round(clamped / 1000)}s break after ${actionCount} actions...`);
    await new Promise((r) => setTimeout(r, clamped));
  }
}

module.exports = {
  warmupSession,
  browseProfileBeforeAction,
  canPerformAction,
  recordAction,
  getTodayCounts,
  maybeTakeBreak,
  DEFAULT_LIMITS,
};
