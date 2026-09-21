'use strict';

const express = require('express');
const router = express.Router();
const { followUser, unfollowUser } = require('../../actions/follow');
const { addFriend, cancelFriendRequest, bulkAddFriends } = require('../../actions/addFriend');
const logger = require('../../utils/logger');

/**
 * POST /api/actions/follow
 * Body: { "url": "..." } or { "username": "..." }
 */
router.post('/follow', async (req, res) => {
  const { url, username } = req.body;
  const target = url || username;
  if (!target) return res.status(400).json({ error: 'Provide "url" or "username".' });

  try {
    logger.info(`[API] Follow: ${target}`);
    const result = await followUser(target);
    res.json(result);
  } catch (err) {
    logger.error(`[API] Follow error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/actions/unfollow
 * Body: { "url": "..." } or { "username": "..." }
 */
router.post('/unfollow', async (req, res) => {
  const { url, username } = req.body;
  const target = url || username;
  if (!target) return res.status(400).json({ error: 'Provide "url" or "username".' });

  try {
    logger.info(`[API] Unfollow: ${target}`);
    const result = await unfollowUser(target);
    res.json(result);
  } catch (err) {
    logger.error(`[API] Unfollow error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/actions/add-friend
 * Body: { "url": "..." } or { "username": "..." }
 */
router.post('/add-friend', async (req, res) => {
  const { url, username } = req.body;
  const target = url || username;
  if (!target) return res.status(400).json({ error: 'Provide "url" or "username".' });

  try {
    logger.info(`[API] Add Friend: ${target}`);
    const result = await addFriend(target);
    res.json(result);
  } catch (err) {
    logger.error(`[API] Add Friend error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/actions/cancel-request
 * Body: { "url": "..." } or { "username": "..." }
 */
router.post('/cancel-request', async (req, res) => {
  const { url, username } = req.body;
  const target = url || username;
  if (!target) return res.status(400).json({ error: 'Provide "url" or "username".' });

  try {
    logger.info(`[API] Cancel Request: ${target}`);
    const result = await cancelFriendRequest(target);
    res.json(result);
  } catch (err) {
    logger.error(`[API] Cancel Request error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/actions/bulk-add-friends
 * Body: {
 *   "urls": ["https://...", "https://..."],
 *   "delayBetween": [8000, 20000],  // ms range between actions
 *   "maxPerSession": 10             // safety cap
 * }
 */
router.post('/bulk-add-friends', async (req, res) => {
  const { urls, delayBetween, maxPerSession } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Provide "urls" as a non-empty array.' });
  }

  try {
    logger.info(`[API] Bulk Add Friends: ${urls.length} targets`);
    const results = await bulkAddFriends(urls, { delayBetween, maxPerSession });
    const sent = results.filter((r) => r.action === 'request_sent').length;
    res.json({ success: true, total: urls.length, sent, results });
  } catch (err) {
    logger.error(`[API] Bulk Add Friends error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
