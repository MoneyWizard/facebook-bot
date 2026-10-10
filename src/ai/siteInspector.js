'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const KNOWLEDGE_FILE = path.resolve('./data/site-knowledge.json');

/**
 * Visit https://hexnemesis.com, handle the Gate Page by clicking "Enter" -> navigate to home.html,
 * and crawl all available tools, subpages, headings, and descriptions.
 *
 * @param {string} [siteUrl="https://hexnemesis.com"]
 * @returns {Promise<Object>} Extracted site knowledge base
 */
async function inspectSite(siteUrl = 'https://hexnemesis.com') {
  logger.info(`[SiteInspector] Crawling site knowledge starting at Gate Page: ${siteUrl}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    // 1. Visit Gate Page
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // 2. Click "Enter" button/link to get past the Gate Page to home.html
    const enterSelectors = [
      'a[href*="home"]',
      'a:has-text("Enter")',
      'a:has-text("ENTER")',
      'button:has-text("Enter")',
      'button:has-text("ENTER")',
      'div[role="button"]:has-text("Enter")',
    ];

    let enterBtn = null;
    for (const sel of enterSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible().catch(() => false)) {
        enterBtn = el;
        break;
      }
    }

    if (enterBtn) {
      logger.info('[SiteInspector] Found visible Enter button on Gate Page. Clicking to enter home.html...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        enterBtn.click({ force: true }).catch(() => {}),
      ]);
      await page.waitForTimeout(2000);
    } else {
      logger.info('[SiteInspector] Navigating to main home page: https://hexnemesis.com/home.html...');
      await page.goto('https://hexnemesis.com/home.html', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    logger.info(`[SiteInspector] Now inspecting main application page: ${page.url()}`);

    // 3. Extract detailed content, tools, headings, and descriptions from home.html
    const knowledge = await page.evaluate(() => {
      const getCleanText = (sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((el) => el.innerText.trim())
          .filter(Boolean);

      const title = document.title || 'HexNemesis Automation & AI Suite';
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      const headings = getCleanText('h1, h2, h3, h4, header, .title, .heading');
      const paragraphs = getCleanText('p, .description, .feature-text').slice(0, 15);

      // Collect tool links and navigation items
      const links = Array.from(document.querySelectorAll('a[href], button[onclick], .tool-card'))
        .map((el) => ({
          text: el.innerText.trim(),
          href: el.href || el.getAttribute('onclick') || '',
        }))
        .filter((l) => l.text && l.text.length < 50);

      const bodyText = document.body.innerText.slice(0, 3000);

      return {
        title,
        metaDesc,
        gateUrl: 'https://hexnemesis.com',
        homeUrl: window.location.href,
        headings: Array.from(new Set(headings)),
        paragraphs: Array.from(new Set(paragraphs)),
        toolsAndLinks: links.slice(0, 20),
        bodySummary: bodyText,
        crawledAt: new Date().toISOString(),
      };
    });

    // Save extracted knowledge base locally
    fs.mkdirSync(path.dirname(KNOWLEDGE_FILE), { recursive: true });
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));

    logger.info(`[SiteInspector] Successfully extracted site knowledge from ${knowledge.homeUrl} (${knowledge.headings.length} headings, ${knowledge.toolsAndLinks.length} tools/links)`);
    return knowledge;

  } catch (err) {
    logger.error(`[SiteInspector] Failed to crawl ${siteUrl}: ${err.message}`);
    return loadSiteKnowledge() || {
      title: 'HexNemesis Automation & AI Suite',
      metaDesc: 'Healthcare AI and Technology Tools',
      gateUrl: 'https://hexnemesis.com',
      homeUrl: 'https://hexnemesis.com/home.html',
      headings: ['Automate The World!', 'AI & Automation Tools'],
      paragraphs: ['Explore advanced AI tools, ERD Builder, API Console, and technology services on hexnemesis.com.'],
      toolsAndLinks: [
        { text: 'ERD Builder', href: 'https://hexnemesis.com/erd_builder.html' },
        { text: 'API Console', href: 'https://hexnemesis.com/api-console.html' },
        { text: 'Control Center', href: 'https://hexnemesis.com/control-center' },
        { text: 'HexHub', href: 'https://hexnemesis.com/hexhub' },
        { text: 'Build Factory', href: 'https://hexnemesis.com/build-factory.js' },
      ],
      bodySummary: 'HexNemesis provides advanced technology, build factory, ERD builder, and AI tools.',
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
