// A couple of WP slugs generated from emoji-heavy titles ended up as
// literal percent-hex text (not real URL-encoding, just that string) -
// e.g. "you-and-%f0%9f%91%81...-i" - which isn't safely routable. Strip
// those sequences down to plain ASCII for routing; every normal slug
// passes through unchanged. Framework-free so it can be shared between
// build-time (Astro's getStaticPaths) and the client-side app.
export function routeSlug(slug) {
  if (!/%[0-9a-fA-F]{2}/.test(slug)) return slug;
  return slug.replace(/%[0-9a-fA-F]{2}/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
