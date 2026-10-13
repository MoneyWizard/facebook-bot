'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const CSV_FILE = path.resolve('./data/contractor-leads.csv');

/**
 * Initialize CSV header if missing.
 */
function initCsv() {
  fs.mkdirSync(path.dirname(CSV_FILE), { recursive: true });
  if (!fs.existsSync(CSV_FILE)) {
    const headers = 'ID,Name,Profile URL,Location,Bio / Work,Status,Discovered At,Last Updated\n';
    fs.writeFileSync(CSV_FILE, headers, 'utf8');
  }
}

/**
 * Record or update a lead in the CSV database.
 *
 * @param {Object} lead
 * @param {string} lead.name
 * @param {string} lead.url
 * @param {string} [lead.location]
 * @param {string} [lead.bio]
 * @param {string} [lead.status="Discovered"]
 */
function recordLead(lead) {
  initCsv();

  const sanitize = (text) => {
    if (!text) return 'N/A';
    return `"${text.replace(/"/g, '""').replace(/\n/g, ' ').trim()}"`;
  };

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const id = Date.now().toString().slice(-6);

  const row = [
    id,
    sanitize(lead.name),
    sanitize(lead.url),
    sanitize(lead.location),
    sanitize(lead.bio),
    sanitize(lead.status || 'Discovered'),
    sanitize(now),
    sanitize(now),
  ].join(',') + '\n';

  fs.appendFileSync(CSV_FILE, row, 'utf8');
  logger.info(`[CRM] Saved lead to spreadsheet: ${lead.name} (${lead.url})`);
}

/**
 * Read all leads from CSV as JSON for the dashboard.
 */
function getLeads() {
  initCsv();
  const content = fs.readFileSync(CSV_FILE, 'utf8').trim();
  const lines = content.split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple regex to parse CSV taking quotes into account
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (matches && matches.length >= 4) {
      rows.push({
        id: matches[0]?.replace(/"/g, ''),
        name: matches[1]?.replace(/"/g, ''),
        url: matches[2]?.replace(/"/g, ''),
        location: matches[3]?.replace(/"/g, ''),
        bio: matches[4]?.replace(/"/g, '') || '',
        status: matches[5]?.replace(/"/g, '') || 'Discovered',
        date: matches[6]?.replace(/"/g, '') || '',
        tier: matches[8]?.replace(/"/g, '') || 'PROSPECT',
        score: matches[9] ? parseInt(matches[9], 10) : 60,
      });
    }
  }

  return rows.reverse(); // newest first
}

module.exports = { recordLead, getLeads, CSV_FILE };
