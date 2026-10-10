'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, microDelay } = require('../utils/humanBehavior');
const { warmupSession, browseProfileBeforeAction, canPerformAction, recordAction } = require('../utils/sessionBehavior');
const logger = require('../utils/logger');

const ADD_FRIEND_TEXTS = ['Add Friend', 'Add as Friend'];
const PENDING_TEXTS = ['Friend Request Sent', 'Cancel Request', 'Pending'];
const FRIENDS_TEXTS = ['Friends', 'Message', 'Unfriend'];

/**
 * Send a friend request to a Facebook profile.
 *
 * @param {string} urlOrUsername  Profile URL or username
 * @returns {Promise<Object>}     { success, action, message }
 *   action: 'request_sent' | 'already_friends' | 'already_requested' | 'not_found' | 'unavailable'
 */
async function addFriend(urlOrUsername) {
  const profileUrl = urlOrUsername.startsWith('http')
    ? urlOrUsername
    : `https://www.facebook.com/${urlOrUsername}`;

  logger.info(`[Action] Add Friend: ${profileUrl}`);

  if (!canPerformAction('addFriend')) {
    return { success: false, action: 'daily_limit', message: 'Daily add friend limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) {
      return { success: false, action: 'no_session', message: 'Load session cookies first.' };
    }

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);
    await dismissCookieBanner(page);

    if (await isLoginWall(page)) {
      return { success: false, action: 'login_required', message: 'Session expired or invalid.' };
    }

    await simulateMouseMove(page);
    await randomDelay(800, 2000);

    // Check if already friends
    const alreadyFriends = await findButtonByText(page, FRIENDS_TEXTS);
    if (alreadyFriends) {
      logger.info('Already friends with this user.');
      return { success: true, action: 'already_friends', message: 'Already friends.', profileUrl };
    }

    // Check if request already pending
    const pendingBtn = await findButtonByText(page, PENDING_TEXTS);
    if (pendingBtn) {
      logger.info('Friend request already pending.');
      return { success: true, action: 'already_requested', message: 'Request already sent.', profileUrl };
    }

    // Find "Add Friend" button
    const addBtn = await findButtonByText(page, ADD_FRIEND_TEXTS);
    if (!addBtn) {
      logger.warn(`"Add Friend" button not found on ${profileUrl}`);
      return {
        success: false,
        action: 'not_found',
        message: 'Add Friend button not found. Profile may have friend requests disabled or be private.',
        profileUrl,
      };
    }

    const btnText = (await addBtn.innerText()).trim();
    logger.info(`Clicking "${btnText}" button...`);

    await addBtn.scrollIntoViewIfNeeded();
    await microDelay(400, 900);
    await addBtn.click();
    await randomDelay(2000, 4000);

    // Verify request was sent — button should now show "Friend Request Sent" or "Cancel Request"
    const confirmBtn = await findButtonByText(page, PENDING_TEXTS);
    const success = confirmBtn !== null;

    await saveCookies(context);

    if (success) {
      recordAction('addFriend');
      const newText = (await confirmBtn.innerText()).trim();
      logger.info(`✓ Friend request sent. Button now shows: "${newText}"`);
      return {
        success: true,
        action: 'request_sent',
        message: `Clicked "${btnText}" → Now shows "${newText}"`,
        profileUrl,
      };
    } else {
      logger.warn('Add Friend clicked but could not confirm request was sent.');
      return {
        success: false,
        action: 'unconfirmed',
        message: 'Button clicked but state could not be confirmed.',
        profileUrl,
      };
    }

  } catch (err) {
    logger.error(`addFriend failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Cancel a pending friend request.
 *
 * @param {string} urlOrUsername
 * @returns {Promise<Object>}
 */
async function cancelFriendRequest(urlOrUsername) {
  const profileUrl = urlOrUsername.startsWith('http')
    ? urlOrUsername
    : `https://www.facebook.com/${urlOrUsername}`;

  logger.info(`[Action] Cancel Friend Request: ${profileUrl}`);

  if (!canPerformAction('cancelRequest')) {
    return { success: false, action: 'daily_limit', message: 'Daily cancel request limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 3500);
    await dismissCookieBanner(page);
    await simulateMouseMove(page);

    const cancelBtn = await findButtonByText(page, PENDING_TEXTS);
    if (!cancelBtn) {
      return { success: false, action: 'no_pending_request', message: 'No pending friend request found.' };
    }

    await cancelBtn.scrollIntoViewIfNeeded();
    await microDelay(300, 700);
    await cancelBtn.click();
    await randomDelay(1000, 2500);

    // Confirm in any popup/dialog
    const confirmOption = await page.$('div[role="menuitem"]:has-text("Cancel Request"), span:has-text("Cancel Request")');
    if (confirmOption) {
      await confirmOption.click();
      await randomDelay(1000, 2000);
    }

    await saveCookies(context);
    logger.info(`✓ Friend request cancelled for ${profileUrl}`);
    return { success: true, action: 'cancelled', message: 'Friend request cancelled.', profileUrl };

  } catch (err) {
    logger.error(`cancelFriendRequest failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Bulk add friends from a list of profile URLs.
 * Includes rate limiting — max N actions per session.
 *
 * @param {string[]} profileUrls     Array of profile URLs
 * @param {Object}   opts            { delayBetween: [min, max], maxPerSession: number }
 * @returns {Promise<Array>}         Results array
 */
async function bulkAddFriends(profileUrls, opts = {}) {
  const delayMin = opts.delayBetween?.[0] ?? 8000;
  const delayMax = opts.delayBetween?.[1] ?? 20000;
  const maxPerSession = opts.maxPerSession ?? 10;

  logger.info(`[Bulk] Add Friend: ${profileUrls.length} profiles, max ${maxPerSession}/session`);

  const results = [];
  const batch = profileUrls.slice(0, maxPerSession);

  for (let i = 0; i < batch.length; i++) {
    const url = batch[i];
    logger.info(`[Bulk] ${i + 1}/${batch.length}: ${url}`);
    try {
      const result = await addFriend(url);
      results.push({ url, ...result });
    } catch (err) {
      results.push({ url, success: false, action: 'error', message: err.message });
    }

    if (i < batch.length - 1) {
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      logger.info(`[Bulk] Waiting ${(delay / 1000).toFixed(1)}s before next action...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const sent = results.filter((r) => r.action === 'request_sent').length;
  logger.info(`[Bulk] Done. ${sent}/${batch.length} requests sent.`);
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findButtonByText(page, texts) {
  for (const text of texts) {
    try {
      const selectors = [
        `div[aria-label="${text}"]`,
        `div[aria-label*="${text}" i]`,
        `div[role="button"]:has-text("${text}")`,
        `button:has-text("${text}")`,
        `span:has-text("${text}")`,
        `a[role="button"]:has-text("${text}")`,
      ];
      for (const sel of selectors) {
        const el = await page.$(sel);
        if (el && await el.isVisible().catch(() => false)) return el;
      }
    } catch {}
  }
  return null;
}

async function dismissCookieBanner(page) {
  try {
    const sels = ['[data-cookiebanner="accept_button"]', 'button[title="Allow all cookies"]'];
    for (const s of sels) { const b = await page.$(s); if (b) { await b.click(); break; } }
  } catch {}
}

async function isLoginWall(page) {
  return (
    (await page.$('[data-testid="royal_login_form"]')) !== null ||
    (await page.$('form[action="/login/"]')) !== null
  );
}

module.exports = { addFriend, cancelFriendRequest, bulkAddFriends };
