'use strict';

const fs = require('fs');
const path = require('path');
const { getPredatorLeads } = require('../scrapers/marketplacePredator');
const { getLeads, updateLeadStatus } = require('../crm/leadExporter');
const { generateCloserResponse } = require('./salesCloser');
const logger = require('../utils/logger');

const OUTREACH_LOG_FILE = path.resolve('./data/triple-touch-log.json');

function initLog() {
  if (!fs.existsSync(OUTREACH_LOG_FILE)) {
    fs.mkdirSync(path.dirname(OUTREACH_LOG_FILE), { recursive: true });
    fs.writeFileSync(OUTREACH_LOG_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function recordOutreachEvent(event) {
  initLog();
  try {
    const raw = fs.readFileSync(OUTREACH_LOG_FILE, 'utf8');
    const logs = JSON.parse(raw);
    logs.push({ ...event, timestamp: new Date().toISOString() });
    fs.writeFileSync(OUTREACH_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch {}
}

/**
 * Generate a customized technical email pitch for a contractor lead.
 */
function generateTechnicalEmail(lead) {
  const business = lead.BusinessName || lead.Name || 'Custom Builder';
  const trade = (lead.Trade || lead.trade || 'Framing & Carpentry').toLowerCase();

  let hook = 'rafter birdsmouth angles and stair stringer layout';
  let spec = 'IRC 2024 compliance: 7-3/4" max riser and 10" min tread tolerances';

  if (trade.includes('cabinet')) {
    hook = 'face-frame reveals and European hinge cup bore offsets';
    spec = 'perfect 1/8" reveal tolerances with zero guesswork';
  } else if (trade.includes('deck')) {
    hook = 'stair stringer throat depth and post spacing geometry';
    spec = 'IRC compliant deck stair spans and continuous handrail math';
  }

  const subject = `Quick question on your layout specs — ${business}`;
  const body = `Hey ${business} team,

Saw your recent work in the area. We build high-precision digital layout tools specifically for custom builders and framing crews who are tired of wasting time and lumber on complex math.

We ran a benchmark cut sheet through our layout suite for ${hook} (${spec}):
→ https://hexnemesis.com/home.html

Cuts layout time from 45 minutes down to about 3 seconds on a smartphone. Completely open to test on your next job site.

Let me know what you think of the numbers.

Best,
HexNemesis Master Builder Tools
hexnemesis.com`;

  return { subject, body };
}

/**
 * Generate a concise 1-sentence SMS prompt for mobile outreach.
 */
function generateMobileSms(lead) {
  const name = (lead.BusinessName || lead.Name || 'there').split(' ')[0];
  return `Hey ${name}, saw your custom framing projects. We built a free rafter cut & stair stringer layout calculator that cuts layout time down to seconds: https://hexnemesis.com/home.html`;
}

/**
 * Process a Triple-Touch strike across high-value Whale leads.
 *
 * @param {Object} [opts={}]
 * @param {number} [opts.limit=5]
 * @returns {Promise<Object>}
 */
async function processTripleTouchStrike(opts = {}) {
  const limit = opts.limit || 5;
  logger.info(`[TripleTouch] Initiating multi-channel strike sequence (Quota: ${limit} Whales)...`);

  const predatorLeads = getPredatorLeads().filter(l => l.Phone || l.Email);
  const masterLeads = getLeads().filter(l => l.Tier === 'WHALE' || l.tier === 'WHALE');

  const combinedTargets = [...predatorLeads, ...masterLeads].slice(0, limit);
  logger.info(`[TripleTouch] Selected ${combinedTargets.length} prime builder targets.`);

  const dispatched = [];

  for (const target of combinedTargets) {
    const emailData = generateTechnicalEmail(target);
    const smsText = generateMobileSms(target);

    const event = {
      targetId: target.ID || target.id,
      name: target.BusinessName || target.Name,
      phone: target.Phone || 'N/A',
      email: target.Email || 'N/A',
      emailPitch: emailData,
      smsPitch: smsText,
      channel: (target.Email && target.Phone) ? 'SMS+EMAIL' : (target.Email ? 'EMAIL' : 'SMS'),
      status: 'Dispatched_Cadence',
    };

    recordOutreachEvent(event);
    dispatched.push(event);

    logger.info(`[TripleTouch] 🎯 Cadence queued for "${event.name}" via ${event.channel}`);
  }

  return {
    success: true,
    totalDispatched: dispatched.length,
    targets: dispatched,
  };
}

module.exports = {
  processTripleTouchStrike,
  generateTechnicalEmail,
  generateMobileSms,
  OUTREACH_LOG_FILE,
};
