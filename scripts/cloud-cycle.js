'use strict';

require('dotenv').config();
const { init } = require('../src/utils/storage');
const { runAutoPilotCycle } = require('../src/engine/autoPilot');
const logger = require('../src/utils/logger');

(async () => {
  try {
    logger.info('=== Starting Scheduled Cloud Auto-Pilot Cycle ===');
    init();
    await runAutoPilotCycle();
    logger.info('=== Cloud Auto-Pilot Cycle Successfully Completed ===');
    process.exit(0);
  } catch (err) {
    logger.error(`Cloud Auto-Pilot Cycle Error: ${err.message}`);
    process.exit(1);
  }
})();
