// One share image per presentation, rendered at build time (see
// lib/ogImage.mjs) and written to dist/og/<slug>.jpg alongside the page.
import { loadContent } from '../../lib/content.mjs';
import { routeSlug } from '../../lib/slug.js';
import { renderPresentationOg } from '../../lib/ogImage.mjs';

export function getStaticPaths() {
  return loadContent().presentations
    .filter((p) => p.slug)
    .map((p) => ({ params: { slug: routeSlug(p.slug) }, props: { pres: p } }));
}

export async function GET({ props }) {
  const jpg = await renderPresentationOg(loadContent(), props.pres);
  return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
}
