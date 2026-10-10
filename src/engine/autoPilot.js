'use strict';

const { addTask, getQueueStats } = require('./queueManager');
const { searchPeople } = require('../scrapers/search');
const { recordLead } = require('../crm/leadExporter');
const { canPerformAction } = require('../utils/sessionBehavior');
const { config } = require('../config');
const logger = require('../utils/logger');

// Target search niches aligned with HexNemesis Carpenter & Builder Software
const DEFAULT_KEYWORDS = [
  'carpenter',
  'custom builder',
  'cabinet maker',
  'deck builder',
  'general contractor',
  'framing contractor',
  'woodworking',
  'finish carpenter',
  'custom cabinetry',
  'remodeling contractor',
];

let lastPostTime = 0;
const POST_INTERVAL_MS = 4 * 60 * 60 * 1000; // Auto-post once every 4 hours

/**
 * Auto-Pilot Discovery Engine:
 * Generates tasks automatically whenever the queue is low, ensuring the bot runs 100% on its own.
 */
async function runAutoPilotCycle() {
  const stats = getQueueStats();

  logger.info(`[AutoPilot] Running self-driven discovery check (Pending tasks: ${stats.pending})`);

  // 1. Auto-Schedule Promotional Post if 4 hours have passed
  const now = Date.now();
  if (now - lastPostTime > POST_INTERVAL_MS) {
    logger.info('[AutoPilot] Auto-queuing promotional post for hexnemesis.com');
    addTask({
      action: 'post',
      target: 'https://www.facebook.com/',
      payload: { promoLink: config.autoPilot?.promoLink || 'https://hexnemesis.com' },
      priority: 2,
    });
    lastPostTime = now;
  }

  // 2. If pending tasks are sufficient (>= 5), let worker process existing tasks
  if (stats.pending >= 5) {
    logger.debug('[AutoPilot] Queue has sufficient pending tasks.');
    return;
  }

  // 3. Niche Discovery: Pick a random keyword, search Facebook, and auto-enqueue discovered profiles
  const keyword = DEFAULT_KEYWORDS[Math.floor(Math.random() * DEFAULT_KEYWORDS.length)];
  logger.info(`[AutoPilot] Discovering new potential contacts/leads for keyword: "${keyword}"`);

  try {
    const results = await searchPeople(keyword, { maxPages: 1 });
    if (!results || !results.length) {
      logger.warn(`[AutoPilot] No search results found for keyword "${keyword}".`);
      return;
    }

    let queuedCount = 0;
    for (const item of results) {
      if (!item.url) continue;

      // Check daily limit for addFriend
      const canFriend = canPerformAction('addFriend');
      const action = canFriend ? (Math.random() < 0.6 ? 'add_friend' : 'follow') : 'follow';
      addTask({
        action,
        target: item.url,
        priority: 1,
      });

      // Automatically log contractor lead to CSV spreadsheet
      recordLead({
        name: item.name,
        url: item.url,
        location: item.location || 'Trade Target',
        bio: `Discovered from "${keyword}" niche`,
        status: `Queued (${action})`,
      });

      // Also queue an engagement task (like/comment) for 30% of discovered profiles
      if (Math.random() < 0.3) {
        addTask({
          action: 'engage',
          target: item.url,
          payload: { promoLink: config.autoPilot?.promoLink || 'https://hexnemesis.com' },
          priority: 1,
        });
      }

      queuedCount++;
      if (queuedCount >= 5) break; // Enqueue up to 5 discovered targets per cycle
    }

    logger.info(`[AutoPilot] Successfully auto-queued ${queuedCount} new discovered targets from "${keyword}" search.`);

  } catch (err) {
    logger.error(`[AutoPilot] Discovery cycle error: ${err.message}`);
  }
}

module.exports = { runAutoPilotCycle };
