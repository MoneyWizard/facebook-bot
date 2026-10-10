'use strict';

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { config } = require('../config');
const logger = require('../utils/logger');

chromium.use(StealthPlugin());

// ─── Consistent Session Identity Pool ────────────────────────────────────────
// Each "identity" is a coherent fingerprint: OS + browser + screen + timezone
// must all be internally consistent to avoid detection.

const IDENTITIES = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.120 Safari/537.36',
    platform: 'Win32', viewport: { width: 1920, height: 1080 },
    timezone: 'America/New_York', locale: 'en-US', colorDepth: 24,
    screenWidth: 1920, screenHeight: 1080, deviceMemory: 8, hardwareConcurrency: 8,
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.182 Safari/537.36',
    platform: 'Win32', viewport: { width: 1440, height: 900 },
    timezone: 'America/Chicago', locale: 'en-US', colorDepth: 24,
    screenWidth: 1440, screenHeight: 900, deviceMemory: 8, hardwareConcurrency: 6,
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.88 Safari/537.36',
    platform: 'MacIntel', viewport: { width: 1440, height: 900 },
    timezone: 'America/Los_Angeles', locale: 'en-US', colorDepth: 30,
    screenWidth: 2560, screenHeight: 1600, deviceMemory: 16, hardwareConcurrency: 10,
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.99 Safari/537.36',
    platform: 'MacIntel', viewport: { width: 1280, height: 800 },
    timezone: 'America/Denver', locale: 'en-US', colorDepth: 30,
    screenWidth: 2560, screenHeight: 1664, deviceMemory: 16, hardwareConcurrency: 8,
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.120 Safari/537.36 Edg/127.0.2651.105',
    platform: 'Win32', viewport: { width: 1366, height: 768 },
    timezone: 'America/New_York', locale: 'en-US', colorDepth: 24,
    screenWidth: 1366, screenHeight: 768, deviceMemory: 4, hardwareConcurrency: 4,
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.72 Safari/537.36',
    platform: 'Linux x86_64', viewport: { width: 1920, height: 1080 },
    timezone: 'Europe/London', locale: 'en-GB', colorDepth: 24,
    screenWidth: 1920, screenHeight: 1080, deviceMemory: 8, hardwareConcurrency: 12,
  },
];

// WebGL vendor/renderer pairs (real GPU strings from common machines)
const WEBGL_VENDORS = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
];

/**
 * Pick and lock a single random identity for this browser session.
 * Keeping it consistent throughout the session is critical.
 */
function pickSessionIdentity() {
  return IDENTITIES[Math.floor(Math.random() * IDENTITIES.length)];
}

/**
 * Launch a stealth Playwright browser with a locked session identity.
 * @returns {Promise<{ browser: import('playwright').Browser, identity: Object }>}
 */
async function launchBrowser() {
  const identity = pickSessionIdentity();

  const launchOptions = {
    headless: config.browser.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${identity.viewport.width},${identity.viewport.height + 88}`,
      `--lang=${identity.locale}`,
      // Prevent GPU fingerprinting leaks
      '--disable-software-rasterizer',
      '--disable-accelerated-2d-canvas',
      // Noise canvas reads
      '--enable-features=CanvasOopRasterization',
    ],
  };

  if (config.proxy.url) {
    try {
      const parsed = new URL(config.proxy.url);
      launchOptions.proxy = {
        server: `${parsed.protocol}//${parsed.host}`,
      };
      if (parsed.username) launchOptions.proxy.username = decodeURIComponent(parsed.username);
      if (parsed.password) launchOptions.proxy.password = decodeURIComponent(parsed.password);
    } catch {
      launchOptions.proxy = { server: config.proxy.url };
    }
    logger.info(`Proxy configured: ${config.proxy.url.replace(/:\/\/.*@/, '://[REDACTED]@')}`);
  } else {
    logger.warn('No proxy configured — running directly on local connection.');
  }

  const browser = await chromium.launch(launchOptions);
  logger.debug(`Browser launched | identity: ${identity.platform} | TZ: ${identity.timezone}`);
  return { browser, identity };
}

