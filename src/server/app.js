'use strict';

require('dotenv').config();

const express = require('express');
const { config, validate } = require('../config');
const { init: initDb } = require('../utils/storage');
const { startScheduler } = require('../scheduler/cron');
const logger = require('../utils/logger');

// ─── Routes ───────────────────────────────────────────────────────────────────
const scrapeRoute   = require('./routes/scrape');
const searchRoute   = require('./routes/search');
const analyzeRoute  = require('./routes/analyze');
const resultsRoute  = require('./routes/results');
const followersRoute = require('./routes/followers');
const actionsRoute  = require('./routes/actions');
const queueRoute    = require('./routes/queue');
const { startWorker } = require('../engine/worker');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging Middleware ───────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: require('../../package.json').version,
    timestamp: new Date().toISOString(),
    proxy: config.proxy.url ? 'configured' : 'not configured',
    openai: config.openai.apiKey ? 'configured' : 'not configured',
  });
});

app.use('/api/scrape/profile', scrapeRoute);
app.use('/api/scrape/search',  searchRoute);
app.use('/api/scrape/followers', followersRoute);
app.use('/api/analyze',        analyzeRoute);
app.use('/api/actions',        actionsRoute);
app.use('/api/results',        resultsRoute);
app.use('/api/queue',          queueRoute);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
function start() {
  // Print startup warnings
  const warnings = validate();
  for (const w of warnings) {
    logger.warn(w);
  }

  // Initialize database
  initDb();

  // Start cron scheduler & autonomous worker engine
  startScheduler();
  startWorker();

  // Start Express server
  app.listen(config.port, () => {
    logger.info('='.repeat(60));
    logger.info('  Facebook Bot — REST API Server');
    logger.info(`  Listening on http://localhost:${config.port}`);
    logger.info('='.repeat(60));
    logger.info('  Endpoints:');
    logger.info(`  GET  /api/health`);
    logger.info(`  POST /api/scrape/profile      { url, username }`);
    logger.info(`  POST /api/scrape/search       { query, location, maxPages }`);
    logger.info(`  POST /api/scrape/followers    { url, username, maxPages }`);
    logger.info(`  POST /api/analyze             { profileId, mode, customPrompt }`);
    logger.info(`  GET  /api/analyze/modes`);
    logger.info(`  POST /api/actions/follow         { url, username }`);
    logger.info(`  POST /api/actions/unfollow        { url, username }`);
    logger.info(`  POST /api/actions/add-friend      { url, username }`);
    logger.info(`  POST /api/actions/cancel-request  { url, username }`);
    logger.info(`  POST /api/actions/bulk-add-friends { urls[], maxPerSession }`);
    logger.info(`  GET  /api/results/profiles`);
    logger.info(`  GET  /api/results/profiles/:id`);
    logger.info(`  GET  /api/results/searches`);
    logger.info('='.repeat(60));
  });
}

start();

module.exports = app;
