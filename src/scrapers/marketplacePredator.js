'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, randomScroll, simulateMouseMove } = require('../utils/humanBehavior');
const { dismissOverlays } = require('../utils/sessionBehavior');
const { recordLead } = require('../crm/leadExporter');
const logger = require('../utils/logger');

const PREDATOR_CSV = path.resolve('./data/predator-leads.csv');

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Initialize predator leads CSV if not present.
 */
function initPredatorCsv() {
  if (!fs.existsSync(PREDATOR_CSV)) {
    fs.mkdirSync(path.dirname(PREDATOR_CSV), { recursive: true });
    fs.writeFileSync(
      PREDATOR_CSV,
      'ID,BusinessName,Trade,Phone,Email,Location,SourceUrl,SellerProfileUrl,ExtractedAt,Status\n',
      'utf8'
    );
  }
}

/**
 * Save extracted predator lead to CSV.
 */
function savePredatorLead(lead) {
  initPredatorCsv();
  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
  const row = [
    id,
    `"${(lead.businessName || 'Unknown Contractor').replace(/"/g, '""')}"`,
    `"${(lead.trade || 'General Builder').replace(/"/g, '""')}"`,
    `"${(lead.phone || '').replace(/"/g, '""')}"`,
    `"${(lead.email || '').replace(/"/g, '""')}"`,
    `"${(lead.location || '').replace(/"/g, '""')}"`,
    `"${(lead.sourceUrl || '').replace(/"/g, '""')}"`,
    `"${(lead.sellerProfileUrl || '').replace(/"/g, '""')}"`,
    `"${new Date().toISOString()}"`,
    `"Fresh_Intel"`,
  ].join(',') + '\n';

  fs.appendFileSync(PREDATOR_CSV, row, 'utf8');

  // Also enrich master contractor CRM if profile URL exists
  if (lead.sellerProfileUrl) {
    recordLead({
      name: lead.businessName,
      profileUrl: lead.sellerProfileUrl,
      location: lead.location || 'Marketplace Discovery',
      bio: `[Predator Intel] Phone: ${lead.phone || 'N/A'} | Email: ${lead.email || 'N/A'} | Trade: ${lead.trade}`,
      tier: (lead.phone || lead.email) ? 'WHALE' : 'PRO',
      score: (lead.phone && lead.email) ? 98 : 90,
    });
  }

  return id;
}

/**
 * Scrape Facebook Marketplace contractor listings to harvest phone numbers, emails, and seller profiles.
 *
 * @param {Object} [opts={}]
 * @param {string} [opts.query='carpenter']
 * @param {string} [opts.city='']
 * @param {number} [opts.maxListings=15]
 * @returns {Promise<Object>}
 */
async function scrapeMarketplacePredator(opts = {}) {
  const query = opts.query || 'carpenter framing contractor';
  const maxListings = opts.maxListings || 15;
  logger.info(`[MarketplacePredator] Deploying scraper for: "${query}" (Target: ${maxListings} listings)`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const harvestedLeads = [];

  try {
    await loadCookies(context);
    const searchUrl = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 5000);
    await dismissOverlays(page);

    // Collect listing links
    const listingUrls = new Set();
    for (let scroll = 0; scroll < 4; scroll++) {
      const links = await page.$$eval('a[href*="/marketplace/item/"]', els =>
        els.map(e => e.href.split('?')[0]).filter(Boolean)
      ).catch(() => []);

      links.forEach(l => listingUrls.add(l));
      if (listingUrls.size >= maxListings) break;

      await randomScroll(page);
      await randomDelay(1500, 3000);
    }

    const targets = Array.from(listingUrls).slice(0, maxListings);
    logger.info(`[MarketplacePredator] Found ${targets.length} contractor listings to inspect.`);

    // Inspect each listing for contact intel
    for (const itemUrl of targets) {
      try {
        await page.goto(itemUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await randomDelay(2000, 4000);
        await dismissOverlays(page);

        const pageText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
        const title = await page.title();

        // Extract phones & emails from description text
        const phoneMatches = pageText.match(PHONE_REGEX) || [];
        const emailMatches = pageText.match(EMAIL_REGEX) || [];

        const uniquePhones = Array.from(new Set(phoneMatches));
        const uniqueEmails = Array.from(new Set(emailMatches.filter(e => !e.includes('facebook.com'))));

        // Locate seller profile link
        const sellerProfileUrl = await page.$eval(
          'a[href*="/marketplace/profile/"], a[href*="/user/"], a[href*="facebook.com/profile.php"]',
          el => el.href
        ).catch(() => null);

        // Location text
        const locationMatch = pageText.match(/Location\s*·\s*([^·\n]+)/i);
        const location = locationMatch ? locationMatch[1].trim() : '';

        const lead = {
          businessName: title.replace(/\| Facebook.*$/i, '').trim() || 'Contractor',
          trade: query,
          phone: uniquePhones.join('; '),
          email: uniqueEmails.join('; '),
          location,
          sourceUrl: itemUrl,
          sellerProfileUrl,
        };

        if (lead.phone || lead.email || lead.sellerProfileUrl) {
          savePredatorLead(lead);
          harvestedLeads.push(lead);
          logger.info(`[MarketplacePredator] 🎯 Harvested: ${lead.businessName} | Phone: ${lead.phone || 'None'} | Email: ${lead.email || 'None'}`);
        }

        await randomDelay(3000, 6000);
      } catch (itemErr) {
        logger.debug(`[MarketplacePredator] Error inspecting ${itemUrl}: ${itemErr.message}`);
      }
    }

    await saveCookies(context);
    logger.info(`[MarketplacePredator] ✓ Operation complete. Total enriched leads: ${harvestedLeads.length}`);

    return {
      success: true,
      query,
      harvestedCount: harvestedLeads.length,
      leads: harvestedLeads,
    };

  } catch (err) {
    logger.error(`[MarketplacePredator] Execution error: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

/**
 * Get all predator leads.
 */
function getPredatorLeads() {
  initPredatorCsv();
  try {
    const raw = fs.readFileSync(PREDATOR_CSV, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(l => {
      const cols = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = (cols[idx] || '').replace(/^"|"$/g, '').trim();
      });
      return item;
    });
  } catch {
    return [];
  }
}

module.exports = {
  scrapeMarketplacePredator,
  getPredatorLeads,
  savePredatorLead,
  PREDATOR_CSV,
};
