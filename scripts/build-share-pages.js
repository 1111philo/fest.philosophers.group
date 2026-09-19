#!/usr/bin/env node
// Generates a real, crawlable URL for every presentation and for the
// About/Sponsor pages: p/<slug>/, about/, sponsor/. GitHub Pages is plain
// static hosting with no server-side logic, so a single index.html can't
// show a different <meta og:image> per shared link - social crawlers read
// whatever's baked into the HTML they fetch and never run JavaScript. So
// each of these is its own small static page with real meta tags baked in
// at generation time, that sends a real visitor into the interactive app
// (index.html, which opens the right drawer/modal from the #presentation/
// <slug>, #about or #sponsor hash) via a redirect crawlers never follow.
//
// Re-run this whenever content.json changes, then redeploy.
'use strict';
const fs = require('fs');
const path = require('path');
const { escapeHtml, stripTags, truncate } = require('./lib/text');

const REPO = path.dirname(__dirname);
const CONTENT = process.argv[2] || path.join(REPO, 'content.json');
const SITE_URL = 'https://fest.philosophers.group';

function page({ title, heading, description, url, ogType, image, imageW, imageH, redirect }) {
  const t = escapeHtml(title);
  const h = escapeHtml(heading);
  const d = escapeHtml(description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="New Orleans Arts &amp; Ideas Festival">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="${imageW}">
<meta property="og:image:height" content="${imageH}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(redirect)}">
<script>location.replace(${JSON.stringify(redirect)});</script>
<style>
  body { font-family: Georgia, serif; background: #f6f3ee; color: #241d15; max-width: 640px; margin: 60px auto; padding: 0 20px; line-height: 1.6; }
  a { color: #a8752c; }
</style>
</head>
<body>
<p>Redirecting to the New Orleans Arts &amp; Ideas Festival schedule&hellip;</p>
<h1>${h}</h1>
<p>${d}</p>
<p><a href="${escapeHtml(redirect)}">Continue to the schedule &rarr;</a></p>
</body>
</html>
`;
}

function writePage(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main() {
  const data = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  const mediaById = new Map(data.media.map((m) => [m.id, m]));
  const oggPool = (data.site_images && data.site_images.ogg) || [];

  function imageFor(featuredMediaId, fallbackKey) {
    const m = mediaById.get(featuredMediaId);
    if (m) {
      return [`${SITE_URL}/${m.source_url}`, m.media_details.width, m.media_details.height];
    }
    if (oggPool.length) {
      const pick = oggPool[fallbackKey % oggPool.length];
      return [`${SITE_URL}/${pick}`, 1424, 752];
    }
    return [`${SITE_URL}/media/ogg-arts.png`, 1424, 752];
  }

  let count = 0;
  for (const p of data.presentations) {
    if (!p.slug) continue;
    const title = stripTags(p.title.rendered);
    const excerpt = stripTags((p.excerpt || {}).rendered || '');
    const sf = p.scraped_fields || {};
    const description = truncate(excerpt || sf.presenter_bio || stripTags(p.content.rendered) || title);
    const [image, imageW, imageH] = imageFor(p.featured_media, p.id);
    const url = `${SITE_URL}/p/${p.slug}/`;
    writePage(
      path.join(REPO, 'p', p.slug, 'index.html'),
      page({
        title: `${title} — NOAI`,
        heading: title,
        description,
        url,
        ogType: 'article',
        image, imageW, imageH,
        redirect: `/#presentation/${p.slug}`,
      }),
    );
    count += 1;
  }
  console.log(`wrote ${count} presentation share pages`);

  const pagesById = new Map(data.pages.map((pg) => [pg.id, pg]));
  const pageSpecs = [
    [469, 'about', '#about', 'website'],
    [620, 'sponsor', '#sponsor', 'website'],
  ];
  for (const [pageId, slug, hashTarget, ogType] of pageSpecs) {
    const pg = pagesById.get(pageId);
    if (!pg) continue;
    const title = stripTags(pg.title.rendered);
    const description = truncate(stripTags(pg.content.rendered) || title);
    let [image, imageW, imageH] = imageFor(pg.featured_media, pageId);
    // Prefer the page's own first inline image (e.g. About's gallery) over the random pool.
    const firstImgMatch = /src="(media\/[^"]+)"/.exec(pg.content.rendered || '');
    if (firstImgMatch) {
      const match = data.media.find((m) => m.source_url === firstImgMatch[1]);
      if (match) {
        image = `${SITE_URL}/${firstImgMatch[1]}`;
        imageW = match.media_details.width;
        imageH = match.media_details.height;
      }
    }
    const url = `${SITE_URL}/${slug}/`;
    writePage(
      path.join(REPO, slug, 'index.html'),
      page({
        title: `${title} — NOAI`,
        heading: title,
        description,
        url,
        ogType,
        image, imageW, imageH,
        redirect: `/${hashTarget}`,
      }),
    );
    console.log(`wrote ${slug}/index.html`);
  }
}

main();
