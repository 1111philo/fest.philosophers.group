// Reads content.json once at build time and derives the per-page
// title/description/OG-image data each generated page needs - used by
// src/pages/p/[slug].astro's getStaticPaths() and by about.astro/
// sponsor.astro.
import fs from 'node:fs';
import path from 'node:path';
import { stripTags, truncate } from './text.mjs';
import { routeSlug } from './slug.js';

// process.cwd() rather than a path relative to this file's own location:
// Vite relocates this module during the build, which would otherwise
// silently break a __dirname-relative path.
const CONTENT_PATH = path.join(process.cwd(), 'public/content.json');
export const SITE_URL = 'https://fest.philosophers.group';

let cached = null;
export function loadContent() {
  if (!cached) cached = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
  return cached;
}

// The presentation/page's own featured image if it has one, otherwise a
// pick from the ogg-* pool that's stable per item (so repeated builds don't
// churn which fallback image an item gets).
export function imageFor(content, featuredMediaId, fallbackKey) {
  const media = content.media.find((m) => m.id === featuredMediaId);
  if (media) {
    return {
      url: `${SITE_URL}/${media.source_url}`,
      width: media.media_details.width,
      height: media.media_details.height,
    };
  }
  const oggPool = (content.site_images && content.site_images.ogg) || [];
  if (oggPool.length) {
    const pick = oggPool[fallbackKey % oggPool.length];
    return { url: `${SITE_URL}/${pick}`, width: 1424, height: 752 };
  }
  return { url: `${SITE_URL}/media/ogg-arts.png`, width: 1424, height: 752 };
}

// Minimal, dependency-free PNG/JPEG dimension reader - just enough to give
// social/iMessage link previews a correctly-sized og:image, without pulling
// in an image library for something this small.
function readImageSize(absPath) {
  const buf = fs.readFileSync(absPath);
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buf.length && buf[offset] === 0xff) {
      const marker = buf[offset + 1];
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
      const length = buf.readUInt16BE(offset + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}

// A presenter's photo (scraped_fields.presenter_photo_url) lives outside
// the normal WP media pool - content.media has no entry for it - so it
// isn't reachable through imageFor()'s featured_media lookup. Used as a
// fallback so link previews show the actual speaker instead of a random
// generic image whenever a presentation's featured_media is missing or
// stale (about a quarter of them, checked against content.media).
function presenterPhotoImage(sourceUrl) {
  try {
    const size = readImageSize(path.join(process.cwd(), 'public', sourceUrl));
    if (size) return { url: `${SITE_URL}/${sourceUrl}`, ...size };
  } catch {
    // File missing or unreadable - fall through to the generic pool image.
  }
  return null;
}

export function presentationMeta(content, pres) {
  const title = stripTags(pres.title.rendered);
  const excerpt = stripTags((pres.excerpt || {}).rendered || '');
  const sf = pres.scraped_fields || {};
  const description = truncate(excerpt || sf.presenter_bio || stripTags(pres.content.rendered) || title);
  const hasFeaturedMedia = content.media.some((m) => m.id === pres.featured_media);
  const image = (!hasFeaturedMedia && sf.presenter_photo_url && presenterPhotoImage(sf.presenter_photo_url))
    || imageFor(content, pres.featured_media, pres.id);
  return {
    title: `${title} — New Orleans Arts & Ideas Festival`,
    description,
    canonical: `${SITE_URL}/p/${routeSlug(pres.slug)}/`,
    ogType: 'article',
    image,
  };
}

export function pageMeta(content, pageId, slug) {
  const pg = content.pages.find((p) => p.id === pageId);
  const title = stripTags(pg.title.rendered);
  const description = truncate(stripTags(pg.content.rendered) || title);
  let image = imageFor(content, pg.featured_media, pageId);
  // Prefer the page's own first inline image (e.g. About's gallery) over the random pool.
  const firstImgMatch = /src="(media\/[^"]+)"/.exec(pg.content.rendered || '');
  if (firstImgMatch) {
    const match = content.media.find((m) => m.source_url === firstImgMatch[1]);
    if (match) {
      image = { url: `${SITE_URL}/${firstImgMatch[1]}`, width: match.media_details.width, height: match.media_details.height };
    }
  }
  return {
    title: `${title} — New Orleans Arts & Ideas Festival`,
    description,
    canonical: `${SITE_URL}/${slug}/`,
    ogType: 'website',
    image,
  };
}
