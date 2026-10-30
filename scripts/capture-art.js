'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser, createContext } = require('../src/browser/launcher');

(async () => {
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const mediaDir = path.resolve('./data/release_assets');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  console.log('Visiting Too Mean For The Choir...');
  await page.goto('https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const choirImg = await page.$('.hfd-hero-art, #albumArt, img[alt*="cover art"]');
  if (choirImg) {
    const choirPath = path.join(mediaDir, 'too_mean_for_the_choir.png');
    await choirImg.screenshot({ path: choirPath });
    console.log('✓ Captured Choir cover art:', choirPath, '(Size:', fs.statSync(choirPath).size, 'bytes)');
  }

  console.log('Visiting Pocket Full Of Fucks...');
  await page.goto('https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const pocketImg = await page.$('.hfd-hero-art, #albumArt, img[alt*="cover art"]');
  if (pocketImg) {
    const pocketPath = path.join(mediaDir, 'pocket_full_of_fucks.png');
    await pocketImg.screenshot({ path: pocketPath });
    console.log('✓ Captured Pocket cover art:', pocketPath, '(Size:', fs.statSync(pocketPath).size, 'bytes)');
  }

  await context.close();
  await browser.close();
  console.log('✓ HIGH RES ARTWORK CAPTURED CLEANLY.');
})();
