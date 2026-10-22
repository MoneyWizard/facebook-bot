'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, microDelay } = require('../utils/humanBehavior');
const { warmupSession, browseProfileBeforeAction, canPerformAction, recordAction, safeClick, dismissOverlays } = require('../utils/sessionBehavior');
const logger = require('../utils/logger');

// Button text variations Facebook uses
const FOLLOW_TEXTS = ['Follow', 'Follow Back', 'Follow Page'];
const FOLLOWING_TEXTS = ['Following', 'Requested'];

/**
 * Follow a Facebook profile or page.
 *
 * @param {string} urlOrUsername  Profile URL or username
 * @returns {Promise<Object>}     { success, action, message }
 *   action: 'followed' | 'already_following' | 'requested' | 'not_found'
 */
async function followUser(urlOrUsername) {
  const profileUrl = urlOrUsername.startsWith('http')
    ? urlOrUsername
    : `https://www.facebook.com/${urlOrUsername}`;

  logger.info(`[Action] Follow: ${profileUrl}`);

  if (!canPerformAction('follow')) {
    return { success: false, action: 'daily_limit', message: 'Daily follow limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) {
      return { success: false, action: 'no_session', message: 'Load session cookies first.' };
    }

    // Warmup: browse a couple of FB pages first
    await warmupSession(page);
    // Browse the target profile organically before following
    await browseProfileBeforeAction(page, profileUrl);

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);
    await dismissCookieBanner(page);
    await dismissOverlays(page);

    if (await isLoginWall(page)) {
      return { success: false, action: 'login_required', message: 'Session expired or invalid.' };
    }

    await simulateMouseMove(page);
    await randomDelay(500, 1500);

    // Check if already following
    const alreadyFollowing = await findButtonByText(page, FOLLOWING_TEXTS);
    if (alreadyFollowing) {
      const btnText = await alreadyFollowing.innerText();
      logger.info(`Already following (button shows: "${btnText.trim()}")`);
      return {
        success: true,
        action: btnText.trim().toLowerCase() === 'requested' ? 'requested' : 'already_following',
        message: `Already in state: ${btnText.trim()}`,
      };
    }

    // Find the Follow button
    let followBtn = await findButtonByText(page, FOLLOW_TEXTS);
    if (!followBtn) {
      // Check 3-dots "More" menu
      followBtn = await findInMoreMenu(page, FOLLOW_TEXTS);
    }

    if (!followBtn) {
      // Smart Fallback: Check if "Add Friend" is visible on this personal profile
      const addFriendBtn = await findButtonByText(page, ['Add Friend', 'Add as Friend']);
      if (addFriendBtn) {
        logger.info(`Follow not available, but "Add Friend" is visible on ${profileUrl}. Clicking Add Friend...`);
        await addFriendBtn.scrollIntoViewIfNeeded();
        await microDelay(300, 700);
        await safeClick(page, addFriendBtn);
        await randomDelay(2000, 4000);
        await saveCookies(context);
        recordAction('addFriend');
        return { success: true, action: 'request_sent', message: 'Sent friend request (Follow was not enabled on profile).', profileUrl };
      }

      logger.warn(`Follow/Friend button not found on ${profileUrl}`);
      return { success: false, action: 'not_found', message: 'Follow button not found. Profile may be private or restricted.', profileUrl };
    }

    const btnText = (await followBtn.innerText().catch(() => 'Follow')).trim();
    logger.info(`Clicking "${btnText}" button...`);

    await followBtn.scrollIntoViewIfNeeded().catch(() => {});
    await microDelay(300, 700);
    try {
      await followBtn.click({ timeout: 5000 });
    } catch {
      await followBtn.click({ force: true, timeout: 5000 }).catch(async () => {
        await page.evaluate(el => el.click(), followBtn);
      });
    }
    await randomDelay(1500, 3000);

    // Verify the action worked — button should now show "Following" or "Requested"
    const confirmBtn = await findButtonByText(page, FOLLOWING_TEXTS);
    const success = confirmBtn !== null;

    await saveCookies(context);

    if (success) {
      recordAction('follow');
      const newText = (await confirmBtn.innerText()).trim();
      logger.info(`✓ Followed successfully. Button now shows: "${newText}"`);
      return {
        success: true,
        action: newText.toLowerCase() === 'requested' ? 'requested' : 'followed',
        message: `Clicked "${btnText}" → Now shows "${newText}"`,
        profileUrl,
      };
    } else {
      logger.warn('Follow click sent but could not confirm state change.');
      return { success: false, action: 'unconfirmed', message: 'Button clicked but state unconfirmed.', profileUrl };
    }

  } catch (err) {
    logger.error(`followUser failed: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

/**
 * Unfollow a Facebook profile or page.
 *
 * @param {string} urlOrUsername
 * @returns {Promise<Object>}
 */
async function unfollowUser(urlOrUsername) {
  const profileUrl = urlOrUsername.startsWith('http')
    ? urlOrUsername
    : `https://www.facebook.com/${urlOrUsername}`;

  logger.info(`[Action] Unfollow: ${profileUrl}`);

  if (!canPerformAction('unfollow')) {
    return { success: false, action: 'daily_limit', message: 'Daily unfollow limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);
    await dismissCookieBanner(page);
    await simulateMouseMove(page);

    const followingBtn = await findButtonByText(page, ['Following']);
    if (!followingBtn) {
      return { success: false, action: 'not_following', message: 'Not currently following this profile.' };
    }

    await followingBtn.scrollIntoViewIfNeeded();
    await microDelay(300, 700);
    await followingBtn.click();
    await randomDelay(1000, 2500);

    // Look for "Unfollow" in the dropdown menu that may appear
    const unfollowOption = await page.$('span:has-text("Unfollow"), div[role="menuitem"]:has-text("Unfollow")');
    if (unfollowOption) {
      await unfollowOption.click();
      await randomDelay(1000, 2000);
    }

    await saveCookies(context);

    logger.info(`✓ Unfollow action sent for ${profileUrl}`);
    return { success: true, action: 'unfollowed', message: 'Unfollow action completed.', profileUrl };

  } catch (err) {
    logger.error(`unfollowUser failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
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
        `a[role="button"]:has-text("${text}")`,
      ];
      for (const sel of selectors) {
        const els = await page.$$(sel);
        for (const el of els) {
          if (!await el.isVisible().catch(() => false)) continue;
          const elText = (await el.innerText().catch(() => '')).trim();
          const ariaLabel = (await el.getAttribute('aria-label').catch(() => ''))?.trim() || '';

          // Filter out static counter strings like "Followed by 4.9K"
          if (/followed by/i.test(elText) || /followed by/i.test(ariaLabel)) continue;
          if (/followers/i.test(elText) || (/following/i.test(elText) && text !== 'Following')) continue;

          return el;
        }
      }
    } catch {}
  }
  return null;
}

async function findInMoreMenu(page, texts) {
  try {
    const moreBtnSelectors = [
      'div[aria-label="See options"]',
      'div[aria-label="More"]',
      'div[aria-label*="options" i]',
      'div[aria-label*="Actions for" i]',
    ];
    for (const sel of moreBtnSelectors) {
      const moreBtn = await page.$(sel);
      if (moreBtn && await moreBtn.isVisible().catch(() => false)) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
        for (const text of texts) {
          const item = await page.$(`div[role="menuitem"]:has-text("${text}"), span:has-text("${text}")`);
          if (item && await item.isVisible().catch(() => false)) {
            return item;
          }
        }
      }
    }
  } catch {}
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

module.exports = { followUser, unfollowUser };
