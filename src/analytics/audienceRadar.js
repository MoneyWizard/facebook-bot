'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies } = require('../browser/cookies');

const AUDIENCE_FILE = path.resolve('./data/audience-metrics.json');

const DEFAULT_METRICS = {
  personal: {
    name: 'HexNemesis Giles',
    profileId: '61584889229860',
    mode: 'Professional Mode (ACTIVE)',
    followers: 825,
    following: 22,
    directFriends: 42,
    growth28d: '+327 follows (+65.6% surge)',
    views28d: 1388,
  },
  page: {
    name: 'HexNemesis Productions (REMOVED)',
    pageId: '61588703994992',
    status: 'REMOVED',
    followers: 0,
    likes: 0,
  },
  instagram: {
    username: 'hexnemesisproductions (SUSPENDED)',
    userId: '17663459401',
    status: 'SUSPENDED',
    followers: 0,
    following: 0,
    posts: 0,
  },
  totalReach: 825,
  milestoneTarget: 1000,
  milestoneProgress: 82.5,
  lastUpdated: new Date().toISOString(),
  syncStatus: 'synced',
};

function initAudienceMetrics() {
  if (!fs.existsSync(AUDIENCE_FILE)) {
    fs.mkdirSync(path.dirname(AUDIENCE_FILE), { recursive: true });
    fs.writeFileSync(AUDIENCE_FILE, JSON.stringify(DEFAULT_METRICS, null, 2), 'utf8');
  }
}

function getAudienceTelemetry() {
  initAudienceMetrics();
  try {
    const raw = fs.readFileSync(AUDIENCE_FILE, 'utf8');
    const data = JSON.parse(raw);
    // Ensure all critical fields exist
    return {
      ...DEFAULT_METRICS,
      ...data,
      personal: { ...DEFAULT_METRICS.personal, ...(data.personal || {}) },
      page: { ...DEFAULT_METRICS.page, ...(data.page || {}) },
      instagram: { ...DEFAULT_METRICS.instagram, ...(data.instagram || {}) },
    };
  } catch (err) {
    logger.warn(`Failed reading audience metrics file: ${err.message}`);
    return DEFAULT_METRICS;
  }
}

function updateAudienceMetrics(partial) {
  const current = getAudienceTelemetry();
  const updated = {
    ...current,
    ...partial,
    lastUpdated: new Date().toISOString(),
  };
  updated.totalReach = (updated.personal?.followers || 0) + (updated.page?.followers || 0) + (updated.instagram?.followers || 0);
  updated.milestoneProgress = parseFloat(((updated.totalReach / (updated.milestoneTarget || 1000)) * 100).toFixed(1));
  try {
    fs.writeFileSync(AUDIENCE_FILE, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err) {
    logger.error(`Error saving audience metrics: ${err.message}`);
  }
  return updated;
}

let isSyncing = false;

async function syncAudienceLive() {
  if (isSyncing) {
    return { status: 'already_syncing', current: getAudienceTelemetry() };
  }
  isSyncing = true;
  logger.info('[AudienceRadar] Triggering live audience synchronization sweep...');

  updateAudienceMetrics({ syncStatus: 'syncing' });

  let browser;
  let context;
  try {
    const launcher = await launchBrowser();
    browser = launcher.browser;
    context = await createContext(browser, launcher.identity);
    const page = await context.newPage();

    // 1. Personal Profile Recon
    await loadCookies(context, { asPage: false });
    await page.goto('https://www.facebook.com/profile.php?id=61584889229860', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3500);

    const personalData = await page.evaluate(() => {
      const pageText = document.body.innerText;
      let followers = 0;
      let following = 0;
      const name = document.querySelector('h1')?.innerText?.trim() || 'HexNemesis Giles';

      const followersMatch = pageText.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+followers/i);
      if (followersMatch) {
        let raw = followersMatch[1].toUpperCase();
        if (raw.endsWith('K')) followers = Math.round(parseFloat(raw) * 1000);
        else if (raw.endsWith('M')) followers = Math.round(parseFloat(raw) * 1000000);
        else followers = parseInt(raw.replace(/,/g, ''), 10);
      }

      const followingMatch = pageText.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+following/i);
      if (followingMatch) {
        let raw = followingMatch[1].toUpperCase();
        if (raw.endsWith('K')) following = Math.round(parseFloat(raw) * 1000);
        else following = parseInt(raw.replace(/,/g, ''), 10);
      }

      return { name, followers, following };
    });

    const current = getAudienceTelemetry();
    const updated = updateAudienceMetrics({
      personal: {
        ...current.personal,
        name: personalData.name || current.personal.name,
        followers: personalData.followers || current.personal.followers,
        following: personalData.following || current.personal.following,
      },
      page: {
        name: 'HexNemesis Productions (REMOVED)',
        pageId: '61588703994992',
        status: 'REMOVED',
        followers: 0,
        likes: 0,
      },
      instagram: {
        username: 'hexnemesisproductions (SUSPENDED)',
        userId: '17663459401',
        status: 'SUSPENDED',
        followers: 0,
        following: 0,
        posts: 0,
      },
      syncStatus: 'synced',
    });

    logger.info(`[AudienceRadar] Sweep complete: Total Reach = ${updated.totalReach}`);
    return { status: 'success', audience: updated };

  } catch (err) {
    logger.error(`[AudienceRadar] Sweep error: ${err.message}`);
    updateAudienceMetrics({ syncStatus: 'idle' });
    return { status: 'error', error: err.message, current: getAudienceTelemetry() };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    isSyncing = false;
  }
}

module.exports = {
  getAudienceTelemetry,
  updateAudienceMetrics,
  syncAudienceLive,
};
