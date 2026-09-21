'use strict';

const express = require('express');
const router = express.Router();
const { analyzeProfile, listModes } = require('../../ai/analyzer');
const { getProfileById, saveAnalysis } = require('../../utils/storage');
const logger = require('../../utils/logger');

/**
 * GET /api/analyze/modes
 * Returns available analysis modes.
 */
router.get('/modes', (req, res) => {
  res.json({ modes: listModes() });
});

/**
 * POST /api/analyze
 * Body: {
 *   "profileId": 1,           // ID from the database
 *   "mode": "summarize",      // summarize | categorize | privacy_audit | sentiment | custom
 *   "customPrompt": "..."     // required when mode === "custom"
 * }
 */
router.post('/', async (req, res) => {
  const { profileId, mode, customPrompt } = req.body;

  if (!profileId) {
    return res.status(400).json({ error: 'Provide "profileId" in the request body.' });
  }

  const profile = getProfileById(profileId);
  if (!profile) {
    return res.status(404).json({ error: `Profile with id ${profileId} not found.` });
  }

  try {
    logger.info(`[API] Analyze profile #${profileId} mode="${mode || 'summarize'}"`);
    const { result, usage, model } = await analyzeProfile(profile, mode || 'summarize', customPrompt);
    const analysisId = saveAnalysis(profileId, mode || 'summarize', result, customPrompt, model);
    res.json({ success: true, analysisId, mode: mode || 'summarize', result, usage });
  } catch (err) {
    logger.error(`[API] Analyze error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
