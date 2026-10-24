'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../browser/launcher');
const { randomDelay, randomScroll, simulateMouseMove } = require('../utils/humanBehavior');
const { savePredatorLead } = require('./marketplacePredator');
const logger = require('../utils/logger');

const HIGH_GROWTH_METROS = [
  'Austin, TX',
  'Dallas, TX',
  'Nashville, TN',
  'Phoenix, AZ',
  'Atlanta, GA',
  'Denver, CO',
  'Tampa, FL',
];

const TARGET_TRADES = [
  'custom home builder',
  'framing contractor',
  'general contractor',
  'deck builder',
  'custom cabinetry maker',
];

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Scrape high-intent commercial and custom builders from Google Maps search results.
 *
 * @param {Object} [opts={}]
 * @param {string} [opts.trade]
 * @param {string} [opts.metro]
 * @param {number} [opts.maxResults=10]
 * @returns {Promise<Object>}
 */
async function scrapeGooglePredator(opts = {}) {
  const trade = opts.trade || TARGET_TRADES[Math.floor(Math.random() * TARGET_TRADES.length)];
  const metro = opts.metro || HIGH_GROWTH_METROS[Math.floor(Math.random() * HIGH_GROWTH_METROS.length)];
  const maxResults = opts.maxResults || 10;
  const searchQuery = `${trade} in ${metro}`;

  logger.info(`[GooglePredator] Deploying reconnaissance sweep for: "${searchQuery}" (Quota: ${maxResults})`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const harvestedContractors = [];

  try {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 5000);

    // Dismiss Google consent banner if displayed
    const consentBtn = await page.$('button[aria-label*="Accept all" i], button:has-text("Accept all"), button:has-text("I agree")');
    if (consentBtn) {
      await consentBtn.click().catch(() => {});
      await randomDelay(1500, 3000);
    }

    // Scroll search results panel to load listings
    const resultsPanelSelector = 'div[role="feed"], div[aria-label*="Results for" i]';
    await page.waitForSelector(resultsPanelSelector, { timeout: 15000 }).catch(() => {});

    for (let scroll = 0; scroll < 3; scroll++) {
      await page.evaluate((sel) => {
        const panel = document.querySelector(sel);
        if (panel) panel.scrollBy(0, 1000);
      }, resultsPanelSelector);
      await randomDelay(1500, 3000);
    }

    // Extract listing elements
    const listingLinks = await page.$$eval('a[href*="/maps/place/"]', els =>
      els.map(e => e.href).filter(Boolean)
    ).catch(() => []);

    const uniqueLinks = Array.from(new Set(listingLinks)).slice(0, maxResults);
    logger.info(`[GooglePredator] Identified ${uniqueLinks.length} verified builder targets in ${metro}.`);

    // Inspect each builder's Google profile for direct phone, website, and address
    for (const placeUrl of uniqueLinks) {
      try {
        await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await randomDelay(2000, 4000);

        const pageText = await page.evaluate(() => document.body.innerText || '');
        const title = await page.$eval('h1', el => el.innerText.trim()).catch(() => 'Contractor Firm');

        // Extract phone number from Google Maps place panel
        const phoneMatch = pageText.match(PHONE_REGEX);
        const phone = phoneMatch ? phoneMatch[0] : '';

        // Extract website URL
        const websiteUrl = await page.$eval(
          'a[data-item-id="authority"], a[aria-label*="website" i]',
          el => el.href
        ).catch(() => '');

        // Extract rating & review count
        const ratingMatch = pageText.match(/(\d\.\d)\s*stars|(\d\.\d)\s*\(\d+\)/);
        const rating = ratingMatch ? ratingMatch[1] || ratingMatch[2] : 'N/A';

        // Address
        const addressMatch = pageText.match(/Address:\s*([^·\n]+)|([0-9]+\s+[A-Za-z0-9\s,]+(?:TX|TN|AZ|GA|CO|FL)\s+[0-9]{5})/i);
        const address = addressMatch ? (addressMatch[1] || addressMatch[2]).trim() : metro;

        let email = '';
        // If website exists, make a rapid stealth request to their homepage to harvest direct business email
        if (websiteUrl && websiteUrl.startsWith('http')) {
          try {
            const sitePage = await context.newPage();
            await sitePage.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await randomDelay(1000, 2000);
            const siteText = await sitePage.evaluate(() => document.body.innerText || '');
            const emailMatches = siteText.match(EMAIL_REGEX) || [];
            const cleanEmails = emailMatches.filter(e =>
              !e.match(/example\.com|domain\.com|sentry\.io|wixpress\.com|bootstrap/i)
            );
            if (cleanEmails.length > 0) email = cleanEmails[0];
            await sitePage.close();
          } catch {}
        }

        const leadRecord = {
          businessName: title,
          trade,
          phone,
          email,
          location: `${address} (${metro})`,
          sourceUrl: placeUrl,
          sellerProfileUrl: websiteUrl || placeUrl,
        };

        if (phone || email) {
          savePredatorLead(leadRecord);
          harvestedContractors.push(leadRecord);
          logger.info(`[GooglePredator] 🎯 Harvested WHALE: "${title}" | Phone: ${phone || 'N/A'} | Email: ${email || 'N/A'} | Rating: ${rating}`);
        }

        await randomDelay(2500, 5000);
      } catch (placeErr) {
        logger.debug(`[GooglePredator] Error inspecting place ${placeUrl}: ${placeErr.message}`);
      }
    }

    logger.info(`[GooglePredator] ✓ Sweep complete. Successfully extracted ${harvestedContractors.length} verified builders in ${metro}.`);

    return {
      success: true,
      trade,
      metro,
      harvestedCount: harvestedContractors.length,
      leads: harvestedContractors,
    };

  } catch (err) {
    logger.error(`[GooglePredator] Execution error: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

module.exports = {
  scrapeGooglePredator,
  HIGH_GROWTH_METROS,
  TARGET_TRADES,
};
