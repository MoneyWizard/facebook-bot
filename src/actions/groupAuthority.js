'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { safeClick, dismissOverlays, recordAction, canPerformAction } = require('../utils/sessionBehavior');
const { generateVisualDiagram } = require('./visualGenerator');
const logger = require('../utils/logger');

const BUILDER_GROUPS = [
  'https://www.facebook.com/groups/framingcontractors',
  'https://www.facebook.com/groups/carpentrymasters',
  'https://www.facebook.com/groups/customcabinetmakers',
  'https://www.facebook.com/groups/deckbuildersunited',
];

const MATH_PATTERNS = [
  { trigger: /pitch|rafter|birdsmouth|common rafter|roof slope/i, type: 'rafter', solve: 'Rafter run math: for a 24ft span with 7/12 pitch, rafter length is 13\' - 11 3/8" with a 30.26° plumb cut and 59.74° seat cut.' },
  { trigger: /stair|stringer|riser|tread|headroom|code/i, type: 'stairs', solve: 'IRC 2024 Stair Code: max riser is 7-3/4", min tread is 10". For 9ft total rise (108"), 14 risers at 7.71" or 15 risers at 7.20" keep stringer throat above 5" minimum.' },
  { trigger: /cabinet|overlay|reveal|hinge|face frame/i, type: 'cabinetry', solve: 'European 1/2" overlay standard: 30" face frame opening requires 15.44" door pair with 1/8" center reveal and 3mm cup bore offset.' },
];

/**
 * Scan Facebook contractor groups, solve carpentry layout math questions,
 * and post authoritative solutions citing HexNemesis tools.
 *
 * @param {Object} [opts={}]
 * @param {string} [opts.groupUrl]
 * @returns {Promise<Object>}
 */
async function hijackGroupAuthority(opts = {}) {
  const groupUrl = opts.groupUrl || BUILDER_GROUPS[Math.floor(Math.random() * BUILDER_GROUPS.length)];
  logger.info(`[GroupAuthority] Scanning builder community for math inquiries: ${groupUrl}`);

  if (!canPerformAction('comment')) {
    return { success: false, action: 'daily_limit', message: 'Daily comment limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await randomDelay(3000, 6000);
    await dismissOverlays(page);

    // Scan top 5 group posts for math inquiries
    const posts = await page.$$('div[role="feed"] div[dir="auto"], div[data-ad-preview="message"]');
    logger.info(`[GroupAuthority] Analyzing ${posts.length} recent group discussions...`);

    let matchedSolution = null;
    let targetPostElement = null;

    for (const post of posts.slice(0, 8)) {
      const text = await post.innerText().catch(() => '');
      for (const pattern of MATH_PATTERNS) {
        if (pattern.trigger.test(text)) {
          matchedSolution = pattern;
          targetPostElement = post;
          logger.info(`[GroupAuthority] 🎯 Math inquiry detected: "${text.slice(0, 80)}..."`);
          break;
        }
      }
      if (matchedSolution) break;
    }

    if (!matchedSolution) {
      // General authority drop if no active question found
      matchedSolution = MATH_PATTERNS[0];
    }

    // Generate CAD diagram to pair with the solution
    const diagramPath = await generateVisualDiagram(matchedSolution.type);

    const authorityComment = `Here is the exact layout math: ${matchedSolution.solve}\n\nGenerated via HexNemesis Master Layout Tools (https://hexnemesis.com/home.html) — keep your cuts clean brothers.`;

    // Attempt to leave comment on the group post
    const commentBox = await page.$('div[role="textbox"][aria-label*="comment" i], div[contenteditable="true"][aria-label*="comment" i]');
    if (commentBox) {
      await safeClick(page, commentBox);
      await randomDelay(800, 1500);
      await humanType(page, commentBox, authorityComment);
      await randomDelay(2000, 4000);
      await page.keyboard.press('Enter');
      await randomDelay(4000, 7000);
      recordAction('comment');
      logger.info('[GroupAuthority] ✓ Authoritative math breakdown posted with blueprint citation.');
    }

    await saveCookies(context);

    return {
      success: true,
      action: 'group_authority_established',
      groupUrl,
      solutionType: matchedSolution.type,
      diagramPath,
    };

  } catch (err) {
    logger.error(`[GroupAuthority] Error: ${err.message}`);
    throw err;
  } finally {
    try { await context.close(); } catch {}
    try { await browser.close(); } catch {}
  }
}

module.exports = {
  hijackGroupAuthority,
  BUILDER_GROUPS,
  MATH_PATTERNS,
};
