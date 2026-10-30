'use strict';

const https = require('https');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  const choirHtml = await fetchPage('https://distrokid.com/hyperfollow/weldongiles/too-mean-for-the-choir');
  const pocketHtml = await fetchPage('https://distrokid.com/hyperfollow/weldongiles/pocket-full-of-fucks');

  const extract = (html, name) => {
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/i) || html.match(/id="albumArt"[^>]+src="([^"]+)"/i) || html.match(/<img[^>]+src="([^"]+distrokid[^"]+)"/i);
    const releaseDate = html.match(/Release date:[^<]+<[^>]+>([^<]+)/i) || html.match(/([A-Z][a-z]+ \d{1,2}, \d{4})/);
    return {
      name,
      ogImage: ogImage ? ogImage[1] : null,
      releaseDate: releaseDate ? releaseDate[1] : null,
      imgTags: (html.match(/<img[^>]+>/gi) || []).slice(0, 3)
    };
  };

  console.log('CHOIR:', JSON.stringify(extract(choirHtml, 'Too Mean For The Choir'), null, 2));
  console.log('POCKET:', JSON.stringify(extract(pocketHtml, 'Pocket Full Of Fucks'), null, 2));
})();
