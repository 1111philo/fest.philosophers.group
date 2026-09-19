# New Orleans Arts & Ideas Festival — Schedule

The live schedule site for the festival (Nov 11–13, Historic New Orleans Jazz Museum), pulling content from [noai.philosophers.group](https://noai.philosophers.group)'s WordPress site.

## Structure

- `index.html` — the schedule site (single static page, no build step, no dependencies)
- `content.json` — full content export (pages, presentations, media, tags, schedule)
- `media/` — every image actually referenced by a page or presentation, downloaded so the site doesn't hotlink `noai.philosophers.group`; unused media are dropped rather than carried along
- `schema.json` — JSON Schema describing `content.json`'s shape and the quirks found while scraping the source site
- `scripts/harvest_noai.py` — re-runs the full harvest against the live WordPress site to regenerate `content.json`
- `scripts/scrape_presentation.py` — standalone version of the presentation custom-field scraper used by the harvester
- `scripts/build_schedule.py` — merges an organizer-provided schedule CSV into `content.json`'s `schedule` array (see below)

## Regenerating the data

```
pip install beautifulsoup4
python3 scripts/harvest_noai.py content.json
```

Requires network access to `noai.philosophers.group`. See comments in `harvest_noai.py` for details on what it does and why (custom fields aren't exposed via the REST API, categories get folded into tags, etc).

### The published schedule (`content.json`'s `schedule` array)

The site's home view is the festival schedule, not the raw presentations list — it includes every session slot (meals, receptions, parties, opening/closing remarks) even when there's no dedicated presentation page, because that's what someone browsing the schedule actually needs to see. This comes from an organizer-provided CSV, not the WordPress site, merged in via:

```
python3 scripts/build_schedule.py content.json
```

`build_schedule.py` currently hard-codes the CSV path and the row→presentation-id matches for the 2026 schedule (vetted by hand: title text alone isn't reliable for recurring names like "Opening Remarks," which show up every year — matches were cross-checked against presenter names too). For a future year, update the CSV path and re-derive the matches.

## Hosting

Served as-is via GitHub Pages from the repo root at `fest.philosophers.group` — `index.html` fetches `content.json` with a relative path, so no server-side logic is needed. Images are served from `media/` in this repo rather than hotlinked from `noai.philosophers.group`, so the site keeps working even if that source site changes or goes away.
