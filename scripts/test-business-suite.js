'use strict';

require('dotenv').config();
const { createBusinessSuitePost } = require('../src/actions/businessSuite');
const logger = require('../src/utils/logger');

(async () => {
  try {
    logger.info('=== Starting Meta Business Suite Live Test ===');
    const result = await createBusinessSuitePost({
      promoLink: 'https://hexnemesis.com/home.html',
      topic: 'digital framing math, rafter cuts, and stair layout calculators for custom builders',
      attachDiagram: true,
      diagramType: 'rafter',
    });
    logger.info(`=== Test Success: ${JSON.stringify(result, null, 2)} ===`);
    process.exit(0);
  } catch (err) {
    logger.error(`=== Test Failed: ${err.message} ===`);
    process.exit(1);
  }
})();
