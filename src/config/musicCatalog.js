'use strict';

/**
 * Official Music Arsenal, Clip-Matched Hashtag Matrix & Mentions
 * Artist: Weldon Giles | Producer: HexNemesis Productions
 * Genre: #OutlawCountry #DarkAmericana
 */

const ENGINE_TAGS = '#DistroKid #OriginalMusic #IndependentArtist #fyp';
const MENTIONS = '@weldongiles @distrokid @spotify';

const VISUAL_TAG_MATRIX = {
  thunder: '#TropicThunder #LesGrossman #TomCruise #ComedyEdit #MovieEdit',
  yoda: '#TheMandalorian #Grogu #BabyYoda #StarWarsEdit #Mando',
  elaine: '#Seinfeld #ElaineBenes #JuliaLouisDreyfus #ComedyEdit #TVEdit',
  rope: '#OutlawVibes #SouthernGothic #DarkCountry #CinematicEdit #MusicVideo',
  dock: '#BackwaterVibes #DarkAmericana #SouthernGothic #MoodyEdit #MusicVideo',
  flames: '#Hellfire #DarkCountry #OutlawAnthem #FireEdit #MusicVideo',
  default: '#NewMusicAlert #OutlawVibes #SouthernGothic #MusicEdit #ViralMusic',
};

const MUSIC_CATALOG = {
  pocket: {
    id: 'pocket',
    title: 'Pocket Full Of Fucks',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    brandTags: '#WeldonGiles #PocketFullOfFucks #HexNemesisProductions #OutlawCountry #DarkAmericana',
    links: {
      spotifyAlbum: 'https://open.spotify.com/album/6ALr3nL7jJrNEFNx2I0Z4I?si=6V0cVZF7TTGrOw9t8wsJNA',
      spotifyDirect: 'https://open.spotify.com/album/6ALr3nL7jJrNEFNx2I0Z4I',
      hyperfollow: 'https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks',
      appleMusic: 'https://music.apple.com/us/album/pocket-full-of-f-s-single/6828799103?uo=4&app=itunes&at=1001lry3&ct=dashboard',
      amazonMusic: 'https://amazon.com/music/player/artists/B0HPS3BHSB/weldon-giles?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_T80qwIy2mTbhm1A3tTOxLu8me',
      miniVideo1: 'https://distrokid.com/videos/watch/mv-0wZ7lQRs0',
      miniVideoRope: 'https://distrokid.com/videos/watch/mv-i6MTy4X9o',
    },
    hooks: [
      '🚨 Weldon Giles - "Pocket Full Of Fucks" [OUT NOW] Produced by HexNemesis Productions 🩸 Stream on Spotify: https://open.spotify.com/album/6ALr3nL7jJrNEFNx2I0Z4I | All Platforms: https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks',
      '⚡ Zero filter. Zero apologies. "Pocket Full Of Fucks" by Weldon Giles (Prod. HexNemesis Productions) 🔥 Spotify: https://open.spotify.com/album/6ALr3nL7jJrNEFNx2I0Z4I | Apple Music: https://music.apple.com/us/album/pocket-full-of-f-s-single/6828799103?uo=4',
      '🩸 Run it up on Spotify, Apple Music & Amazon! Weldon Giles - "Pocket Full Of Fucks" (Produced by HexNemesis Productions) 🎧 https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks',
    ],
    facebookPosts: [
      `🚨 STREAMING EVERYWHERE NOW 🚨\n\n"Pocket Full Of Fucks" — Weldon Giles\nProduced by HexNemesis Productions 🩸\n\n🟢 Spotify: https://open.spotify.com/album/6ALr3nL7jJrNEFNx2I0Z4I?si=6V0cVZF7TTGrOw9t8wsJNA\n🍎 Apple Music / iTunes: https://music.apple.com/us/album/pocket-full-of-f-s-single/6828799103?uo=4&app=itunes&at=1001lry3&ct=dashboard\n📦 Amazon Music: https://amazon.com/music/player/artists/B0HPS3BHSB/weldon-giles?marketplaceId=ATVPDKIKX0DER&musicTerritory=US&ref=dm_sh_T80qwIy2mTbhm1A3tTOxLu8me\n🔗 All Platforms (HyperFollow): https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks\n\n#WeldonGiles #PocketFullOfFucks #HexNemesisProductions #OutlawCountry #DarkAmericana #DistroKid #OriginalMusic #IndependentArtist @weldongiles @distrokid @spotify`,
    ],
  },
  choir: {
    id: 'choir',
    title: 'Too Mean For The Choir',
    artist: 'Weldon Giles',
    producer: 'HexNemesis Productions',
    brandTags: '#WeldonGiles #TooMeanForTheChoir #HexNemesisProductions #OutlawCountry #DarkAmericana',
    links: {
      hyperfollow: 'https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir',
      appleMusic: 'https://music.apple.com/us/album/too-mean-for-the-choir-single/6828674467?uo=4',
      itunes: 'https://music.apple.com/us/album/too-mean-for-the-choir-single/6828674467?uo=4',
      miniVideoDock: 'https://distrokid.com/videos/watch/mv-8Nt2fVVq0',
      miniVideoFlames: 'https://distrokid.com/videos/watch/mv-Cc80zYM2z',
    },
    hooks: [
      '🔥 Weldon Giles - "Too Mean For The Choir" [Official Single] Produced by HexNemesis Productions ⚡ Apple Music & iTunes: https://music.apple.com/us/album/too-mean-for-the-choir-single/6828674467?uo=4 | HyperFollow: https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir',
      '⚡ Some of us weren\'t built for the back pew. "Too Mean For The Choir" by Weldon Giles (Prod. HexNemesis Productions) 🔥 Stream & Pre-Save: https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir',
    ],
    facebookPosts: [
      `🔥 OFFICIAL SINGLE DROP 🔥\n\n"Too Mean For The Choir" — Weldon Giles\nProduced by HexNemesis Productions ⚡\n\n🍎 Apple Music / iTunes: https://music.apple.com/us/album/too-mean-for-the-choir-single/6828674467?uo=4\n🔗 All Platforms (HyperFollow): https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir\n🎬 Watch Mini Video: https://distrokid.com/videos/watch/mv-Cc80zYM2z\n\n#WeldonGiles #TooMeanForTheChoir #HexNemesisProductions #OutlawCountry #DarkAmericana #DistroKid #OriginalMusic #IndependentArtist @weldongiles @distrokid @spotify`,
    ],
  },
};

