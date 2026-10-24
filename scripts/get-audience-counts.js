'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadCookies } = require('../src/browser/cookies');
const logger = require('../src/utils/logger');

const AUDIENCE_FILE = path.resolve('./data/audience-metrics.json');

async function scrapeAudience() {
  logger.info('=== Starting Live Audience Recon Sweep ===');
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const metrics = {
    personal: {
      name: 'Personal Profile',
      friends: 0,
      followers: 0,
    },
    page: {
      name: 'HexNemesis Productions',
      followers: 0,
      likes: 0,
    },
    instagram: {
      followers: 0,
    },
    totalReach: 0,
    lastUpdated: new Date().toISOString(),
  };

  try {
    // 1. Personal Profile Recon
    logger.info('Probing Personal Profile audience metrics...');
    await loadCookies(context, { asPage: false });
    await page.goto('https://www.facebook.com/me', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);

    const personalData = await page.evaluate(() => {
      const pageText = document.body.innerText;
      let friends = 0;
      let followers = 0;
      let name = document.querySelector('h1')?.innerText?.trim() || 'Personal Profile';

      // Pattern match "X friends" or "X mutual friends"
      const friendsMatch = pageText.match(/([\d,]+)\s+friends/i);
      if (friendsMatch) {
        friends = parseInt(friendsMatch[1].replace(/,/g, ''), 10);
      }

      // Pattern match "X followers"
      const followersMatch = pageText.match(/([\d,]+)\s+followers/i);
      if (followersMatch) {
        followers = parseInt(followersMatch[1].replace(/,/g, ''), 10);
      }

      // Check specific anchor elements if text match didn't catch
      if (!friends) {
        const friendLinks = Array.from(document.querySelectorAll('a[href*="/friends"]'));
        for (const a of friendLinks) {
          const m = a.innerText.match(/([\d,]+)/);
          if (m) {
            friends = parseInt(m[1].replace(/,/g, ''), 10);
            break;
          }
        }
      }

      if (!followers) {
        const followerLinks = Array.from(document.querySelectorAll('a[href*="/followers"]'));
        for (const a of followerLinks) {
          const m = a.innerText.match(/([\d,]+)/);
          if (m) {
            followers = parseInt(m[1].replace(/,/g, ''), 10);
            break;
          }
        }
      }

      return { name, friends, followers, currentUrl: window.location.href };
    });

    metrics.personal.name = personalData.name;
    metrics.personal.friends = personalData.friends;
    metrics.personal.followers = personalData.followers;
    logger.info(`Personal Profile: ${personalData.name} | Friends: ${personalData.friends} | Followers: ${personalData.followers} (${personalData.currentUrl})`);

    // 2. HexNemesis Productions Page Recon
    logger.info('Probing HexNemesis Productions Page audience metrics...');
    await page.goto('https://www.facebook.com/profile.php?id=61588703994992', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);

    const pageData = await page.evaluate(() => {
      const pageText = document.body.innerText;
      let followers = 0;
      let likes = 0;
      let name = document.querySelector('h1')?.innerText?.trim() || 'HexNemesis Productions';

      const followersMatch = pageText.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+followers/i);
      if (followersMatch) {
        let raw = followersMatch[1].toUpperCase();
        if (raw.endsWith('K')) followers = Math.round(parseFloat(raw) * 1000);
        else if (raw.endsWith('M')) followers = Math.round(parseFloat(raw) * 1000000);
        else followers = parseInt(raw.replace(/,/g, ''), 10);
      }

      const likesMatch = pageText.match(/([\d,]+(?:\.\d+)?[KkMm]?)\s+likes/i);
      if (likesMatch) {
        let raw = likesMatch[1].toUpperCase();
        if (raw.endsWith('K')) likes = Math.round(parseFloat(raw) * 1000);
        else if (raw.endsWith('M')) likes = Math.round(parseFloat(raw) * 1000000);
        else likes = parseInt(raw.replace(/,/g, ''), 10);
      }

      return { name, followers, likes };
    });

    metrics.page.name = pageData.name;
    metrics.page.followers = pageData.followers;
    metrics.page.likes = pageData.likes;
    logger.info(`Page: ${pageData.name} | Followers: ${pageData.followers} | Likes: ${pageData.likes}`);

    // Compute total reach
    metrics.totalReach = metrics.personal.friends + metrics.personal.followers + metrics.page.followers + metrics.instagram.followers;

    fs.writeFileSync(AUDIENCE_FILE, JSON.stringify(metrics, null, 2), 'utf8');
    logger.info(`Audience metrics saved successfully: ${JSON.stringify(metrics)}`);

    return metrics;
  } catch (err) {
    logger.error(`Error during audience recon: ${err.message}`);
    // If failed, preserve or initialize fallback
    if (!fs.existsSync(AUDIENCE_FILE)) {
      fs.writeFileSync(AUDIENCE_FILE, JSON.stringify(metrics, null, 2), 'utf8');
    }
    return metrics;
  } finally {
    await context.close();
    await browser.close();
  }
}

if (require.main === module) {
  scrapeAudience().then((res) => {
    console.log('AUDIENCE_RESULT:', JSON.stringify(res));
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { scrapeAudience };
