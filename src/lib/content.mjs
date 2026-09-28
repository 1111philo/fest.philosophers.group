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
// The festival's name as it appears in <title>/og:title/twitter:title and
// og:site_name. Descriptions still say "New Orleans" for search.
export const SITE_TITLE = 'NOAI: Arts & Ideas Festival';

let cached = null;
export function loadContent() {
  if (!cached) cached = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
  return cached;
}

// The site-wide share image: the NOAI logo on the poster's cream, 1200x630.
// Every site page uses it; presentations fall back to it when they have no
// photo of their own.
export const SITE_IMAGE = { url: `${SITE_URL}/media/og-noai.png`, width: 1200, height: 630 };

// The presentation/page's own featured image if it has one, otherwise the
// site's one fixed fallback share image (SITE_IMAGE) - consistent across
// every page/presentation that lacks its own image, rather than a
// per-item pick from the ogg-* pool.
export function imageFor(content, featuredMediaId) {
  const media = content.media.find((m) => m.id === featuredMediaId);
  if (media) {
    return {
      url: `${SITE_URL}/${media.source_url}`,
      width: media.media_details.width,
      height: media.media_details.height,
    };
  }
  return SITE_IMAGE;
}

export function presentationMeta(content, pres) {
  const title = stripTags(pres.title.rendered);
  const excerpt = stripTags((pres.excerpt || {}).rendered || '');
  const sf = pres.scraped_fields || {};
  const description = truncate(excerpt || sf.presenter_bio || stripTags(pres.content.rendered) || title);
  // Every presentation gets its own generated card (src/pages/og/) - the
  // talk's title, presenter, date and venue, with the presenter's photo
  // when there is one.
  const image = { url: `${SITE_URL}/og/${routeSlug(pres.slug)}.jpg`, width: 1200, height: 630 };
  return {
    title: `${title} — ${SITE_TITLE}`,
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
  let image = imageFor(content, pg.featured_media);
  // Prefer the page's own first inline image (e.g. About's gallery) over the random pool.
  const firstImgMatch = /src="(media\/[^"]+)"/.exec(pg.content.rendered || '');
  if (firstImgMatch) {
    const match = content.media.find((m) => m.source_url === firstImgMatch[1]);
    if (match) {
      image = { url: `${SITE_URL}/${firstImgMatch[1]}`, width: match.media_details.width, height: match.media_details.height };
    }
  }
  return {
    title: `${title} — ${SITE_TITLE}`,
    description,
    canonical: `${SITE_URL}/${slug}/`,
    ogType: 'website',
    image,
  };
}
