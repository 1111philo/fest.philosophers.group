# New Orleans Arts & Ideas Festival — Schedule

The live schedule site for the festival (Nov 11–13, 2026, Historic New Orleans Jazz Museum). Built with [Astro](https://astro.build) - static output, no server, deployed to GitHub Pages.

## Structure

- `public/content.json` — full content export (pages, presentations, media, tags, schedule, site_images) - the single source of truth, edited directly
- `public/media/` — every image actually referenced by a page or presentation, plus the `icon-*`/`ogg-*` favicon and social-share pools; nothing here is hotlinked from elsewhere
- `public/CNAME` — the custom domain, copied into the build output as-is
- `schema.json` — JSON Schema describing `content.json`'s shape
- `src/pages/` — one file per route: `index.astro` (the schedule home), `about.astro`, `sponsor.astro`, and `p/[slug].astro`, whose `getStaticPaths()` generates a real static page for every presentation at build time (`p/<slug>/`)
- `src/layouts/Base.astro` — the shared `<head>` (per-page title/description/OG tags, passed in as props) and page shell
- `src/components/ScheduleApp.jsx` — the interactive app (search/filter, day/year pickers, the presentation drawer, the About/Sponsor modal) - a single React island, mounted with `client:load`, built on [react-aria-components](https://react-spectrum.adobe.com/react-aria/components.html) for the accessible bits (Menu, Tabs, SearchField, ModalOverlay+Dialog)
- `src/components/Drawer.jsx` — the presentation drawer specifically isn't a react-aria-components ModalOverlay: that always hides/inertifies the rest of the page while open, which is incompatible with the drawer staying non-blocking on desktop (see below)
- `src/lib/content.mjs` — build-time helpers (reads `content.json`, computes each page's title/description/OG image)
- `src/lib/scheduleUtils.js` — client-side helpers (schedule filtering/parsing) shared across the app
- `scripts/build-media-manifest.js` — records the current `public/media/icon-*`/`public/media/ogg-*` files into `content.json`'s `site_images` (see below); runs automatically as part of the GitHub Actions build, and there's no need to run it locally unless you want site_images in your own working copy of content.json up to date without waiting for CI

There's no ongoing sync from the original WordPress site, or from an organizer-provided CSV, anymore - `content.json` is edited directly.

## Developing

```
npm install
npm run dev       # local dev server
npm run build     # static output to dist/
npm run preview   # serve dist/ locally
```

### Favicon / social-share image rotation

The app picks a random favicon and a random `og:image`/`twitter:image` on every load, from `content.json`'s `site_images.icons`/`site_images.ogg` lists (see `rotateSiteImages` in `src/lib/scheduleUtils.js`) - this runs client-side at page-load time, not baked in at build time, so it's a real per-visit change. To add more images: drop a new file into `public/media/` named `icon-whatever.png` (ideally square, for the favicon) or `ogg-whatever.png` (ideally ~1200×630+, for social-share previews) and push - the next build picks it up automatically.

Note the *shared-link preview* image can't rotate the same way: social platforms' crawlers fetch the static HTML and never run JavaScript, so whatever `og:image` was baked into a page at build time is what shows up when that link is shared, until the site is rebuilt.

### Per-presentation share URLs (`p/<slug>/`, `about/`, `sponsor/`)

Every presentation, plus the About and Sponsor pages, gets its own real, crawlable URL with its own `<title>`/description/OG tags - using the presentation's own featured image when it has one, otherwise a deterministic pick from the `ogg-*` pool (stable per item, so repeated builds don't churn). Because Astro generates these as real static files rather than a redirect stub, loading one directly (a fresh visit, a shared link, a crawler) shows the real interactive app immediately, already open to that item - no redirect. In-app navigation (clicking a card, the hamburger menu) updates the address bar the same way via `history.pushState`, so whatever's open always has its own real URL, and back/forward work normally.

## Hosting

Deployed via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`: it installs dependencies, refreshes `site_images` from whatever's in `public/media/`, runs `astro build`, and publishes `dist/` to GitHub Pages. This repo's Settings → Pages → Build and deployment → Source must be set to "GitHub Actions" for this to take effect.
