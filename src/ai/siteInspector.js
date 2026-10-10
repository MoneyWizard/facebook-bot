'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const KNOWLEDGE_FILE = path.resolve('./data/site-knowledge.json');

/**
 * Visit https://hexnemesis.com/home.html directly, scroll through the Digital Tool Vault,
 * extract all carpenter/builder software items, headings, links, and tool cards.
 *
 * @param {string} [siteUrl="https://hexnemesis.com/home.html"]
 * @returns {Promise<Object>} Extracted site knowledge base
 */
async function inspectSite(siteUrl = 'https://hexnemesis.com/home.html') {
  logger.info(`[SiteInspector] Deep crawling Digital Tool Vault & main homepage: ${siteUrl}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    // 1. Navigate directly to home.html (the Digital Tool Vault)
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 2. Scroll through home.html to load dynamic cards/tools
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    // 3. Extract all Digital Tool Vault items, headings, software cards, and copy
    const knowledge = await page.evaluate(() => {
      const getCleanText = (sel) =>
        Array.from(document.querySelectorAll(sel))
          .map((el) => el.innerText.trim())
          .filter(Boolean);

      const title = document.title || 'HexNemesis Digital Tool Vault & Builder Software';
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      // All headings across the homepage & vault
      const headings = getCleanText('h1, h2, h3, h4, h5, header, .title, .heading, .vault-header');

      // Extract tool/software card titles & descriptions (Digital Tool Vault items)
      const toolCards = Array.from(
        document.querySelectorAll(
          '.card, .tool-card, .vault-card, .software-card, .tool, .item, .feature, [data-tool], article, section'
        )
      ).map((card) => {
        const name = card.querySelector('h1, h2, h3, h4, .title, strong, b')?.innerText?.trim() || '';
        const desc = card.querySelector('p, .description, span')?.innerText?.trim() || '';
        const link = card.querySelector('a[href]')?.href || '';
        return { name, desc, link };
      }).filter((t) => t.name || t.desc);

      // Paragraphs & general copy
      const paragraphs = getCleanText('p, .description, .feature-text, .vault-item').slice(0, 20);

      // All links on the homepage
      const links = Array.from(document.querySelectorAll('a[href], button[onclick]'))
        .map((el) => ({
          text: el.innerText.trim(),
          href: el.href || el.getAttribute('onclick') || '',
        }))
        .filter((l) => l.text && l.text.length < 60);

      const fullText = document.body.innerText.slice(0, 4000);

      return {
        title,
        metaDesc,
        homeUrl: window.location.href,
        headings: Array.from(new Set(headings)),
        toolCards: toolCards.slice(0, 25),
        paragraphs: Array.from(new Set(paragraphs)),
        toolsAndLinks: links.slice(0, 30),
        bodySummary: fullText,
        crawledAt: new Date().toISOString(),
      };
    });

    // Save extracted knowledge base locally
    fs.mkdirSync(path.dirname(KNOWLEDGE_FILE), { recursive: true });
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));

    logger.info(
      `[SiteInspector] Extracted Digital Tool Vault knowledge (${knowledge.toolCards.length} software cards, ${knowledge.headings.length} headings, ${knowledge.toolsAndLinks.length} links)`
    );
    return knowledge;

  } catch (err) {
    logger.error(`[SiteInspector] Failed to crawl ${siteUrl}: ${err.message}`);
    return loadSiteKnowledge() || {
      title: 'HexNemesis Digital Tool Vault & Carpenter/Builder Software',
      metaDesc: 'Digital Tool Vault featuring Carpenter & Builder Software Tools',
      homeUrl: 'https://hexnemesis.com/home.html',
      headings: ['Automate The World!', 'Digital Tool Vault', 'Carpenter & Builder Software'],
      paragraphs: ['Explore the Digital Tool Vault on hexnemesis.com featuring carpenter and builder software.'],
      toolCards: [
        { name: 'Carpenter & Builder Software Tools', desc: 'Latest construction and builder software suite', link: 'https://hexnemesis.com/home.html' },
        { name: 'ERD Builder', desc: 'Entity Relationship Diagram builder', link: 'https://hexnemesis.com/erd_builder.html' },
        { name: 'Build Factory', desc: 'Automated software construction factory', link: 'https://hexnemesis.com/build-factory.js' },
      ],
      toolsAndLinks: [],
      bodySummary: 'HexNemesis Digital Tool Vault with Carpenter & Builder software.',
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
