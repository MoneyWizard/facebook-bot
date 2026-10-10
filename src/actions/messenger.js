'use strict';

const { launchBrowser, createContext } = require('../browser/launcher');
const { loadCookies, saveCookies } = require('../browser/cookies');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { warmupSession, canPerformAction, recordAction } = require('../utils/sessionBehavior');
const { getSiteKnowledge } = require('../ai/promoter');
const { config } = require('../config');
const OpenAI = require('openai');
const logger = require('../utils/logger');

let client;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

/**
 * Send a direct message to a user profile or page.
 *
 * @param {string} profileUrl
 * @param {string} messageText
 * @returns {Promise<Object>}
 */
async function sendDM(profileUrl, messageText) {
  logger.info(`[Messenger] Sending DM to: ${profileUrl}`);

  if (!canPerformAction('comment')) { // count under conversation limit
    return { success: false, action: 'daily_limit', message: 'Daily conversation limit reached.' };
  }

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    const hasCookies = await loadCookies(context);
    if (!hasCookies) return { success: false, action: 'no_session', message: 'No cookies loaded.' };

    await warmupSession(page);
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);

    // Look for Message button
    const msgBtn = await page.$('div[aria-label="Message"], div[role="button"]:has-text("Message")');
    if (!msgBtn) {
      return { success: false, action: 'not_found', message: 'Message button not found on profile.' };
    }

    await msgBtn.scrollIntoViewIfNeeded();
    await microDelay(300, 700);
    await msgBtn.click();
    await randomDelay(2000, 4000);

    // Locate active Messenger chat input
    const inputSelector = 'div[role="textbox"][aria-label*="Message" i], div[contenteditable="true"][aria-label*="Message" i]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });

    await humanType(page, inputSelector, messageText);
    await randomDelay(1000, 2500);
    await page.keyboard.press('Enter');
    await randomDelay(2000, 4000);

    await saveCookies(context);
    recordAction('comment');

    logger.info(`✓ Sent DM to ${profileUrl}`);
    return { success: true, action: 'message_sent', message: messageText, profileUrl };

  } catch (err) {
    logger.error(`sendDM failed: ${err.message}`);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Check Messenger inbox for unread messages and reply automatically using GPT-4o.
 *
 * @returns {Promise<Array>} List of replies sent
 */
async function checkAndReplyInbox() {
  logger.info('[Messenger] Checking Messenger inbox for unread conversations...');

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  const replies = [];

  try {
    await loadCookies(context);
    await page.goto('https://www.facebook.com/messages/t/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(3000, 6000);

    // Find unread threads in sidebar
    const unreadThreads = await page.$$('div[role="row"]:has(span[data-visualcompletion]), div[role="gridcell"]:has-text("unread")');
    logger.info(`[Messenger] Found ${unreadThreads.length} potential unread conversation threads.`);

    const knowledge = await getSiteKnowledge();
    const siteSummary = knowledge ? `HexNemesis Tools: ${knowledge.headings.join(', ')}` : 'HexNemesis Carpenter & Builder Tools';

    for (const thread of unreadThreads.slice(0, 3)) { // Process up to 3 unread chats per cycle
      await thread.click();
      await randomDelay(2000, 4000);

      // Extract latest incoming message
      const latestMsgText = await page.evaluate(() => {
        const messages = Array.from(document.querySelectorAll('div[dir="auto"][class*="x1ed109x"]'));
        return messages.length ? messages[messages.length - 1].innerText.trim() : '';
      });

      if (!latestMsgText) continue;
      logger.info(`[Messenger] Incoming message: "${latestMsgText}"`);

      // Generate GPT-4o conversational response
      const openai = getClient();
      const completion = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful, knowledgeable assistant representing HexNemesis (https://hexnemesis.com/home.html). Answer questions warmly and naturally recommend our trade & builder tools (e.g. Rafter Cut Calculator, ERD Builder, Lumber Optimizer, Quick-Quote Bid Generator).\n${siteSummary}`,
          },
          { role: 'user', content: latestMsgText },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const replyText = completion.choices[0]?.message?.content?.trim() || '';
      if (replyText) {
        const inputSelector = 'div[role="textbox"][aria-label*="Message" i], div[contenteditable="true"][aria-label*="Message" i]';
        await humanType(page, inputSelector, replyText);
        await randomDelay(1000, 2000);
        await page.keyboard.press('Enter');
        await randomDelay(2000, 3500);

        replies.push({ incoming: latestMsgText, reply: replyText });
        logger.info(`✓ Sent AI reply: "${replyText.slice(0, 60)}..."`);
      }
    }

    await saveCookies(context);
    return replies;

  } catch (err) {
    logger.error(`checkAndReplyInbox failed: ${err.message}`);
    return replies;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = { sendDM, checkAndReplyInbox };
