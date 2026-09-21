'use strict';

const express = require('express');
const router = express.Router();
const { scrapeProfile } = require('../../scrapers/profile');
const { saveProfile } = require('../../utils/storage');
const logger = require('../../utils/logger');

/**
 * POST /api/scrape/profile
 * Body: { "url": "https://facebook.com/username" }
 *    OR { "username": "zuck" }
 */
router.post('/', async (req, res) => {
  const { url, username } = req.body;
  const target = url || username;

  if (!target) {
    return res.status(400).json({ error: 'Provide "url" or "username" in the request body.' });
  }

  try {
    logger.info(`[API] Scrape profile request: ${target}`);
    const profile = await scrapeProfile(target);
    const profileId = saveProfile(profile);
    res.json({ success: true, profileId, profile });
  } catch (err) {
    logger.error(`[API] Scrape profile error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
