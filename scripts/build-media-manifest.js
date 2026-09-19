#!/usr/bin/env node
// Scans media/ for the favicon/social-share image pools and records them in
// content.json's `site_images` key. Re-run after adding new files named
// `icon-*` (favicon candidates, ideally square) or `ogg-*` (social share
// image candidates, ideally ~1200x630+) to media/, then redeploy.
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const MEDIA_DIR = path.join(REPO, 'media');
const CONTENT = process.argv[2] || path.join(REPO, 'content.json');

const EXT_RE = /\.(png|jpe?g|webp)$/i;

function pool(prefix) {
  return fs.readdirSync(MEDIA_DIR)
    .filter((f) => f.toLowerCase().startsWith(prefix) && EXT_RE.test(f))
    .sort()
    .map((f) => `media/${f}`);
}

function main() {
  const data = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  data.site_images = {
    icons: pool('icon-'),
    ogg: pool('ogg-'),
  };
  fs.writeFileSync(CONTENT, JSON.stringify(data, null, 2));

  console.log(`icons: ${data.site_images.icons.length}`);
  data.site_images.icons.forEach((p) => console.log(`  ${p}`));
  console.log(`ogg: ${data.site_images.ogg.length}`);
  data.site_images.ogg.forEach((p) => console.log(`  ${p}`));
}

main();
