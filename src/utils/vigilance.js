'use strict';

/**
 * Vigilance & Security Engine
 * Centralizes automated authentication credentials, human stealth pacing,
 * and adaptive velocity thresholds to dominate the platforms under the radar.
 */

require('dotenv').config();

const CREDENTIALS = {
  get standardPassword() {
    return process.env.DEFAULT_ACCOUNT_PASSWORD || '';
  },
  get highStrengthPassword() {
    return process.env.HIGH_STRENGTH_ACCOUNT_PASSWORD || '';
  },
};

// Tactical platform limits tuned for maximum daily throughput without tripwires
const ADAPTIVE_LIMITS = {
  facebook: {
    maxFriendsPerDay: 150,
    maxLikesPerDay: 60,
    maxCommentsPerDay: 30,
    maxPostsPerDay: 10,
    minActionIntervalMs: 15000,
  },
  instagram: {
    maxStorySnipesPerDay: 50,
    maxFollowsPerDay: 40,
    maxLikesPerDay: 60,
    maxDMsPerDay: 20,
    minActionIntervalMs: 25000,
  },
  businessSuite: {
    maxUnifiedPostsPerDay: 8,
    inboxCheckIntervalMs: 30 * 60 * 1000, // 30 minutes
  },
  predatorScraper: {
    maxScrapesPerHour: 40,
    delayBetweenListingsMs: 8000,
  },
};

/**
 * Get credentials formatted for required complexity.
 * @param {boolean} requireSpecialChar
 * @returns {string}
 */
function getStandardPassword(requireSpecialChar = true) {
  return requireSpecialChar ? CREDENTIALS.highStrengthPassword : CREDENTIALS.standardPassword;
}

module.exports = {
  CREDENTIALS,
  ADAPTIVE_LIMITS,
  getStandardPassword,
};
