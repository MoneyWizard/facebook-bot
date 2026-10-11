'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, randomScroll, humanType } = require('../utils/humanBehavior');
const logger = require('../utils/logger');
const { config } = require('../config');

const SEARCH_URL = (query) =>
  `https://www.facebook.com/search/people/?q=${encodeURIComponent(query)}`;

/**
 * Search Facebook People Search for a given name/query.
 *
 * @param {string} query  Name or search term
 * @param {Object} opts   Optional filters: { location, maxPages }
 * @returns {Promise<Array>} Array of profile stubs { name, url, location, avatarUrl }
 */
async function searchPeople(query, opts = {}) {
  const maxPages = opts.maxPages || config.scraping.maxSearchPages;
  logger.info(`Searching Facebook people: "${query}" (max ${maxPages} pages)`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  await page.route('**/*.{mp4,avi,mov,wmv}', (r) => r.abort());

  try {
    await loadCookies(context);

    await page.goto(SEARCH_URL(query), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);

    await dismissCookieBanner(page);

    // Check for login wall
    const isLoginWall = await page.$('[data-testid="royal_login_form"]') !== null;
    if (isLoginWall) {
      logger.warn('Login required for people search. Load a session cookie file for results.');
      return [];
    }

    let allResults = [];

    for (let pageNum = 0; pageNum < maxPages; pageNum++) {
      logger.debug(`Scraping search results page ${pageNum + 1}`);

      await simulateMouseMove(page);
      await randomScroll(page);
      await randomDelay();

      // Extract visible search result cards using modern Facebook link patterns
      const pageResults = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const excludePatterns = ['/search/', '/messages/', '/notifications/', '/friends/', '/login/', '/policies/', 'accountscenter', 'permalink.php'];

        const profileLinks = anchors.filter((a) => {
          const href = a.href || '';
          const text = a.innerText.trim();
          if (!href.includes('facebook.com/')) return false;
          if (!text || text.length < 2 || text.length > 50) return false;
          if (excludePatterns.some((p) => href.includes(p))) return false;
          // Matches user profile URLs
          return href.includes('/profile.php?id=') || !href.slice(25).includes('/');
        });

        return profileLinks.map((a) => {
          const name = a.innerText.split('\n')[0].trim();
          const url = a.href.split('?')[0].includes('/profile.php') ? a.href.split('&')[0] : a.href.split('?')[0];

          // Check surrounding card element for existing connection indicators
          const card = a.closest('div[role="article"]') || a.closest('div[data-virtualized]') || a.parentElement?.parentElement?.parentElement;
          const cardText = card ? card.innerText : '';
          const isAlreadyConnected = cardText.includes('Friends') || (cardText.includes('Message') && !cardText.includes('Add Friend'));

          return { name, url, isAlreadyConnected, location: null, avatarUrl: null };
        }).filter((r) => r.name && r.url && !r.isAlreadyConnected);
      });

      logger.debug(`Found ${pageResults.length} results on page ${pageNum + 1}`);
      allResults = allResults.concat(pageResults);

      // Try to paginate — scroll to bottom to trigger lazy loading
      const prevCount = allResults.length;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await randomDelay(2500, 5000);

      // If no new results appeared, stop
      const newCount = await page.evaluate(() =>
        document.querySelectorAll('[data-testid="browse-result-content"] div[role="article"]').length
      );
      if (newCount <= prevCount && pageNum > 0) break;
    }

    await saveCookies(context);

    // De-duplicate by URL
    const seen = new Set();
    const unique = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    logger.info(`People search complete: "${query}" → ${unique.length} unique profiles`);
    return unique;

  } catch (err) {
    logger.error(`People search failed: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

async function dismissCookieBanner(page) {
  try {
    const selectors = [
      '[data-cookiebanner="accept_button"]',
      'button[title="Allow all cookies"]',
      'button:has-text("Accept All")',
    ];
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await randomDelay(500, 1200);
        break;
      }
    }
  } catch {}
}

module.exports = { searchPeople };
