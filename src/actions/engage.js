'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, randomScroll, humanType, microDelay } = require('../utils/humanBehavior');
const { warmupSession, canPerformAction, recordAction } = require('../utils/sessionBehavior');
const { generateComment } = require('../ai/promoter');
const logger = require('../utils/logger');

/**
 * Like and comment on a specific Facebook post or recent posts on a page/profile.
 *
 * @param {string} postOrProfileUrl - URL of specific post or profile
 * @param {Object} [opts]
 * @param {boolean} [opts.like=true] - Whether to click Like
 * @param {boolean} [opts.comment=true] - Whether to leave an AI comment
 * @param {string} [opts.promoLink="https://hexnemesis.com"] - URL to promote in comments
 * @returns {Promise<Object>} { success, action, message }
 */
async function engageWithContent(postOrProfileUrl, opts = {}) {
  const doLike = opts.like !== false;
  const doComment = opts.comment !== false;
  const promoLink = opts.promoLink || 'https://hexnemesis.com';

  logger.info(`[Action] Engage content: ${postOrProfileUrl} (like=${doLike}, comment=${doComment})`);

  if (doLike && !canPerformAction('like')) {
    return { success: false, action: 'daily_limit', message: 'Daily like limit reached.' };
  }
  if (doComment && !canPerformAction('comment')) {
    return { success: false, action: 'daily_limit', message: 'Daily comment limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) {
      return { success: false, action: 'no_session', message: 'Load session cookies first.' };
    }

    await warmupSession(page);
    await page.goto(postOrProfileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);
    await dismissCookieBanner(page);

    await simulateMouseMove(page);
    await randomScroll(page);
    await randomDelay(1000, 2500);

    let liked = false;
    let commented = false;

    // 1. Perform Like Action
    if (doLike) {
      const likeBtn = await page.$('div[role="button"][aria-label*="Like" i], div[role="button"][aria-label*="React" i], div[role="button"]:has-text("Like"), span:has-text("Like")');
      if (likeBtn) {
        await likeBtn.scrollIntoViewIfNeeded();
        await microDelay(300, 700);
        await likeBtn.click();
        await randomDelay(1500, 3000);
        liked = true;
        recordAction('like');
        logger.info(`✓ Liked content on ${postOrProfileUrl}`);
      } else {
        logger.info('Like button not found (profile may be private or have no public posts).');
      }
    }

    // 2. Perform Comment Action
    if (doComment) {
      // Extract post text to generate contextual response
      const postText = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="post_message"], div[dir="auto"]');
        return el ? el.innerText.slice(0, 300) : 'technology discussion';
      });

      const commentText = await generateComment(postText, promoLink);

      // Find comment input box
      const commentInput = await page.$('div[role="textbox"][aria-label*="comment" i], div[contenteditable="true"][aria-label*="comment" i], div[aria-label*="Write a comment" i]');
      if (commentInput) {
        await commentInput.scrollIntoViewIfNeeded();
        await humanType(page, 'div[role="textbox"][aria-label*="comment" i], div[contenteditable="true"][aria-label*="comment" i], div[aria-label*="Write a comment" i]', commentText);
        await randomDelay(1500, 3000);
        await page.keyboard.press('Enter');
        await randomDelay(3000, 6000);
        commented = true;
        recordAction('comment');
        logger.info(`✓ Left AI comment on ${postOrProfileUrl}`);
      } else {
        logger.info('Comment box not found (comments restricted or profile private).');
      }
    }

    await saveCookies(context);

    return {
      success: true,
      action: (liked || commented) ? 'engaged' : 'restricted_or_no_posts',
      liked,
      commented,
      message: (liked || commented)
        ? `Engagement completed (liked: ${liked}, commented: ${commented}) on ${postOrProfileUrl}`
        : `Checked profile: No public posts or comments restricted by user settings on ${postOrProfileUrl}`,
    };

  } catch (err) {
    logger.error(`engageWithContent failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function dismissCookieBanner(page) {
  try {
    const sels = ['[data-cookiebanner="accept_button"]', 'button[title="Allow all cookies"]'];
    for (const s of sels) { const b = await page.$(s); if (b) { await b.click(); break; } }
  } catch {}
}

module.exports = { engageWithContent };
