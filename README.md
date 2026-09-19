# NOAI Content Browser

A static browser for the New Orleans Arts & Ideas Festival (NOAI) content — presentations, pages, and media — pulled from [noai.philosophers.group](https://noai.philosophers.group)'s WordPress REST API.

## Structure

- `index.html` — the browser app (single static page, no build step, no dependencies)
- `content.json` — full content export (pages, presentations, media, tags)
- `schema.json` — JSON Schema describing `content.json`'s shape and the quirks found while scraping the source site
- `scripts/harvest_noai.py` — re-runs the full harvest against the live WordPress site to regenerate `content.json`
- `scripts/scrape_presentation.py` — standalone version of the presentation custom-field scraper used by the harvester

## Regenerating the data

```
pip install beautifulsoup4
python3 scripts/harvest_noai.py content.json
```

Requires network access to `noai.philosophers.group`. See comments in `harvest_noai.py` for details on what it does and why (custom fields aren't exposed via the REST API, categories get folded into tags, etc).

## Hosting

Served as-is via GitHub Pages from the repo root — `index.html` fetches `content.json` with a relative path, so no server-side logic is needed.
