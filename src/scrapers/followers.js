'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, randomScroll } = require('../utils/humanBehavior');
const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Scrape the followers list of a Facebook profile.
 *
 * @param {string} urlOrUsername  Profile URL or username
 * @param {Object} opts           { maxPages: number }
 * @returns {Promise<Array>}      Array of { name, url, avatarUrl }
 */
async function getFollowers(urlOrUsername, opts = {}) {
  const maxPages = opts.maxPages || 3;
  const baseUrl = urlOrUsername.startsWith('http')
    ? urlOrUsername.replace(/\/$/, '')
    : `https://www.facebook.com/${urlOrUsername}`;

  // Facebook followers tab URL
  const followersUrl = `${baseUrl}/followers`;
  logger.info(`Scraping followers: ${followersUrl}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) {
      logger.warn('No session cookies — followers list requires login.');
    }

    await page.goto(followersUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);
    await dismissCookieBanner(page);

    if (await isLoginWall(page)) {
      logger.warn('Login required to view followers.');
      return [];
    }

    let allFollowers = [];

    for (let i = 0; i < maxPages; i++) {
      logger.debug(`Scraping followers page ${i + 1}`);
      await simulateMouseMove(page);
      await randomScroll(page);
      await randomDelay(1500, 3500);

      const pageFollowers = await page.evaluate(() => {
        const items = Array.from(
          document.querySelectorAll(
            'div[role="listitem"], div[data-visualcompletion="ignore-dynamic"] div[role="article"]'
          )
        );

        return items.map((el) => {
          const linkEl = el.querySelector('a[href*="facebook.com"]');
          const nameEl = el.querySelector('span[dir="auto"]');
          const imgEl = el.querySelector('img');
          return {
            name: nameEl?.innerText?.trim() || null,
            url: linkEl?.href?.split('?')[0] || null,
            avatarUrl: imgEl?.src || null,
          };
        }).filter((f) => f.name && f.url);
      });

      logger.debug(`Found ${pageFollowers.length} followers on page ${i + 1}`);
      allFollowers = allFollowers.concat(pageFollowers);

      // Scroll to trigger infinite load
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(2000, 4000);

      // Check if we loaded new items
      const newCount = await page.evaluate(() =>
        document.querySelectorAll('div[role="listitem"]').length
      );
      if (newCount <= allFollowers.length && i > 0) break;
    }

    await saveCookies(context);

    // De-duplicate
    const seen = new Set();
    const unique = allFollowers.filter((f) => {
      if (!f.url || seen.has(f.url)) return false;
      seen.add(f.url);
      return true;
    });

    logger.info(`Followers scrape complete: ${unique.length} unique followers found`);
    return unique;

  } catch (err) {
    logger.error(`getFollowers failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function dismissCookieBanner(page) {
  try {
    const sels = ['[data-cookiebanner="accept_button"]', 'button[title="Allow all cookies"]'];
    for (const s of sels) { const b = await page.$(s); if (b) { await b.click(); break; } }
  } catch {}
}

async function isLoginWall(page) {
  return (
    (await page.$('[data-testid="royal_login_form"]')) !== null ||
    (await page.$('form[action="/login/"]')) !== null
  );
}

module.exports = { getFollowers };
