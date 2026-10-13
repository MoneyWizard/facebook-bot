'use strict';

const fs = require('fs');
const path = require('path');
const { CSV_FILE } = require('./leadExporter');
const logger = require('../utils/logger');

const JUNK_KEYWORDS = [
  'forex', 'crypto', 'bitcoin', 'trading', 'investment', 'binary',
  'broker', 'dropship', 'affiliate', 'marketing agency', 'onlyfans',
  'casino', 'passive income', 'wealth manager', 'e-commerce mentor',
  'pc build', 'gaming', 'computer', 'phone repair'
];

const WHALE_KEYWORDS = [
  'general contractor', 'custom homes', 'framing contractor', 'construction llc',
  'commercial framing', 'master carpenter', 'cabinet shop', 'timber frame',
  'builder group', 'contracting inc', 'contracting corp', 'residential builder',
  'custom builder', 'framing company', 'roofing & framing'
];

const PRO_KEYWORDS = [
  'carpenter', 'cabinet maker', 'finish carpentry', 'woodworker',
  'trim carpenter', 'deck builder', 'remodeler', 'framer', 'stair builder',
  'finish carpenter', 'woodcraft', 'framing', 'joinery', 'renovations'
];

/**
 * Score and classify a lead based on name, bio, and URL.
 *
 * @param {Object} lead
 * @returns {{ tier: 'WHALE'|'PRO'|'PROSPECT'|'JUNK', score: number, reason: string }}
 */
function classifyLead(lead) {
  const text = `${lead.name || ''} ${lead.bio || ''} ${lead.url || ''}`.toLowerCase();

  // 1. Check for spam / non-trade junk
  for (const kw of JUNK_KEYWORDS) {
    if (text.includes(kw)) {
      return { tier: 'JUNK', score: 0, reason: `Matches spam filter: "${kw}"` };
    }
  }

  // 2. Check for Whales (high-ticket outfits & crews)
  for (const kw of WHALE_KEYWORDS) {
    if (text.includes(kw)) {
      return { tier: 'WHALE', score: 95, reason: `High-value commercial/general contractor: "${kw}"` };
    }
  }

  // 3. Check for Pros (active tradesmen & carpenters)
  for (const kw of PRO_KEYWORDS) {
    if (text.includes(kw)) {
      return { tier: 'PRO', score: 80, reason: `Active trades pro: "${kw}"` };
    }
  }

  return { tier: 'PROSPECT', score: 60, reason: 'General builder group prospect' };
}

/**
 * Scrub the CRM leads spreadsheet: purge spammers, classify tiers, and sort by whale priority.
 *
 * @returns {Object} Scrub summary stats
 */
function scrubAndScoreLeads() {
  if (!fs.existsSync(CSV_FILE)) {
    return { success: false, message: 'CRM leads file does not exist.' };
  }

  const raw = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = raw.split('\n');
  if (lines.length <= 1) {
    return { success: false, message: 'No leads in CRM.' };
  }

  const totalBefore = lines.length - 1;
  const validRows = [];
  let junkPurged = 0;
  let whalesFound = 0;
  let prosFound = 0;
  let prospectsFound = 0;

  const seenUrls = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 5) continue;

    const id = matches[0]?.replace(/"/g, '');
    const name = matches[1]?.replace(/"/g, '');
    const url = matches[2]?.replace(/"/g, '');
    const location = matches[3]?.replace(/"/g, '');
    const bio = matches[4]?.replace(/"/g, '') || '';
    const status = matches[5]?.replace(/"/g, '') || 'Discovered';
    const discoveredAt = matches[6]?.replace(/"/g, '') || '';
    const lastUpdated = matches[7]?.replace(/"/g, '') || '';

    // De-duplicate URLs
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const classification = classifyLead({ name, bio, url });

    if (classification.tier === 'JUNK') {
      junkPurged++;
      continue; // Purge junk
    }

    if (classification.tier === 'WHALE') whalesFound++;
    else if (classification.tier === 'PRO') prosFound++;
    else prospectsFound++;

    validRows.push({
      id,
      name,
      url,
      location,
      bio,
      status,
      discoveredAt,
      lastUpdated,
      tier: classification.tier,
      score: classification.score,
      reason: classification.reason,
    });
  }

  // Sort: Whales first, then Pros, then Prospects
  validRows.sort((a, b) => b.score - a.score);

  // Re-write sanitized CSV with Tier and Score headers
  const headers = 'ID,Name,Profile URL,Location,Bio / Work,Status,Discovered At,Last Updated,Tier,Score\n';
  const csvLines = [headers];

  const sanitize = (text) => {
    if (!text) return 'N/A';
    return `"${String(text).replace(/"/g, '""').replace(/\n/g, ' ').trim()}"`;
  };

  for (const r of validRows) {
    const row = [
      r.id,
      sanitize(r.name),
      sanitize(r.url),
      sanitize(r.location),
      sanitize(r.bio),
      sanitize(r.status),
      sanitize(r.discoveredAt),
      sanitize(r.lastUpdated),
      sanitize(r.tier),
      r.score,
    ].join(',');
    csvLines.push(row);
  }

  fs.writeFileSync(CSV_FILE, csvLines.join('\n'), 'utf8');

  const summary = {
    success: true,
    totalBefore,
    totalAfter: validRows.length,
    junkPurged,
    whalesFound,
    prosFound,
    prospectsFound,
    topWhales: validRows.filter(r => r.tier === 'WHALE').slice(0, 5),
  };

  logger.info(`[LeadScrubber] Scrub complete: ${junkPurged} junk purged, ${whalesFound} Whales, ${prosFound} Pros active.`);
  return summary;
}

module.exports = { scrubAndScoreLeads, classifyLead };
