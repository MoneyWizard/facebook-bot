'use strict';

require('dotenv').config();
const { launchBrowser, createContext } = require('../src/browser/launcher');
const logger = require('../src/utils/logger');

(async () => {
  logger.info('[RedditRecon] Testing Playwright navigation on Reddit...');
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await page.goto('https://www.reddit.com/r/Carpentry/new/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);
    const title = await page.title();
    logger.info(`Page title: "${title}"`);

    const posts = await page.$$eval('a[slot="title"], [data-testid="post-title"], h3, a[href*="/comments/"]', els => {
      return els.map(e => ({
        text: e.innerText?.trim(),
        href: e.getAttribute('href')
      })).filter(p => p.text && p.text.length > 5).slice(0, 5);
    });

    console.log('EXTRACTED_POSTS:', JSON.stringify(posts, null, 2));
    process.exit(0);
  } catch (err) {
    logger.error('Error: ' + err.message);
    process.exit(1);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})();
