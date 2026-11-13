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

const IG_HASHTAGS = [
  'carpenter',
  'framingcontractor',
  'deckbuilder',
  'customcabinetry',
  'woodworking',
  'generalcontractor',
  'finishcarpentry',
  'stairbuilder',
];

const PAGE_TARGET_URL = 'https://www.facebook.com/profile.php?id=61588703994992';
const PERSONAL_TARGET_URL = 'https://www.facebook.com/';

let lastPostTime = 0;
const POST_INTERVAL_MS = 4 * 60 * 60 * 1000; // Auto-post once every 4 hours
let postTargetToggle = false; // Alternates: true = HexNemesis Productions Page, false = Personal Timeline

let lastInviteTime = 0;
const INVITE_INTERVAL_MS = 12 * 60 * 60 * 1000; // Auto-invite newly accepted friends to Page every 12 hours

let lastIgTime = 0;
const IG_INTERVAL_MS = 2 * 60 * 60 * 1000; // Auto-engage linked Instagram contractor hashtags every 2 hours

let lastWarmDmTime = 0;
const WARM_DM_INTERVAL_MS = 3 * 60 * 60 * 1000; // Auto-strike warm contractor DMs every 3 hours

let lastStorySnipeTime = 0;
const STORY_SNIPE_INTERVAL_MS = 4 * 60 * 60 * 1000; // Auto-snipe Instagram contractor stories every 4 hours

let lastBusinessInboxTime = 0;
const BUSINESS_INBOX_INTERVAL_MS = 6 * 60 * 60 * 1000; // Sweep Business Suite unified inbox every 6 hours

let lastScrubTime = 0;
const SCRUB_INTERVAL_MS = 6 * 60 * 60 * 1000; // Auto-scrub and score CRM leads every 6 hours

let lastPredatorTime = 0;
const PREDATOR_INTERVAL_MS = 6 * 60 * 60 * 1000; // Auto-scrape contractor marketplace intel every 6 hours

let lastReelTime = 0;
const REEL_INTERVAL_MS = 3 * 60 * 60 * 1000; // Auto-deploy TikTok Music Vault clip every 3 hours

/**
 * Auto-Pilot Discovery Engine:
 * Generates tasks automatically whenever the queue is low, ensuring the bot runs 100% on its own.
 */
async function runAutoPilotCycle() {
  const stats = getQueueStats();

  logger.info(`[AutoPilot] Running self-driven discovery check (Pending tasks: ${stats.pending})`);

  const now = Date.now();

  // 1. Auto-Schedule Promotional Post if 4 hours have passed (Rotating: Music Streaming Links vs Builder Software on Personal Profile)
  if (now - lastPostTime > POST_INTERVAL_MS) {
    const useMusicDrop = postTargetToggle;
    postTargetToggle = !postTargetToggle;

    if (useMusicDrop) {
      const { MUSIC_CATALOG } = require('../config/musicCatalog');
      const trackKey = Math.random() < 0.5 ? 'pocket' : 'choir';
      const track = MUSIC_CATALOG[trackKey];
      logger.info(`[AutoPilot] Auto-queuing Weldon Giles "${track.title}" streaming links post on Personal Timeline`);
      addTask({
        action: 'post',
        target: PERSONAL_TARGET_URL,
        payload: {
          text: track.facebookPosts[0],
          asPage: false,
        },
        priority: 4,
      });
    } else {
      logger.info('[AutoPilot] Auto-queuing personal timeline post with layout blueprint');
      addTask({
        action: 'post',
        target: PERSONAL_TARGET_URL,
        payload: {
          promoLink: config.autoPilot?.promoLink || 'https://hexnemesis.com/home.html',
          asPage: false,
          topic: 'carpentry craftsmanship, framing calculations, and builder precision software',
        },
        priority: 3,
      });
    }
    lastPostTime = now;
  }

  // 2. Page Invites & IG Outreach bypassed (Page removed / IG suspended — preserving Personal account stealth)

  // 4. Auto-Schedule Warm DM Outreach to Qualified Leads (Every 3 hours)
  if (now - lastWarmDmTime > WARM_DM_INTERVAL_MS) {
    logger.info('[AutoPilot] Auto-queuing Warm DM strike for qualified contractor leads');
    addTask({
      action: 'warm_dm',
      target: 'crm_leads',
      payload: { limit: 2 },
      priority: 3,
    });
    lastWarmDmTime = now;
  }

  // 6. Auto-Schedule CRM Scrubbing & Whale Qualification (Every 6 hours)
  if (now - lastScrubTime > SCRUB_INTERVAL_MS) {
    logger.info('[AutoPilot] Auto-queuing CRM Lead Scrub & Whale Scoring');
    addTask({
      action: 'scrub_leads',
      target: 'crm_database',
      priority: 1,
    });
    lastScrubTime = now;
  }

  // 8. Auto-Schedule Marketplace Predator Scraping (Every 6 hours)
  if (now - lastPredatorTime > PREDATOR_INTERVAL_MS) {
    const predatorKeyword = DEFAULT_KEYWORDS[Math.floor(Math.random() * DEFAULT_KEYWORDS.length)];
    logger.info(`[AutoPilot] Auto-queuing Marketplace Predator scraper for "${predatorKeyword}"`);
    addTask({
      action: 'marketplace_predator',
      target: `marketplace:${predatorKeyword}`,
      payload: { query: predatorKeyword, maxListings: 10 },
      priority: 3,
    });
    lastPredatorTime = now;
  }

  // 9. Auto-Schedule 3-Way Short-Form Syndication (TikTok + IG Reels + FB Reels every 8 hours)
  if (now - lastReelTime > REEL_INTERVAL_MS) {
    logger.info('[AutoPilot] Auto-queuing 3-way short-form syndication (TikTok + IG Reels + FB Reels)');
    addTask({
      action: 'syndicate_short',
      target: 'omni_short_production',
      priority: 3,
    });
    lastReelTime = now;
  }

  // 10. If pending tasks are sufficient (>= 5), let worker process existing tasks
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
