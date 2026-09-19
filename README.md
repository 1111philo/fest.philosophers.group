# New Orleans Arts & Ideas Festival — Schedule

The live schedule site for the festival (Nov 11–13, 2026, Historic New Orleans Jazz Museum).

## Structure

- `index.html` — the schedule site (single static page, no build step, no dependencies to run it)
- `content.json` — full content export (pages, presentations, media, tags, schedule, site_images)
- `media/` — every image actually referenced by a page or presentation, plus the `icon-*`/`ogg-*` favicon and social-share pools; nothing here is hotlinked from elsewhere
- `schema.json` — JSON Schema describing `content.json`'s shape
- `scripts/build-media-manifest.js` — records the current `media/icon-*`/`media/ogg-*` files into `content.json`'s `site_images` (see below)
- `scripts/build-share-pages.js` — generates `p/<slug>/`, `about/`, `sponsor/` (see below)
- `scripts/lib/text.js` — shared HTML-entity/escaping helpers used by the generator above

The build scripts are plain Node.js (no `npm install` needed — only built-in `fs`/`path`) and only ever run locally to regenerate files that get committed; nothing about them runs on the live site, which stays pure static HTML/CSS/JS for GitHub Pages.

There's no ongoing sync from the original WordPress site, or from an organizer-provided CSV, anymore — `content.json` (including its `schedule` array) is edited directly going forward.

### Favicon / social-share image rotation

`index.html` picks a random favicon and a random `og:image`/`twitter:image` on every load, from `content.json`'s `site_images.icons`/`site_images.ogg` lists. To add more: drop a new image into `media/` named `icon-whatever.png` (ideally square, for the favicon) or `ogg-whatever.png` (ideally ~1200×630+, for social-share previews), then run:

```
node scripts/build-media-manifest.js
```

and redeploy. No other code changes needed — the pools are read from `content.json` at load time.

Note the favicon rotation is real (a visitor's browser re-picks one every page load), but the *shared-link preview* image can't be: social platforms' crawlers fetch the static HTML and never run JavaScript, so whatever `og:image` is baked into a page at generation time is what shows up when that link is shared, until the page is regenerated.

### Per-presentation share URLs (`p/<slug>/`, `about/`, `sponsor/`)

Every presentation, plus the About and Sponsor pages, gets its own real, crawlable URL (e.g. `fest.philosophers.group/p/some-talk/`) with its own `<title>`/description/OG tags — using the presentation's own featured image when it has one, otherwise a deterministic pick from the `ogg-*` pool (stable per item, so repeated builds don't churn). Each is a small standalone page (not a copy of the whole app) that sends a real visitor into the interactive schedule at `index.html`, which opens that item's drawer/modal on load from the `#presentation/<slug>`, `#about`, or `#sponsor` hash it's redirected with; in-app navigation (clicking a card, the hamburger menu) then replaces that with the item's real path via `history.pushState`, so whatever's open always has its own clean address-bar URL, and back/forward work normally. Regenerate after any change to `content.json`:

```
node scripts/build-share-pages.js
```

## Hosting

Served as-is via GitHub Pages from the repo root at `fest.philosophers.group` — `index.html` fetches `content.json` with a relative path, so no server-side logic is needed. Images are served from `media/` in this repo rather than hotlinked from elsewhere, so the site keeps working independent of any other source.
