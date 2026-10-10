'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, randomScroll, humanType, microDelay } = require('../utils/humanBehavior');
const { warmupSession, canPerformAction, recordAction } = require('../utils/sessionBehavior');
const { generateComment } = require('../ai/promoter');
const logger = require('../utils/logger');

/**
 * Join a Facebook group.
 *
 * @param {string} groupUrl
 * @returns {Promise<Object>}
 */
async function joinGroup(groupUrl) {
  logger.info(`[Groups] Attempting to join group: ${groupUrl}`);

  if (!canPerformAction('follow')) {
    return { success: false, action: 'daily_limit', message: 'Daily join limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) return { success: false, action: 'no_session', message: 'No cookies loaded.' };

    await warmupSession(page);
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);

    const joinBtn = await page.$('div[aria-label="Join group"], div[role="button"]:has-text("Join group"), div[role="button"]:has-text("Join Group")');
    if (!joinBtn) {
      // Check if already member
      const memberBtn = await page.$('div[role="button"]:has-text("Joined"), div[aria-label="Joined"]');
      if (memberBtn) {
        logger.info('Already a member of this group.');
        return { success: true, action: 'already_joined', message: 'Already a member.', groupUrl };
      }
      return { success: false, action: 'not_found', message: 'Join group button not found.', groupUrl };
    }

    await joinBtn.scrollIntoViewIfNeeded();
    await microDelay(300, 700);
    await joinBtn.click();
    await randomDelay(2500, 5000);

    await saveCookies(context);
    recordAction('follow');

    logger.info(`✓ Successfully submitted join request for group: ${groupUrl}`);
    return { success: true, action: 'requested', message: 'Group join request sent.', groupUrl };

  } catch (err) {
    logger.error(`joinGroup failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Engage with active contractor/carpenter discussion posts inside a Facebook group.
 *
 * @param {string} groupUrl
 * @returns {Promise<Object>}
 */
async function engageGroup(groupUrl) {
  logger.info(`[Groups] Engaging with posts inside group: ${groupUrl}`);

  if (!canPerformAction('comment')) {
    return { success: false, action: 'daily_limit', message: 'Daily group comment limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await warmupSession(page);
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2500, 4500);

    await simulateMouseMove(page);
    await randomScroll(page);
    await randomDelay(1500, 3000);

    // Find the first visible post message in the group feed
    const postText = await page.evaluate(() => {
      const el = document.querySelector('div[dir="auto"][style*="text-align"], div[data-ad-preview="message"]');
      return el ? el.innerText.slice(0, 350) : '';
    });

    if (!postText) {
      logger.warn('[Groups] No post text found in group feed to engage with.');
      return { success: false, action: 'no_posts', message: 'No readable posts found in group.' };
    }

    logger.info(`[Groups] Found group discussion post: "${postText.slice(0, 70)}..."`);
    const commentText = await generateComment(postText, 'https://hexnemesis.com/home.html');

    // Locate comment input box for the post
    const commentBox = await page.$('div[role="textbox"][aria-label*="comment" i], div[contenteditable="true"][aria-label*="comment" i]');
    if (!commentBox) {
      return { success: false, action: 'no_input', message: 'Comment box not found in group post.' };
    }

    await commentBox.scrollIntoViewIfNeeded();
    await humanType(page, 'div[role="textbox"][aria-label*="comment" i], div[contenteditable="true"][aria-label*="comment" i]', commentText);
    await randomDelay(1500, 3000);
    await page.keyboard.press('Enter');
    await randomDelay(3000, 6000);

    await saveCookies(context);
    recordAction('comment');

    logger.info(`✓ Successfully posted expert solution in group: ${groupUrl}`);
    return { success: true, action: 'commented', comment: commentText, groupUrl };

  } catch (err) {
    logger.error(`engageGroup failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = { joinGroup, engageGroup };