/**
 * Builds the exact 3-tier caption (Hook + Links + Track/Brand Tags + Clip-Matched Visual Tags + Engine Tags + Mentions)
 */
function buildClipCaption(filename, trackKey) {
  const track = MUSIC_CATALOG[trackKey] || MUSIC_CATALOG.pocket;
  const hook = track.hooks[Math.floor(Math.random() * track.hooks.length)];
  const lower = (filename || '').toLowerCase();

  let visualTags = VISUAL_TAG_MATRIX.default;
  if (lower.includes('thunder')) visualTags = VISUAL_TAG_MATRIX.thunder;
  else if (lower.includes('yoda')) visualTags = VISUAL_TAG_MATRIX.yoda;
  else if (lower.includes('elaine')) visualTags = VISUAL_TAG_MATRIX.elaine;
  else if (lower.includes('rope')) visualTags = VISUAL_TAG_MATRIX.rope;
  else if (lower.includes('dock')) visualTags = VISUAL_TAG_MATRIX.dock;
  else if (lower.includes('flames')) visualTags = VISUAL_TAG_MATRIX.flames;

  return `${hook} ${track.brandTags} ${visualTags} ${ENGINE_TAGS} ${MENTIONS}`;
}

// Keep backwards-compatible tiktokCaptions array on each track
MUSIC_CATALOG.pocket.tiktokCaptions = MUSIC_CATALOG.pocket.hooks.map(
  h => `${h} ${MUSIC_CATALOG.pocket.brandTags} ${VISUAL_TAG_MATRIX.default} ${ENGINE_TAGS} ${MENTIONS}`
);
MUSIC_CATALOG.choir.tiktokCaptions = MUSIC_CATALOG.choir.hooks.map(
  h => `${h} ${MUSIC_CATALOG.choir.brandTags} ${VISUAL_TAG_MATRIX.default} ${ENGINE_TAGS} ${MENTIONS}`
);

module.exports = {
  MUSIC_CATALOG,
  VISUAL_TAG_MATRIX,
  ENGINE_TAGS,
  MENTIONS,
  buildClipCaption,
};
