'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { config } = require('../config');

const COOKIE_PATH = path.resolve(config.paths.cookies);

/**
 * Load session cookies from disk and inject them into a browser context.
 * This is the recommended approach — log in manually once, export cookies,
 * then reuse the session without triggering automated login detection.
 *
 * HOW TO EXPORT YOUR COOKIES:
 * 1. Install the "Cookie-Editor" Chrome extension:
 *    → https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
 * 2. Log in to Facebook in Chrome normally.
 * 3. Click the Cookie-Editor extension icon.
 * 4. Click "Export" → "Export as JSON".
 * 5. Save the file as: cookies/session.json  (in this project directory)
 * 6. Run the bot — it will inject your session automatically.
 *
 * @param {import('playwright').BrowserContext} context
 * @returns {boolean} true if cookies were loaded, false if no cookie file found
 */
async function loadCookies(context) {
  if (!fs.existsSync(COOKIE_PATH)) {
    logger.warn(
      'No session cookies found at ' + COOKIE_PATH + '\n' +
      '  → The bot will run as a logged-out user (limited data access).\n' +
      '  → See README.md for cookie export instructions.'
    );
    return false;
  }

  try {
    const raw = fs.readFileSync(COOKIE_PATH, 'utf8');
    const cookies = JSON.parse(raw);

    // Playwright expects cookies in a specific format
    const formatted = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.facebook.com',
      path: c.path || '/',
      expires: c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || true,
      sameSite: normalizeSameSite(c.sameSite),
    }));

    await context.addCookies(formatted);
    logger.info(`Loaded ${formatted.length} session cookies from ${COOKIE_PATH}`);
    return true;
  } catch (err) {
    logger.error('Failed to load cookies: ' + err.message);
    return false;
  }
}

/**
 * Save the current browser context cookies back to disk.
 * Useful for refreshing the session after browsing.
 * @param {import('playwright').BrowserContext} context
 */
async function saveCookies(context) {
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    logger.info(`Saved ${cookies.length} cookies to ${COOKIE_PATH}`);
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

module.exports = { loadCookies, saveCookies };
