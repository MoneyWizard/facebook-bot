'use strict';

const { launchBrowser, createContext } = require('../src/browser/launcher');
const { loadCookies } = require('../src/browser/cookies');

(async () => {
  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();
  await loadCookies(context, { asPage: false });

  console.log('Checking Personal Profile...');
  await page.goto('https://www.facebook.com/profile.php?id=61584889229860', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(5000);

  // Scroll a bit to load recent timeline posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1500);
  }

  const personalPosts = await page.evaluate(() => {
    const text = document.body.innerText;
    const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }));
    const distrokidLinks = links.filter(l => l.href.includes('distrokid') || l.text.toLowerCase().includes('distrokid') || l.text.toLowerCase().includes('pocket') || l.text.toLowerCase().includes('choir'));
    return {
      distrokidLinks,
      hasPocket: /pocket full of fucks/i.test(text),
      hasChoir: /too mean for the choir/i.test(text),
      snippet: text.slice(0, 4000)
    };
  });
  console.log('PERSONAL_SEARCH:', JSON.stringify(personalPosts, null, 2));

  console.log('Checking Page...');
  await page.goto('https://www.facebook.com/profile.php?id=61588703994992', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForTimeout(5000);

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1500);
  }

  const pagePosts = await page.evaluate(() => {
    const text = document.body.innerText;
    const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }));
    const distrokidLinks = links.filter(l => l.href.includes('distrokid') || l.text.toLowerCase().includes('distrokid') || l.text.toLowerCase().includes('pocket') || l.text.toLowerCase().includes('choir'));
    return {
      distrokidLinks,
      hasPocket: /pocket full of fucks/i.test(text),
      hasChoir: /too mean for the choir/i.test(text),
      snippet: text.slice(0, 4000)
    };
  });
  console.log('PAGE_SEARCH:', JSON.stringify(pagePosts, null, 2));

  await context.close();
  await browser.close();
  process.exit(0);
})();
