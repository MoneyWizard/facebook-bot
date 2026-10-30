'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

(async () => {
  const mediaDir = path.resolve('./data/release_assets');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  const choirArt = 'https://distrokid.imgix.net/http%3A%2F%2Fgather.fandalism.com%2F13862097--C505E598-02CA-4E3E-A31285FC9C5BA1D1--0--15882733--TooMeanForTheChoifinalsigned.png?fm=jpg&q=90&w=1200';
  const pocketArt = 'https://distrokid.imgix.net/http%3A%2F%2Fgather.fandalism.com%2F13862097--6902F957-8029-40E6-AB826C5789B6A168--0--13733061--PocketFullOfFuckssigned.png?fm=jpg&q=90&w=1200';

  const choirPath = path.join(mediaDir, 'too_mean_for_the_choir.jpg');
  const pocketPath = path.join(mediaDir, 'pocket_full_of_fucks.jpg');

  console.log('Downloading Too Mean For The Choir cover art...');
  await download(choirArt, choirPath);
  console.log('Saved to:', choirPath, '(Size:', fs.statSync(choirPath).size, 'bytes)');

  console.log('Downloading Pocket Full Of Fucks cover art...');
  await download(pocketArt, pocketPath);
  console.log('Saved to:', pocketPath, '(Size:', fs.statSync(pocketPath).size, 'bytes)');

  console.log('ALL ASSETS READY.');
})();
