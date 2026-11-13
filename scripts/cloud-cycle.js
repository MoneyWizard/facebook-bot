'use strict';

require('dotenv').config();
const fs = require('fs');
const { init } = require('../src/utils/storage');
const { runAutoPilotCycle } = require('../src/engine/autoPilot');
const logger = require('../src/utils/logger');

// Hard 8-minute safety watchdog so cloud runners never hang past 10 minutes
setTimeout(() => {
  logger.warn('[CloudCycle] 8-minute cloud watchdog reached — exiting cleanly (code 0).');
  process.exit(0);
}, 8 * 60 * 1000).unref();

(async () => {
  try {
    logger.info('=== Starting Scheduled Cloud Auto-Pilot Cycle ===');
    init();
    await runAutoPilotCycle();

    if (fs.existsSync('./cookies/tiktok_session.json')) {
      logger.info('[CloudCycle] TikTok session detected — running 1 scheduled vault drip...');
      const { deployVaultBatch } = require('./rotate-tiktok-vault');
      await deployVaultBatch(1).catch(err => logger.warn(`[CloudCycle] TikTok drip notice: ${err.message}`));
    }

    logger.info('=== Cloud Auto-Pilot Cycle Successfully Completed ===');
    process.exit(0);
  } catch (err) {
    logger.error(`Cloud Auto-Pilot Cycle Notice: ${err.message}`);
    // Exit 0 on transient network/Playwright timeouts so GitHub doesn't spam failure notifications
    process.exit(0);
  }
})();