/**
 * Create a new browser context with the locked identity fingerprint.
 * All values (UA, screen, timezone, locale) are consistent with each other.
 *
 * @param {import('playwright').Browser} browser
 * @param {Object} identity  From pickSessionIdentity()
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function createContext(browser, identity) {
  if (!identity) identity = pickSessionIdentity();

  const webgl = WEBGL_VENDORS[Math.floor(Math.random() * WEBGL_VENDORS.length)];

  // Slightly randomize viewport within ±10px to avoid exact pixel matching
  const viewport = {
    width: identity.viewport.width + Math.floor((Math.random() - 0.5) * 20),
    height: identity.viewport.height + Math.floor((Math.random() - 0.5) * 10),
  };

  const context = await browser.newContext({
    userAgent: identity.userAgent,
    viewport,
    locale: identity.locale,
    timezoneId: identity.timezone,
    colorScheme: 'light',
    extraHTTPHeaders: {
      'Accept-Language': identity.locale === 'en-GB' ? 'en-GB,en;q=0.9' : 'en-US,en;q=0.9',
      'sec-ch-ua': `"Chromium";v="127", "Not)A;Brand";v="99"`,
      'sec-ch-ua-platform': identity.platform.includes('Mac') ? '"macOS"' : identity.platform.includes('Linux') ? '"Linux"' : '"Windows"',
    },
  });

  // ── Deep fingerprint injection ──────────────────────────────────────────────
  await context.addInitScript((fp) => {

    // 1. Hide webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. Consistent platform
    Object.defineProperty(navigator, 'platform', { get: () => fp.platform });

    // 3. Hardware specs (consistent with identity)
    Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });

    // 4. Languages
    Object.defineProperty(navigator, 'languages', { get: () => [fp.locale, fp.locale.split('-')[0]] });
    Object.defineProperty(navigator, 'language', { get: () => fp.locale });

    // 5. Plugins array (empty in headless — spoof with realistic entries)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const fakePlugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        return Object.assign(fakePlugins, { item: (i) => fakePlugins[i], namedItem: (n) => fakePlugins.find(p => p.name === n), refresh: () => {} });
      }
    });

    // 6. Screen dimensions (consistent with identity)
    Object.defineProperty(screen, 'width',       { get: () => fp.screenWidth });
    Object.defineProperty(screen, 'height',      { get: () => fp.screenHeight });
    Object.defineProperty(screen, 'colorDepth',  { get: () => fp.colorDepth });
    Object.defineProperty(screen, 'pixelDepth',  { get: () => fp.colorDepth });

    // 7. Canvas fingerprint noise — add a tiny imperceptible per-session salt
    //    so each session has a unique canvas hash without visible changes
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type, ...args) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, this.width || 1, this.height || 1);
        imageData.data[0] = (imageData.data[0] + fp.canvasSalt) % 256;
        ctx.putImageData(imageData, 0, 0);
      }
      return origToDataURL.apply(this, [type, ...args]);
    };

    // 8. WebGL vendor + renderer spoofing
    const origGetParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return fp.webgl.vendor;    // VENDOR
      if (param === 37446) return fp.webgl.renderer;  // RENDERER
      return origGetParam.apply(this, arguments);
    };
    // Also cover WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return fp.webgl.vendor;
        if (param === 37446) return fp.webgl.renderer;
        return origGetParam2.apply(this, arguments);
      };
    }

    // 9. AudioContext fingerprint noise
    const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
    if (OrigAudioContext) {
      const origCreateOscillator = OrigAudioContext.prototype.createOscillator;
      OrigAudioContext.prototype.createOscillator = function() {
        const osc = origCreateOscillator.apply(this, arguments);
        const origConnect = osc.connect.bind(osc);
        osc.connect = (dest, ...a) => {
          dest.gain && dest.gain.value !== undefined &&
            (dest.gain.value = dest.gain.value + fp.audioSalt * 0.0001);
          return origConnect(dest, ...a);
        };
        return osc;
      };
    }

    // 10. Spoof chrome runtime
    window.chrome = {
      app: { isInstalled: false },
      runtime: {
        id: undefined,
        connect: () => {},
        sendMessage: () => {},
        onConnect: { addListener: () => {} },
        onMessage: { addListener: () => {} },
      },
      csi: () => {},
      loadTimes: () => ({
        commitLoadTime: Date.now() / 1000 - Math.random() * 2,
        connectionInfo: 'h2',
        finishDocumentLoadTime: Date.now() / 1000 - Math.random(),
        finishLoadTime: Date.now() / 1000 - Math.random() * 0.5,
        firstPaintAfterLoadTime: 0,
        firstPaintTime: Date.now() / 1000 - Math.random() * 0.8,
        navigationType: 'Other',
        npnNegotiatedProtocol: 'h2',
        requestTime: Date.now() / 1000 - Math.random() * 3,
        startLoadTime: Date.now() / 1000 - Math.random() * 2.5,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
      }),
    };

    // 11. Battery API (random but realistic battery state)
    Object.defineProperty(navigator, 'getBattery', {
      value: () => Promise.resolve({
        charging: fp.batteryCharging,
        chargingTime: fp.batteryCharging ? fp.batteryChargingTime : Infinity,
        dischargingTime: fp.batteryCharging ? Infinity : fp.batteryDischargingTime,
        level: fp.batteryLevel,
        addEventListener: () => {},
      }),
    });

    // 12. Connection API
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        downlink: 10 + Math.random() * 90,
        rtt: 20 + Math.random() * 60,
        saveData: false,
      }),
    });

  }, {
    platform: identity.platform,
    locale: identity.locale,
    deviceMemory: identity.deviceMemory,
    hardwareConcurrency: identity.hardwareConcurrency,
    screenWidth: identity.screenWidth,
    screenHeight: identity.screenHeight,
    colorDepth: identity.colorDepth,
    webgl,
    canvasSalt: Math.floor(Math.random() * 10) + 1,  // tiny 1–10 pixel tweak per session
    audioSalt: Math.floor(Math.random() * 5) + 1,
    batteryCharging: Math.random() > 0.4,
    batteryLevel: 0.3 + Math.random() * 0.7,
    batteryChargingTime: Math.floor(Math.random() * 3600),
    batteryDischargingTime: Math.floor(1800 + Math.random() * 14400),
  });

  return context;
}

module.exports = { launchBrowser, createContext, pickSessionIdentity };
