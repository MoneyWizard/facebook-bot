'use strict';

require('dotenv').config();
const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadTikTokCookies } = require('../src/actions/tiktok');
const logger = require('../src/utils/logger');

(async () => {
  logger.info('[InspectTikTok] Loading TikTok Studio Upload page...');
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadTikTokCookies(context);
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=creator_center', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(6000);

    const inputs = await page.$$eval('input[type="file"]', els => els.map(e => ({
      accept: e.getAttribute('accept'),
      name: e.getAttribute('name'),
      id: e.id,
      className: e.className
    })));

    logger.info(`Found ${inputs.length} file inputs: ` + JSON.stringify(inputs));

    // Also check frames
    for (const frame of page.frames()) {
      const fInputs = await frame.$$eval('input[type="file"]', els => els.map(e => ({
        accept: e.getAttribute('accept'),
        name: e.getAttribute('name'),
        id: e.id,
        className: e.className
      }))).catch(() => []);
      if (fInputs.length > 0) {
        logger.info(`Found ${fInputs.length} file inputs in frame ${frame.url()}: ` + JSON.stringify(fInputs));
      }
    }

    await page.screenshot({ path: 'logs/tiktok-upload-inspect.png' });
    logger.info('Saved screenshot to logs/tiktok-upload-inspect.png');
    process.exit(0);
  } catch (err) {
    logger.error('Error: ' + err.message);
    process.exit(1);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})();
