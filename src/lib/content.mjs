// Reads content.json once at build time and derives the per-page
// title/description/OG-image data that scripts/build-share-pages.js used to
// compute by hand for a generated stub file. Astro's own routing now owns
// generating one real static page per presentation (see
// src/pages/p/[slug].astro), so this module is just the data side of that.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTags, truncate } from './text.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, '../../public/content.json');
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

export function presentationMeta(content, pres) {
  const title = stripTags(pres.title.rendered);
  const excerpt = stripTags((pres.excerpt || {}).rendered || '');
  const sf = pres.scraped_fields || {};
  const description = truncate(excerpt || sf.presenter_bio || stripTags(pres.content.rendered) || title);
  return {
    title: `${title} — NOAI`,
    description,
    canonical: `${SITE_URL}/p/${pres.slug}/`,
    ogType: 'article',
    image: imageFor(content, pres.featured_media, pres.id),
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
    title: `${title} — NOAI`,
    description,
    canonical: `${SITE_URL}/${slug}/`,
    ogType: 'website',
    image,
  };
}
