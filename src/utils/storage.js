'use strict';

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { config } = require('../config');

// Ensure data directory exists
const dbPath = path.resolve(config.paths.db);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const adapter = new FileSync(dbPath);
const db = low(adapter);

/**
 * Initialize the database with default structure.
 */
function init() {
  db.defaults({
    profiles: [],
    search_results: [],
    analyses: [],
    _meta: { version: 1, created: new Date().toISOString() },
  }).write();

  logger.info('lowdb database initialized at ' + dbPath);
}

function getDb() {
  return db;
}

// ─── ID generator ────────────────────────────────────────────────────────────
function nextId(collection) {
  const items = db.get(collection).value();
  if (!items.length) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

function saveProfile(data) {
  const id = nextId('profiles');
  const record = {
    id,
    url: data.url || null,
    username: data.username || null,
    name: data.name || null,
    bio: data.bio || null,
    location: data.location || null,
    hometown: data.hometown || null,
    work: data.work || [],
    education: data.education || [],
    posts: data.posts || [],
    avatar_url: data.avatarUrl || null,
    scraped_at: new Date().toISOString(),
  };
  db.get('profiles').push(record).write();
  logger.debug(`Saved profile id=${id}: ${record.name || record.url}`);
  return id;
}

function getProfiles({ limit = 50, offset = 0, name, username } = {}) {
  let chain = db.get('profiles');

  if (name) chain = chain.filter((p) => p.name && p.name.toLowerCase().includes(name.toLowerCase()));
  if (username) chain = chain.filter((p) => p.username && p.username.toLowerCase().includes(username.toLowerCase()));

  const all = chain.value();
  // Sort newest first
  const sorted = [...all].sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
  return sorted.slice(offset, offset + limit);
}

function getProfileById(id) {
  return db.get('profiles').find({ id }).value() || null;
}

// ─── Search Results ───────────────────────────────────────────────────────────

function saveSearchResults(query, results) {
  const id = nextId('search_results');
  db.get('search_results').push({
    id,
    query,
    results,
    scraped_at: new Date().toISOString(),
  }).write();
  return id;
}

function getSearchResults({ limit = 20, offset = 0 } = {}) {
  const all = db.get('search_results').value();
  const sorted = [...all].sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at));
  return sorted.slice(offset, offset + limit);
}

// ─── Analyses ─────────────────────────────────────────────────────────────────

function saveAnalysis(profileId, mode, result, prompt, model) {
  const id = nextId('analyses');
  db.get('analyses').push({
    id,
    profile_id: profileId,
    mode,
    prompt: prompt || null,
    result,
    model: model || null,
    analyzed_at: new Date().toISOString(),
  }).write();
  return id;
}

function getAnalysesByProfileId(profileId) {
  return db.get('analyses')
    .filter({ profile_id: profileId })
    .sortBy('analyzed_at')
    .reverse()
    .value();
}

module.exports = {
  init,
  getDb,
  saveProfile,
  getProfiles,
  getProfileById,
  saveSearchResults,
  getSearchResults,
  saveAnalysis,
  getAnalysesByProfileId,
};
