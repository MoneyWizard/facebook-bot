'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const KNOWLEDGE_FILE = path.resolve('./data/site-knowledge.json');

/**
 * Visit https://hexnemesis.com using Playwright, crawl its main content, headings,
 * tools, and descriptions, and save the extracted knowledge base to disk.
 *
 * @param {string} [siteUrl="https://hexnemesis.com"]
 * @returns {Promise<Object>} Extracted site knowledge
 */
async function inspectSite(siteUrl = 'https://hexnemesis.com') {
  logger.info(`[SiteInspector] Crawling site knowledge from: ${siteUrl}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract detailed content, tools, headings, and descriptions
    const knowledge = await page.evaluate(() => {
      const getCleanText = (sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((el) => el.innerText.trim())
          .filter(Boolean);

      const title = document.title || '';
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      const headings = getCleanText('h1, h2, h3');
      const paragraphs = getCleanText('p').slice(0, 10);
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ text: a.innerText.trim(), href: a.href }))
        .filter((l) => l.text && l.href.startsWith('http'));

      const bodyText = document.body.innerText.slice(0, 2000);

      return {
        title,
        metaDesc,
        headings,
        paragraphs,
        toolsAndLinks: links.slice(0, 15),
        bodySummary: bodyText,
        crawledAt: new Date().toISOString(),
      };
    });

    // Save extracted knowledge base locally
    fs.mkdirSync(path.dirname(KNOWLEDGE_FILE), { recursive: true });
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));

    logger.info(`[SiteInspector] Successfully extracted site knowledge (${knowledge.headings.length} headings, ${knowledge.toolsAndLinks.length} tools/links)`);
    return knowledge;

  } catch (err) {
    logger.error(`[SiteInspector] Failed to crawl ${siteUrl}: ${err.message}`);
    // Return fallback structure if site is unreachable or timing out
    return loadSiteKnowledge() || {
      title: 'HexNemesis',
      metaDesc: 'Healthcare AI and Technology Tools',
      headings: ['Healthcare AI Tools', 'Automation & Tech Solutions'],
      paragraphs: ['Explore advanced AI tools and technology services on hexnemesis.com.'],
      toolsAndLinks: [],
      bodySummary: 'HexNemesis provides advanced technology and AI tools.',
      crawledAt: new Date().toISOString(),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Load saved site knowledge from disk.
 */
function loadSiteKnowledge() {
  try {
    if (!fs.existsSync(KNOWLEDGE_FILE)) return null;
    return JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { inspectSite, loadSiteKnowledge };
