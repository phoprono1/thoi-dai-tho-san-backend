const fs = require('fs');
const path = require('path');

async function run() {
  const assetsDir = path.join(process.cwd(), 'assets', 'test');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
  const originalPath = path.join(assetsDir, 'sample.png');

  const sharp = require('sharp');

  // create a simple solid PNG using sharp's create option
  await sharp({
    create: {
      width: 400,
      height: 200,
      channels: 3,
      background: '#2b6cb0',
    },
  })
    .png()
    .toFile(originalPath);

  const thumbsDir = path.join(assetsDir, 'thumbs');
  if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

  const base = 'sample';
  await sharp(originalPath)
    .resize(64, 64, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(path.join(thumbsDir, `${base}_64.webp`));
  await sharp(originalPath)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(path.join(thumbsDir, `${base}_256.webp`));

  console.log('Generated thumbnails at', thumbsDir);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
