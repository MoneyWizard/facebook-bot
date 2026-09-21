'use strict';

const express = require('express');
const router = express.Router();
const {
  addTask,
  addBulkTasks,
  getQueueStats,
  listQueue,
  clearQueue,
} = require('../../engine/queueManager');
const logger = require('../../utils/logger');

/**
 * GET /api/queue/stats
 */
router.get('/stats', (req, res) => {
  res.json(getQueueStats());
});

/**
 * GET /api/queue
 * Query params: status, limit, offset
 */
router.get('/', (req, res) => {
  const { status, limit, offset } = req.query;
  const items = listQueue({
    status,
    limit: parseInt(limit || '50'),
    offset: parseInt(offset || '0'),
  });
  res.json({ count: items.length, items });
});

/**
 * POST /api/queue/add
 * Body: { action, target, payload, priority }
 */
router.post('/add', (req, res) => {
  const { action, target, payload, priority } = req.body;
  if (!action || !target) {
    return res.status(400).json({ error: 'Missing required fields: action and target' });
  }

  try {
    const task = addTask({ action, target, payload, priority });
    res.json({ success: true, task });
  } catch (err) {
    logger.error(`[API] Queue add error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/queue/bulk
 * Body: { action, targets: [...], payload, priority }
 */
router.post('/bulk', (req, res) => {
  const { action, targets, payload, priority } = req.body;
  if (!action || !Array.isArray(targets) || !targets.length) {
    return res.status(400).json({ error: 'Missing required fields: action and non-empty targets array' });
  }

  try {
    const tasks = addBulkTasks(action, targets, payload, priority);
    res.json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    logger.error(`[API] Queue bulk error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/queue
 * Query params: status (optional, e.g. completed, failed)
 */
router.delete('/', (req, res) => {
  const { status } = req.query;
  clearQueue(status || null);
  res.json({ success: true, message: status ? `Cleared '${status}' tasks` : 'Queue cleared' });
});

module.exports = router;
