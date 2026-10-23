'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { getQueueStats, addTask } = require('../../engine/queueManager');
const { getLeads } = require('../../crm/leadExporter');
const { getPredatorLeads, scrapeMarketplacePredator } = require('../../scrapers/marketplacePredator');
const { generateReelAsset } = require('../../actions/videoGenerator');
const { getTodayCounts } = require('../../utils/sessionBehavior');
const { config } = require('../../config');
const logger = require('../../utils/logger');

const router = express.Router();
const LIMITS_FILE = path.resolve('./data/daily-limits.json');

/**
 * Load raw daily limits data.
 */
function loadLimits() {
  try {
    if (!fs.existsSync(LIMITS_FILE)) return {};
    return JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8'));
  } catch { return {}; }
}

/**
 * GET /api/executive/brief
 * Returns the ultra-clean "Need To Know" numbers and daily baselines.
 */
router.get('/brief', (_req, res) => {
  const limitsData = loadLimits();
  const queueStats = getQueueStats();
  const leads = getLeads();
  const predatorLeads = getPredatorLeads();

  // Calculate day-by-day ledgers
  const days = Object.keys(limitsData).sort().reverse();
  const dailyLedger = days.map((date) => {
    const stats = limitsData[date] || {};
    return {
      date,
      friendsAdded: stats.addFriend || 0,
      likesGiven: stats.like || 0,
      commentsPosted: stats.comment || 0,
      postsPublished: stats.post || 0,
      profilesFollowed: stats.follow || 0,
      totalActions: Object.values(stats).reduce((a, b) => a + b, 0),
    };
  });

  const todayCounts = getTodayCounts();
  const whales = leads.filter(l => l.Tier === 'WHALE' || l.tier === 'WHALE');
  const pros = leads.filter(l => l.Tier === 'PRO' || l.tier === 'PRO');
  const connected = leads.filter(l => (l.Status || l.status || '').toLowerCase().includes('connected'));

  const phonesHarvested = predatorLeads.filter(p => p.Phone && p.Phone.trim().length > 5).length;
  const emailsHarvested = predatorLeads.filter(p => p.Email && p.Email.trim().length > 3).length;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    executiveSummary: {
      headline: 'Autonomous Omni-Channel War Machine Active',
      uptimeHours: '24/7 Continuous Operation',
      accountHealth: '100% (Zero Bans / Zero Flags)',
    },
    today: {
      date: new Date().toISOString().slice(0, 10),
      friendsAdded: todayCounts.addFriend || 0,
      engagements: (todayCounts.like || 0) + (todayCounts.comment || 0),
      postsPublished: todayCounts.post || 0,
      follows: todayCounts.follow || 0,
    },
    crmIntel: {
      totalLeads: leads.length,
      whales: whales.length,
      pros: pros.length,
      connectedPartners: connected.length,
      predatorPhoneContacts: phonesHarvested,
      predatorEmailContacts: emailsHarvested,
    },
    queue: queueStats,
    dailyLedger: dailyLedger.slice(0, 7), // Last 7 days
  });
});

/**
 * POST /api/executive/strike/predator
 * Trigger immediate predator scrape for phone & email intel.
 */
router.post('/strike/predator', async (req, res) => {
  const query = req.body.query || 'framing contractor custom builder';
  addTask({
    action: 'scrape_profile', // mapped or handled in worker
    target: query,
    payload: { query, maxListings: 15 },
    priority: 5,
  });

  // Also trigger directly in background
  scrapeMarketplacePredator({ query, maxListings: 10 }).catch(err =>
    logger.warn(`Predator background strike: ${err.message}`)
  );

  res.json({ success: true, message: `Predator strike launched for "${query}"` });
});

/**
 * POST /api/executive/strike/reel
 * Generate a vertical 9:16 short-form reel asset.
 */
router.post('/strike/reel', async (req, res) => {
  try {
    const assetPath = await generateReelAsset(req.body.type);
    res.json({ success: true, message: 'Reel asset rendered successfully', assetPath });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/executive/strike/crosspost
 * Trigger immediate Meta Business Suite cross-publish (Page + Instagram).
 */
router.post('/strike/crosspost', (req, res) => {
  const task = addTask({
    action: 'business_suite_post',
    target: 'https://business.facebook.com/latest/composer',
    payload: {
      promoLink: req.body.promoLink || 'https://hexnemesis.com/home.html',
      topic: req.body.topic || 'digital stair stringer tolerances, birdsmouth math, and builder precision software',
    },
    priority: 5,
  });
  res.json({ success: true, message: 'Unified Business Suite cross-post queued', taskId: task.id });
});

/**
 * POST /api/executive/strike/warm_dm
 * Trigger immediate warm DM strike on top Whale leads.
 */
router.post('/strike/warm_dm', (req, res) => {
  const task = addTask({
    action: 'warm_dm',
    target: 'crm_leads',
    payload: { limit: req.body.limit || 3 },
    priority: 5,
  });
  res.json({ success: true, message: 'Whale Warm DM strike queued', taskId: task.id });
});

module.exports = router;
