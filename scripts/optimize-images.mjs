// Runs automatically on every deploy (.github/workflows/deploy.yml, before
// `astro build`), so any new full-size image dropped into public/media/ -
// e.g. from a future WP scrape/CSV update - gets shrunk before it ships,
// with no one needing to remember to run this by hand. Already-optimized
// files are cheap no-ops (skipped if re-encoding wouldn't shrink them
// further), so re-running this on every build is fine. Can also be run
// manually: node scripts/optimize-images.mjs
//
// Rewrites in place - same filename, same extension - so nothing in
// content.json needs to change. Skips public/media/sponsors/* (already
// sized/compressed when those logos were added) and any non-image files
// (e.g. the couple of .webp assets, already an efficient format).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const MEDIA_DIR = path.join(process.cwd(), 'public/media');
const MAX_DIMENSION = 1600; // no on-page use or og:image needs more than this

async function optimize(filePath) {
  const before = fs.statSync(filePath).size;
  const ext = path.extname(filePath).toLowerCase();
  const image = sharp(filePath);
  const meta = await image.metadata();

  let pipeline = image;
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  if (ext === '.png') {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true, quality: 90 });
  } else {
    pipeline = pipeline.jpeg({ mozjpeg: true, quality: 82 });
  }

  const buffer = await pipeline.toBuffer();
  // Only overwrite if it's actually smaller - a few already-small/simple
  // images can grow slightly under palette quantization.
  if (buffer.length < before) {
    fs.writeFileSync(filePath, buffer);
    return { before, after: buffer.length };
  }
  return { before, after: before };
}

const files = fs.readdirSync(MEDIA_DIR)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .map((f) => path.join(MEDIA_DIR, f));

let totalBefore = 0;
let totalAfter = 0;
for (const file of files) {
  const { before, after } = await optimize(file);
  totalBefore += before;
  totalAfter += after;
  if (after < before) {
    console.log(path.basename(file), (before / 1024).toFixed(0) + 'KB', '->', (after / 1024).toFixed(0) + 'KB');
  }
}

console.log('---');
console.log('Total:', (totalBefore / 1024 / 1024).toFixed(1) + 'MB', '->', (totalAfter / 1024 / 1024).toFixed(1) + 'MB');
console.log('Saved:', (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1) + '%');
