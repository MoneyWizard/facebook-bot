'use strict';

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { config } = require('../config');
const { sendDM } = require('./messenger');
const { launchBrowser, createContext } = require('../browser/launcher');
const { loadIgSession, ensureInstagramLogin } = require('./instagram');
const { randomDelay, simulateMouseMove, humanType, microDelay } = require('../utils/humanBehavior');
const { canPerformAction, recordAction } = require('../utils/sessionBehavior');
const { CSV_FILE } = require('../crm/leadExporter');
const logger = require('../utils/logger');

let client;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return client;
}

/**
 * Generate a peer-to-peer, trade-authentic warm DM pitching hexnemesis.com.
 *
 * @param {Object} lead
 * @returns {Promise<string>}
 */
async function generateWarmPitch(lead) {
  const firstName = (lead.name || 'there').split(' ')[0].replace(/[^a-zA-Z]/g, '') || 'there';
  const bio = lead.bio || 'carpenter / contractor';

  try {
    const ai = getClient();
    const prompt = `
Write a short, peer-to-peer, trade-authentic 2-sentence private direct message to a contractor named "${firstName}".
Their specialty/bio is: "${bio}".
You are a fellow builder who developed a free jobsite calculator at https://hexnemesis.com/home.html.

Guidelines:
- Tone: Respected blue-collar peer, confident, zero corporate fluff, zero marketing speak.
- Focus: Eliminating jobsite calculation errors (rafter birdsmouths, stair stringers, panel spacing, or lumber waste).
- Value proposition: Completely free, no app download or signup required, runs directly on a phone in the browser on site.
- Call to action: "Check the numbers against your pitch tables when you get a second."
- Include link: https://hexnemesis.com/home.html
- Output ONLY the raw message text.
`;

    const res = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 120,
    });

    const msg = res.choices[0]?.message?.content?.trim();
    if (msg) return msg;
  } catch (err) {
    logger.warn(`AI Warm Pitch generation failed: ${err.message}. Using fallback.`);
  }

  return `Hey ${firstName}, caught your work in the builder groups. Got tired of guys burning lumber on miscalculated birdsmouths and stringers, so we put together a free mobile layout tool: https://hexnemesis.com/home.html — no sign-up or app download required, runs right on your phone on site. Let me know if the angles match your tables.`;
}

/**
 * Send an Instagram Direct Message to a user handle or URL.
 *
 * @param {string} handleOrUrl
 * @param {string} text
 * @returns {Promise<Object>}
 */
async function sendInstagramDM(handleOrUrl, text) {
  const handle = handleOrUrl
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/$/, '')
    .trim();

  logger.info(`[Instagram] Sending direct message to @${handle}`);

  const { browser, identity } = await launchBrowser();
  const context = await createContext(browser, identity);
  const page = await context.newPage();

  try {
    await loadIgSession(context);
    await ensureInstagramLogin(page);

    await page.goto(`https://www.instagram.com/${encodeURIComponent(handle)}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await randomDelay(2500, 4500);

    // Look for Message button on profile
    const msgBtnSelectors = [
      'div[role="button"]:has-text("Message")',
      'button:has-text("Message")',
      'a[role="link"]:has-text("Message")',
    ];

    let msgBtn = null;
    for (const sel of msgBtnSelectors) {
      msgBtn = await page.$(sel);
      if (msgBtn) break;
    }

    if (!msgBtn) {
      logger.warn(`[Instagram] Message button not available for @${handle}`);
      return { success: false, action: 'dm_button_missing', handle };
    }

    await msgBtn.click();
    await randomDelay(3000, 5000);

    // Find message textarea in Instagram Direct
    const inputSelector = 'div[role="textbox"][contenteditable="true"], textarea[placeholder*="Message" i]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });

    await humanType(page, inputSelector, text);
    await randomDelay(1000, 2000);
    await page.keyboard.press('Enter');
    await randomDelay(2000, 4000);

    logger.info(`[Instagram] ✓ Successfully sent DM to @${handle}`);
    return { success: true, action: 'ig_dm_sent', handle, text };

  } catch (err) {
    logger.error(`[Instagram] Failed to send DM to @${handle}: ${err.message}`);
    return { success: false, action: 'ig_dm_error', error: err.message };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Execute a warm DM strike on the next qualified contractor leads.
 *
 * @param {Object} [opts={}]
 * @param {number} [opts.limit=2] - Number of DMs to send in this run (respecting human limits)
 * @returns {Promise<Object>}
 */
async function processWarmDMs(opts = {}) {
  const limit = opts.limit || 2;
  logger.info(`[WarmDM] Initiating warm DM sequence (Target quota: ${limit})...`);

  if (!fs.existsSync(CSV_FILE)) {
    return { success: false, message: 'CRM leads file not found.' };
  }

  const rawCsv = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = rawCsv.split('\n');
  if (lines.length <= 1) {
    return { success: false, message: 'No leads found in CRM.' };
  }

  const leads = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (matches && matches.length >= 6) {
      leads.push({
        lineIndex: i,
        rawLine: line,
        id: matches[0]?.replace(/"/g, ''),
        name: matches[1]?.replace(/"/g, ''),
        url: matches[2]?.replace(/"/g, ''),
        location: matches[3]?.replace(/"/g, ''),
        bio: matches[4]?.replace(/"/g, '') || '',
        status: matches[5]?.replace(/"/g, '') || 'Discovered',
      });
    }
  }

  // Filter leads ready for Warm DM
  // Prioritize Whales and Connected/Discovered leads that have not been DMed
  const eligible = leads.filter(l => 
    !['DM_Sent', 'DM_Replied', 'Skipped', 'Invalid'].includes(l.status) &&
    l.url && l.url.startsWith('http')
  );

  if (!eligible.length) {
    logger.info('[WarmDM] No eligible un-contacted leads in CRM.');
    return { success: true, count: 0, message: 'All qualified leads have already been contacted.' };
  }

  let sentCount = 0;
  const results = [];

  for (const lead of eligible.slice(0, limit)) {
    try {
      const pitch = await generateWarmPitch(lead);
      let res;

      if (lead.url.includes('instagram.com')) {
        res = await sendInstagramDM(lead.url, pitch);
      } else {
        res = await sendDM(lead.url, pitch);
      }

      if (res && res.success) {
        sentCount++;
        // Update status in CSV
        lead.status = 'DM_Sent';
        results.push({ lead: lead.name, url: lead.url, pitch, success: true });
        logger.info(`[WarmDM] ✓ Successfully contacted ${lead.name} (${lead.url})`);
      } else {
        lead.status = 'DM_Failed';
        results.push({ lead: lead.name, url: lead.url, error: res?.message || 'Send failed', success: false });
        logger.warn(`[WarmDM] ✗ Could not DM ${lead.name}: ${res?.message}`);
      }

      // Update the row in the CSV
      const updatedLines = [...lines];
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const cols = lead.rawLine.split(',');
      if (cols.length >= 8) {
        cols[5] = `"${lead.status}"`;
        cols[7] = `"${now}"`;
        updatedLines[lead.lineIndex] = cols.join(',');
        fs.writeFileSync(CSV_FILE, updatedLines.join('\n'), 'utf8');
      }

      await randomDelay(15000, 30000); // realistic delay between DMs

    } catch (err) {
      logger.error(`[WarmDM] Error processing lead ${lead.name}: ${err.message}`);
    }
  }

  return { success: true, sentCount, results };
}

module.exports = { processWarmDMs, generateWarmPitch, sendInstagramDM };
