'use strict';

const express = require('express');
const router = express.Router();
const { searchPeople } = require('../../scrapers/search');
const { saveSearchResults } = require('../../utils/storage');
const logger = require('../../utils/logger');

/**
 * POST /api/scrape/search
 * Body: { "query": "John Smith", "location": "New York", "maxPages": 2 }
 */
router.post('/', async (req, res) => {
  const { query, location, maxPages } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Provide "query" in the request body.' });
  }

  const searchQuery = location ? `${query} ${location}` : query;

  try {
    logger.info(`[API] People search: "${searchQuery}"`);
    const results = await searchPeople(searchQuery, { maxPages: maxPages || 2 });
    const searchId = saveSearchResults(searchQuery, results);
    res.json({ success: true, searchId, query: searchQuery, count: results.length, results });
  } catch (err) {
    logger.error(`[API] Search error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
