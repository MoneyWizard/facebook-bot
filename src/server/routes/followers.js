'use strict';

const express = require('express');
const router = express.Router();
const { getFollowers } = require('../../scrapers/followers');
const { saveSearchResults } = require('../../utils/storage');
const logger = require('../../utils/logger');

/**
 * POST /api/scrape/followers
 * Body: { "url": "https://facebook.com/username", "maxPages": 3 }
 *    OR { "username": "zuck", "maxPages": 2 }
 */
router.post('/', async (req, res) => {
  const { url, username, maxPages } = req.body;
  const target = url || username;

  if (!target) {
    return res.status(400).json({ error: 'Provide "url" or "username" in the request body.' });
  }

  try {
    logger.info(`[API] Get followers: ${target}`);
    const followers = await getFollowers(target, { maxPages: maxPages || 3 });
    const searchId = saveSearchResults(`followers:${target}`, followers);
    res.json({ success: true, searchId, target, count: followers.length, followers });
  } catch (err) {
    logger.error(`[API] Get followers error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
