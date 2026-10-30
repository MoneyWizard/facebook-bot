'use strict';

const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadCookies } = require('../src/browser/cookies');

(async () => {
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();
  await loadCookies(context, { asPage: false });

  console.log('Navigating to Activity Log...');
  await page.goto('https://www.facebook.com/me/allactivity?activity_history=false&category_key=POSTS', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(5000);

  const text = await page.evaluate(() => document.body.innerText);
  console.log('ACTIVITY_LOG_SNIPPET:', text.slice(0, 3000));

  await context.close();
  await browser.close();
  process.exit(0);
})();
