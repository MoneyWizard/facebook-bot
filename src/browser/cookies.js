'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { config } = require('../config');

const PERSONAL_COOKIE_PATH = path.resolve(config.paths.cookies || './cookies/session.json');
const PAGE_COOKIE_PATH = path.resolve('./cookies/page_session.json');
const PAGE_ID = '61588703994992'; // HexNemesis Productions Page ID

/**
 * Load session cookies from disk and inject them into a browser context.
 * Supports switching dynamically between Personal profile and HexNemesis Productions Page.
 *
 * @param {import('playwright').BrowserContext} context
 * @param {Object} [opts={}]
 * @param {boolean} [opts.asPage=false] - Whether to load the session as HexNemesis Productions Page
 * @param {string} [opts.cookiePath] - Explicit path to cookie file
 * @returns {Promise<boolean>}
 */
async function loadCookies(context, opts = {}) {
  const asPage = Boolean(opts.asPage);
  const targetPath = opts.cookiePath
    ? path.resolve(opts.cookiePath)
    : (asPage && fs.existsSync(PAGE_COOKIE_PATH) ? PAGE_COOKIE_PATH : PERSONAL_COOKIE_PATH);

  if (!fs.existsSync(targetPath)) {
    logger.warn(`No session cookies found at ${targetPath}`);
    return false;
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    let cookies = JSON.parse(raw);

    // If asPage is true, guarantee i_user is present with PAGE_ID
    if (asPage) {
      const hasIUser = cookies.some(c => c.name === 'i_user');
      if (!hasIUser) {
        cookies.push({
          name: 'i_user',
          value: PAGE_ID,
          domain: '.facebook.com',
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: true,
          sameSite: 'None',
        });
      }
    } else {
      // If running personal profile, strip i_user so it acts strictly as the personal user
      cookies = cookies.filter(c => c.name !== 'i_user');
    }

    const formatted = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.facebook.com',
      path: c.path || '/',
      expires: c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure !== undefined ? c.secure : true,
      sameSite: normalizeSameSite(c.sameSite),
    }));

    await context.addCookies(formatted);
    logger.info(`Loaded ${formatted.length} cookies (asPage: ${asPage}) from ${targetPath}`);
    return true;
  } catch (err) {
    logger.error('Failed to load cookies: ' + err.message);
    return false;
  }
}

/**
 * Save the current browser context cookies back to disk.
 * @param {import('playwright').BrowserContext} context
 * @param {Object} [opts={}]
 * @param {boolean} [opts.asPage=false]
 */
async function saveCookies(context, opts = {}) {
  try {
    const asPage = Boolean(opts.asPage);
    const savePath = asPage ? PAGE_COOKIE_PATH : PERSONAL_COOKIE_PATH;
    const cookies = await context.cookies();
    fs.writeFileSync(savePath, JSON.stringify(cookies, null, 2));
    logger.info(`Saved ${cookies.length} cookies (asPage: ${asPage}) to ${savePath}`);
  } catch (err) {
    logger.error('Failed to save cookies: ' + err.message);
  }
}

/**
 * Normalize sameSite values to Playwright's accepted format.
 */
function normalizeSameSite(value) {
  const map = { no_restriction: 'None', lax: 'Lax', strict: 'Strict' };
  if (!value) return 'Lax';
  return map[value.toLowerCase()] || 'Lax';
}

module.exports = { loadCookies, saveCookies, PAGE_ID, PERSONAL_COOKIE_PATH, PAGE_COOKIE_PATH };

