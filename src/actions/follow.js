'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, microDelay } = require('../utils/humanBehavior');
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

  const browser = await launchBrowser();
  const context = await createContext(browser);
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
    const followBtn = await findButtonByText(page, FOLLOW_TEXTS);
    if (!followBtn) {
      logger.warn(`Follow button not found on ${profileUrl}`);
      return { success: false, action: 'not_found', message: 'Follow button not found. Profile may be private or already followed.' };
    }

    const btnText = (await followBtn.innerText()).trim();
    logger.info(`Clicking "${btnText}" button...`);

    await followBtn.scrollIntoViewIfNeeded();
    await microDelay(300, 700);
    await followBtn.click();
    await randomDelay(1500, 3000);

    // Verify the action worked — button should now show "Following" or "Requested"
    const confirmBtn = await findButtonByText(page, FOLLOWING_TEXTS);
    const success = confirmBtn !== null;

    await saveCookies(context);

    if (success) {
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
    await context.close();
    await browser.close();
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

  const browser = await launchBrowser();
  const context = await createContext(browser);
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
      // Try multiple selector strategies
      const selectors = [
        `div[role="button"]:has-text("${text}")`,
        `button:has-text("${text}")`,
        `a[role="button"]:has-text("${text}")`,
      ];
      for (const sel of selectors) {
        const el = await page.$(sel);
        if (el) return el;
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

module.exports = { followUser, unfollowUser };
