'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createPost } = require('../src/actions/post');
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
    postText: `🔥 NEW MUSIC RELEASE ANNOUNCEMENT 🔥\n\n"Too Mean For The Choir"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nType: Official Single\nRelease Date: November 13, 2026\n\nPre-save and stream the track early right here:\n👉 https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir\n\n#WeldonGiles #HexNemesisProductions #TooMeanForTheChoir #NewMusic #DistroKid #SingleRelease #IndependentArtist #MusicDrop`,
  },
  {
    title: 'Pocket Full Of Fucks',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    type: 'Single',
    releaseDate: 'November 6, 2026',
    url: 'https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks',
    imagePath: path.resolve('./data/release_assets/pocket_full_of_fucks.png'),
    postText: `🚨 OFFICIAL RELEASE ANNOUNCEMENT 🚨\n\n"Pocket Full Of Fucks"\nArtist: Weldon Giles\nProduced By: HexNemesis Productions\nType: Official Single\nRelease Date: November 6, 2026\n\nTap in, pre-save, and get ready for the drop:\n👉 https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks\n\n#WeldonGiles #HexNemesisProductions #PocketFullOfFucks #NewMusicAlert #DistroKid #PreSaveNow #UndergroundHipHop #OfficialRelease`,
  }
];

async function syndicateReleaseDrops() {
  logger.info('====================================================');
  logger.info('🚀 STARTING FULL NETWORK SYNDICATION FOR WELDON GILES RELEASES');
  logger.info('====================================================');

  const report = [];

  for (const rel of RELEASES) {
    logger.info(`\n>>> SYNDICATING DROP: "${rel.title}" (Artist: ${rel.artist}) <<<`);

    // 1. Personal Facebook Profile Timeline
    try {
      logger.info(`[Syndicator] Posting "${rel.title}" to Facebook Personal Profile...`);
      const fbResult = await createPost({
        targetUrl: 'https://www.facebook.com/',
        text: rel.postText,
        attachDiagram: false,
        imagePath: rel.imagePath,
      });
      logger.info(`[Syndicator] Personal Profile result for "${rel.title}": ${JSON.stringify(fbResult)}`);
      report.push({ release: rel.title, channel: 'Facebook Personal Timeline', status: fbResult.success ? 'SUCCESS' : 'FAILED', details: fbResult.message });
    } catch (err) {
      logger.error(`[Syndicator] Personal Profile error: ${err.message}`);
      report.push({ release: rel.title, channel: 'Facebook Personal Timeline', status: 'ERROR', details: err.message });
    }

    // Wait 30 seconds between platform strikes to maintain natural human behavior
    await new Promise(r => setTimeout(r, 20000));

    // 2. Meta Business Suite Unified Cross-Post (Page + Instagram Feed)
    try {
      logger.info(`[Syndicator] Posting "${rel.title}" to Meta Business Suite (FB Page + Instagram)...`);
      const bsResult = await createBusinessSuitePost({
        text: rel.postText,
        promoLink: rel.url,
        imagePath: rel.imagePath,
      });
      logger.info(`[Syndicator] Business Suite result for "${rel.title}": ${JSON.stringify(bsResult)}`);
      report.push({ release: rel.title, channel: 'Meta Business Suite (FB Page + Instagram)', status: bsResult.success ? 'SUCCESS' : 'FAILED', details: bsResult.message });
    } catch (err) {
      logger.error(`[Syndicator] Business Suite error: ${err.message}`);
      report.push({ release: rel.title, channel: 'Meta Business Suite (FB Page + Instagram)', status: 'ERROR', details: err.message });
    }

    // Delay between release 1 and release 2
    logger.info(`[Syndicator] Pacing 35s before launching next release drop...`);
    await new Promise(r => setTimeout(r, 35000));
  }

  logger.info('\n====================================================');
  logger.info('🏁 ALL RELEASE DROPS DISPATCHED');
  logger.info('====================================================');
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  syndicateReleaseDrops()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { syndicateReleaseDrops };
