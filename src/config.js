'use strict';

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT || '3500', 10),

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o',
  },

  // Proxy
  proxy: {
    url: process.env.PROXY_URL || null,
  },

  // Browser
  browser: {
    headless: process.env.HEADLESS !== 'false',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  },

  // Scraping
  scraping: {
    delayMin: parseInt(process.env.SCRAPE_DELAY_MIN || '2000', 10),
    delayMax: parseInt(process.env.SCRAPE_DELAY_MAX || '6000', 10),
    maxPosts: parseInt(process.env.MAX_POSTS || '10', 10),
    maxSearchPages: parseInt(process.env.MAX_SEARCH_PAGES || '3', 10),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Paths
  paths: {
    cookies: './cookies/session.json',
    db: './data/facebook-bot.json',
  },
};

/**
 * Validates that required config values are present.
 * Warns (does not crash) if optional values are missing.
 */
function validate() {
  const warnings = [];

  if (!config.openai.apiKey) {
    warnings.push('OPENAI_API_KEY is not set — AI analysis will be unavailable.');
  }
  if (!config.proxy.url) {
    warnings.push(
      'PROXY_URL is not set — running without a proxy. Facebook may block requests quickly.\n' +
      '  → Free option: https://webshare.io (10 free residential IPs/month)\n' +
      '  → Set PROXY_URL in your .env file once you have credentials.'
    );
  }

  return warnings;
}

module.exports = { config, validate };
