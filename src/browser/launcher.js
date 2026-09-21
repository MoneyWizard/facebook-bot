'use strict';

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { config } = require('../config');
const logger = require('../utils/logger');

// Apply the stealth plugin — masks navigator.webdriver, plugins, canvas
// fingerprints, and more common CDP-detection markers.
chromium.use(StealthPlugin());

// Randomized user agents to rotate between sessions
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
];

/**
 * Launch a stealth Playwright browser.
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchBrowser() {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];

  const launchOptions = {
    headless: config.browser.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      `--window-size=${viewport.width},${viewport.height}`,
    ],
  };

  // Inject proxy if configured
  if (config.proxy.url) {
    launchOptions.proxy = { server: config.proxy.url };
    logger.info(`Using proxy: ${config.proxy.url.replace(/:\/\/.*@/, '://***@')}`);
  } else {
    logger.warn('No proxy configured — Facebook may block this request.');
  }

  const browser = await chromium.launch(launchOptions);
  logger.debug(`Browser launched (headless=${config.browser.headless})`);
  return browser;
}

/**
 * Create a new browser context with randomized fingerprint.
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function createContext(browser) {
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['notifications'],
    // Spoof color scheme to look like a real user
    colorScheme: 'light',
    // Block WebRTC IP leaks
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Override navigator properties to further evade detection
  await context.addInitScript(() => {
    // Hide automation markers
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    // Spoof chrome runtime
    window.chrome = { runtime: {} };
  });

  return context;
}

module.exports = { launchBrowser, createContext };
