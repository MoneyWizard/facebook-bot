'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createBusinessSuitePost } = require('../src/actions/businessSuite');
const logger = require('../src/utils/logger');

const RELEASES = [
  {
    title: 'Too Mean For The Choir',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    type: 'Single',
    releaseDate: 'November 13, 2026',
    url: 'https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir',
    imagePath: path.resolve('./data/release_assets/too_mean_for_the_choir.png'),
    text: `🔥 NEW MUSIC RELEASE ANNOUNCEMENT 🔥\n\n"Too Mean For The Choir"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nType: Official Single\nRelease Date: November 13, 2026\n\nPre-save & stream early on all platforms:\n👉 https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir\n\n#WeldonGiles #HexNemesisProductions #TooMeanForTheChoir #NewMusic #DistroKid #PreSaveNow`,
  },
  {
    title: 'Pocket Full Of Fucks',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    type: 'Single',
    releaseDate: 'November 6, 2026',
    url: 'https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks',
    imagePath: path.resolve('./data/release_assets/pocket_full_of_fucks.png'),
    text: `🚨 OFFICIAL RELEASE ANNOUNCEMENT 🚨\n\n"Pocket Full Of Fucks"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nType: Official Single\nRelease Date: November 6, 2026\n\nTap in, pre-save, and lock in for the drop:\n👉 https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks\n\n#WeldonGiles #HexNemesisProductions #PocketFullOfFucks #NewMusicAlert #DistroKid #PreSaveNow #OfficialRelease`,
  }
];

async function run() {
  for (const rel of RELEASES) {
    logger.info(`[BusinessSuiteDrop] Launching cross-post for "${rel.title}"...`);
    try {
      const res = await createBusinessSuitePost({
        text: rel.text,
        imagePath: rel.imagePath,
        attachDiagram: true,
      });
      console.log('BUSINESS_SUITE_RESULT:', JSON.stringify(res));
    } catch (err) {
      logger.error(`[BusinessSuiteDrop] Failed "${rel.title}": ${err.message}`);
    }
    logger.info('Waiting 30 seconds before next Business Suite submission...');
    await new Promise(r => setTimeout(r, 30000));
  }
}

run().then(() => {
  logger.info('[BusinessSuiteDrop] All Business Suite cross-posts completed.');
  process.exit(0);
}).catch(err => {
  logger.error(`[BusinessSuiteDrop] Fatal error: ${err.message}`);
  process.exit(1);
});
