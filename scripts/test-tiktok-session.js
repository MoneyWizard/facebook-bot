'use strict';

require('dotenv').config();
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadTikTokCookies, saveTikTokCookies } = require('../src/actions/tiktok');
const logger = require('../src/utils/logger');

(async () => {
  logger.info('[TestTikTok] Launching browser to verify TikTok session...');
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const loaded = await loadTikTokCookies(context);
    logger.info(`[TestTikTok] Cookies loaded: ${loaded}`);

    await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);

    const title = await page.title();
    const currentUrl = page.url();
    logger.info(`[TestTikTok] TikTok Home Title: "${title}", URL: ${currentUrl}`);

    // Check for user avatar or profile link
    const profileLink = await page.$('a[href*="/@"], div[data-e2e="profile-icon"], img[class*="avatar"]');
    const loginBtn = await page.$('button:has-text("Log in"), button[data-e2e="top-login-button"]');

    if (profileLink && !loginBtn) {
      logger.info('✓ TikTok session is ACTIVE and AUTHENTICATED!');
    } else if (loginBtn) {
      logger.warn('TikTok returned Login button — session may need additional verification or refresh.');
    }

    // Now test creator-center upload page
    await page.goto('https://www.tiktok.com/creator-center/upload?from=creator_center', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(5000);
    const creatorUrl = page.url();
    logger.info(`[TestTikTok] Creator Center URL: ${creatorUrl}`);

    await page.screenshot({ path: 'logs/tiktok-auth-status.png' });
    logger.info('Screenshot saved to logs/tiktok-auth-status.png');

    await saveTikTokCookies(context);
    process.exit(0);
  } catch (err) {
    logger.error(`[TestTikTok] Error: ${err.message}`);
    process.exit(1);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})();
