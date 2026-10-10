'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { warmupSession, canPerformAction, recordAction } = require('../utils/sessionBehavior');
const logger = require('../utils/logger');

/**
 * Automatically create a dedicated Facebook Business/Creator Page for HexNemesis.
 *
 * @param {Object} [opts]
 * @param {string} [opts.name="HexNemesis Builder Tools"]
 * @param {string} [opts.category="Software"]
 * @param {string} [opts.bio="Digital Toolroom featuring precision calculators for carpenters, framers, and builders."]
 * @param {string} [opts.website="https://hexnemesis.com/home.html"]
 * @returns {Promise<Object>}
 */
async function createPage(opts = {}) {
  const name = opts.name || 'HexNemesis Builder Tools';
  const category = opts.category || 'Software';
  const bio = opts.bio || 'Digital Toolroom featuring precision calculators for carpenters, framers, and builders: https://hexnemesis.com/home.html';

  logger.info(`[Community] Creating Facebook Page: "${name}"`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) return { success: false, action: 'no_session', message: 'No cookies loaded.' };

    await warmupSession(page);
    await page.goto('https://www.facebook.com/pages/create/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2500, 4500);

    // Page Name Input
    const nameInput = 'input[aria-label*="Page name" i], input[aria-label*="Page Name" i], input[name="page_name"]';
    if (await page.$(nameInput)) {
      await humanType(page, nameInput, name);
      await randomDelay(1000, 2000);
    }

    // Category Input
    const catInput = 'input[aria-label*="Category" i], input[aria-label*="category" i]';
    if (await page.$(catInput)) {
      await humanType(page, catInput, category);
      await randomDelay(1500, 2500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await randomDelay(1000, 2000);
    }

    // Bio Textarea
    const bioInput = 'textarea[aria-label*="Bio" i], textarea[aria-label*="bio" i]';
    if (await page.$(bioInput)) {
      await humanType(page, bioInput, bio);
      await randomDelay(1000, 2000);
    }

    // Click "Create Page" button
    const createBtn = await page.$('div[aria-label*="Create Page" i], div[role="button"]:has-text("Create Page"), div[role="button"]:has-text("Create page")');
    if (createBtn) {
      await createBtn.scrollIntoViewIfNeeded();
      await microDelay(300, 700);
      await createBtn.click();
      await randomDelay(5000, 8000);
      logger.info(`✓ Successfully submitted Page creation for: "${name}"`);
    }

    await saveCookies(context);
    return { success: true, action: 'page_created', name, url: page.url() };

  } catch (err) {
    logger.error(`createPage error: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Automatically create a dedicated Facebook Group (Community / Lead Magnet).
 *
 * @param {Object} [opts]
 * @param {string} [opts.name="Carpenters & Contractors Precision Tools Hub"]
 * @param {string} [opts.privacy="Public"]
 * @returns {Promise<Object>}
 */
async function createGroup(opts = {}) {
  const name = opts.name || 'Carpenters & Builders Precision Tools Hub';

  logger.info(`[Community] Creating Facebook Group: "${name}"`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await warmupSession(page);
    await page.goto('https://www.facebook.com/groups/create/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2500, 4500);

    // Group Name Input
    const nameInput = 'input[aria-label*="Group name" i], input[aria-label*="Group Name" i]';
    if (await page.$(nameInput)) {
      await humanType(page, nameInput, name);
      await randomDelay(1500, 2500);
    }

    // Choose Privacy (Public)
    const privacyBtn = await page.$('div[aria-label*="Choose privacy" i], div[role="combobox"]');
    if (privacyBtn) {
      await privacyBtn.click();
      await randomDelay(1000, 2000);
      const publicOption = await page.$('div[role="option"]:has-text("Public"), span:has-text("Public")');
      if (publicOption) await publicOption.click();
      await randomDelay(1000, 2000);
    }

    // Click "Create" button
    const createBtn = await page.$('div[aria-label="Create"], div[role="button"]:has-text("Create")');
    if (createBtn) {
      await createBtn.scrollIntoViewIfNeeded();
      await microDelay(300, 700);
      await createBtn.click();
      await randomDelay(5000, 9000);
      logger.info(`✓ Successfully created Group: "${name}"`);
    }

    await saveCookies(context);
    return { success: true, action: 'group_created', name, url: page.url() };

  } catch (err) {
    logger.error(`createGroup error: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Automatically invite your newly added contractor friends into your own Facebook Group.
 *
 * @param {string} groupUrl
 * @param {number} [maxInvites=20]
 * @returns {Promise<Object>}
 */
async function inviteFriendsToGroup(groupUrl, maxInvites = 20) {
  logger.info(`[Community] Inviting friends to group: ${groupUrl}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadCookies(context);
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2500, 4500);

    // Click "Invite" button
    const inviteBtn = await page.$('div[aria-label="Invite"], div[role="button"]:has-text("Invite")');
    if (!inviteBtn) {
      return { success: false, action: 'not_found', message: 'Invite button not found in group.' };
    }

    await inviteBtn.click();
    await randomDelay(2000, 3500);

    // Select friend checkboxes in invite modal
    const checkboxes = await page.$$('div[role="dialog"] input[type="checkbox"], div[role="dialog"] div[role="checkbox"]');
    let invitedCount = 0;

    for (const box of checkboxes.slice(0, maxInvites)) {
      await box.click();
      await microDelay(200, 500);
      invitedCount++;
    }

    // Click "Send Invites"
    const sendBtn = await page.$('div[role="dialog"] div[aria-label*="Send" i], div[role="dialog"] div[role="button"]:has-text("Send Invites")');
    if (sendBtn) {
      await sendBtn.click();
      await randomDelay(2000, 4000);
    }

    await saveCookies(context);
    logger.info(`✓ Successfully invited ${invitedCount} friends to group: ${groupUrl}`);
    return { success: true, action: 'friends_invited', count: invitedCount, groupUrl };

  } catch (err) {
    logger.error(`inviteFriendsToGroup error: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = { createPage, createGroup, inviteFriendsToGroup };
