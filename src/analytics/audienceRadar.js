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
    mode: 'Professional Mode',
    followers: 567,
    following: 109,
    directFriends: 50,
    growth28d: '+120 follows (+11,900%)',
    views28d: 1388,
  },
  page: {
    name: 'HexNemesis Productions',
    pageId: '61588703994992',
    followers: 48,
    likes: 0,
  },
  instagram: {
    username: 'hexnemesisproductions',
    userId: '17663459401',
    followers: 6,
    following: 63,
    posts: 0,
  },
  totalReach: 621,
  milestoneTarget: 1000,
  milestoneProgress: 62.1,
  lastUpdated: new Date().toISOString(),
  syncStatus: 'idle',
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
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 35000 });
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

    // 2. Facebook Page Recon
    await page.goto('https://www.facebook.com/profile.php?id=61588703994992', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3500);

    const pageData = await page.evaluate(() => {
      const pageText = document.body.innerText;
      let followers = 0;
      let likes = 0;
      const name = document.querySelector('h1')?.innerText?.trim() || 'HexNemesis Productions';

      const followersMatch = pageText.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+followers/i);
      if (followersMatch) {
        let raw = followersMatch[1].toUpperCase();
        if (raw.endsWith('K')) followers = Math.round(parseFloat(raw) * 1000);
        else followers = parseInt(raw.replace(/,/g, ''), 10);
      }

      const likesMatch = pageText.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+likes/i);
      if (likesMatch) {
        let raw = likesMatch[1].toUpperCase();
        if (raw.endsWith('K')) likes = Math.round(parseFloat(raw) * 1000);
        else likes = parseInt(raw.replace(/,/g, ''), 10);
      }

      return { name, followers, likes };
    });

    // 3. Instagram Recon
    let igData = { followers: 6, following: 63, posts: 0 };
    if (fs.existsSync('./cookies/ig_session.json')) {
      try {
        const rawIg = JSON.parse(fs.readFileSync('./cookies/ig_session.json', 'utf8'));
        await context.addCookies(rawIg);
        await page.goto('https://www.instagram.com/hexnemesisproductions/', { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(3000);

        igData = await page.evaluate(() => {
          const text = document.body.innerText;
          let followers = 0;
          let following = 0;
          let posts = 0;

          const followerMatch = text.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+followers/i);
          if (followerMatch) {
            let raw = followerMatch[1].toUpperCase();
            if (raw.endsWith('K')) followers = Math.round(parseFloat(raw) * 1000);
            else followers = parseInt(raw.replace(/,/g, ''), 10);
          }

          const followingMatch = text.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+following/i);
          if (followingMatch) {
            let raw = followingMatch[1].toUpperCase();
            if (raw.endsWith('K')) following = Math.round(parseFloat(raw) * 1000);
            else following = parseInt(raw.replace(/,/g, ''), 10);
          }

          return { followers: followers || 6, following: following || 63, posts };
        });
      } catch (igErr) {
        logger.warn(`Instagram sweep failed: ${igErr.message}`);
      }
    }

    const current = getAudienceTelemetry();
    const updated = updateAudienceMetrics({
      personal: {
        ...current.personal,
        name: personalData.name || current.personal.name,
        followers: personalData.followers || current.personal.followers,
        following: personalData.following || current.personal.following,
      },
      page: {
        ...current.page,
        name: pageData.name || current.page.name,
        followers: pageData.followers || current.page.followers,
        likes: pageData.likes || current.page.likes,
      },
      instagram: {
        ...current.instagram,
        followers: igData.followers || current.instagram.followers,
        following: igData.following || current.instagram.following,
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
