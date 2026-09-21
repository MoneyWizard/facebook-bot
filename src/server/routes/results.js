'use strict';

const express = require('express');
const router = express.Router();
const {
  getProfiles,
  getProfileById,
  getSearchResults,
  getAnalysesByProfileId,
} = require('../../utils/storage');

/**
 * GET /api/results/profiles
 * Query params: name, username, limit, offset
 */
router.get('/profiles', (req, res) => {
  const { name, username, limit, offset } = req.query;
  const profiles = getProfiles({
    name,
    username,
    limit: parseInt(limit || '50'),
    offset: parseInt(offset || '0'),
  });
  res.json({ count: profiles.length, profiles });
});

/**
 * GET /api/results/profiles/:id
 */
router.get('/profiles/:id', (req, res) => {
  const profile = getProfileById(parseInt(req.params.id));
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const analyses = getAnalysesByProfileId(profile.id);
  res.json({ profile, analyses });
});

/**
 * GET /api/results/searches
 * Query params: limit, offset
 */
router.get('/searches', (req, res) => {
  const { limit, offset } = req.query;
  const searches = getSearchResults({
    limit: parseInt(limit || '20'),
    offset: parseInt(offset || '0'),
  });
  res.json({ count: searches.length, searches });
});

module.exports = router;
