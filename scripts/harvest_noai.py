#!/usr/bin/env python3
"""Full content+media harvest of noai.philosophers.group per noai-wp-content-schema.json.

Pulls pages, media, tags via the WP REST API, and presentations via the API +
HTML scrape (for date/time/location/presenter fields that aren't exposed in
REST - see mfb_rest_fields). WP Posts are intentionally not pulled. Live
categories, if any exist, are migrated into equivalent tags and never
included in the export - see migrate_categories_to_tags().
"""
import json
import sys
import time
import urllib.request
import urllib.error
from bs4 import BeautifulSoup

BASE = "https://noai.philosophers.group"
API = BASE + "/wp-json/wp/v2"
UA = {"User-Agent": "noai-harvester/1.0 (+content export)"}
SLEEP = 0.2


def fetch(url, retries=3, backoff=1.5):
    """Returns (body_bytes, headers). headers is the original http.client
    HTTPMessage object, which does case-insensitive .get() lookups - the
    server sends 'X-WP-Total'/'X-WP-TotalPages', not lowercase."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
                headers = r.headers
            return body, headers
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last_err = e
        except Exception as e:
            last_err = e
        time.sleep(backoff * attempt)
    raise last_err


def fetch_collection(rest_base, per_page=50, label=None):
    """Fetch a full WP REST collection. Uses orderby=id&order=asc for
    deterministic pagination - the default (date-ordered) listing on this
    site is unreliable for large collections (verified on /media: returns
    truncated pages under default ordering, e.g. 2 items instead of 20)."""
    label = label or rest_base
    items = []
    page = 1
    total = 0
    totalpages = 0
    while True:
        url = f"{API}/{rest_base}?per_page={per_page}&page={page}&orderby=id&order=asc"
        body, headers = fetch(url)
        total = int(headers.get("X-WP-Total", 0))
        totalpages = int(headers.get("X-WP-TotalPages", 0))
        data = json.loads(body)

        expected_this_page = min(per_page, total - len(items)) if total else per_page
        if len(data) < expected_this_page:
            # Retry a few times in case of transient truncation.
            for retry in range(3):
                time.sleep(1.0)
                body2, _ = fetch(url)
                data2 = json.loads(body2)
                if len(data2) > len(data):
                    data = data2
                if len(data) >= expected_this_page:
                    break
            if len(data) < expected_this_page:
                print(f"  WARNING: {label} page {page}/{totalpages} returned {len(data)}/{expected_this_page} after retries", file=sys.stderr)

        items.extend(data)
        print(f"  {label}: page {page}/{totalpages} -> {len(data)} items ({len(items)} total so far)", file=sys.stderr)

        if page >= totalpages or not totalpages or not data:
            break
        page += 1
        time.sleep(SLEEP)

    if len(items) != total:
        print(f"  NOTE: {label} server reports {total} total, collected {len(items)} via public listing "
              f"(gap likely due to items attached to non-public content, not retrievable without auth)", file=sys.stderr)
    return items


def extract_presentation_meta(html):
    soup = BeautifulSoup(html, "html.parser")
    result = {"date": None, "time": None, "location": None,
              "presenter_name": None, "presenter_bio": None,
              "presenter_photo_url": None}

    details_h3 = soup.find(lambda t: t.name == "h3" and t.get_text(strip=True) == "Presentation Details")
    if details_h3:
        container = details_h3.find_next("div", class_="wp-block-group")
        if container:
            for block in container.select(".wp-block-mfb-meta-field-block"):
                prefix = block.select_one(".prefix")
                value = block.select_one(".value")
                if prefix and value:
                    key = prefix.get_text(strip=True).rstrip(":").lower()
                    if key in ("date", "time", "location"):
                        result[key] = value.get_text(strip=True)

    bio_h2 = soup.find(lambda t: t.name == "h2" and t.get_text(strip=True) == "Presenter Biography")
    if bio_h2:
        columns = bio_h2.find_next("div", class_="wp-block-columns")
        if columns:
            values = [v.get_text(strip=True) for v in columns.select(".wp-block-mfb-meta-field-block .value")]
            if len(values) >= 1:
                result["presenter_name"] = values[0]
            if len(values) >= 2:
                result["presenter_bio"] = values[1]
            img = columns.select_one("img")
            if img and img.get("src"):
                result["presenter_photo_url"] = img["src"]

    return result


def harvest_presentations():
    presentations = fetch_collection("presentations", label="presentations")
    for i, item in enumerate(presentations, 1):
        html, _ = fetch(item["link"])
        item["scraped_fields"] = extract_presentation_meta(html)
        print(f"  scraped [{i}/{len(presentations)}] {item['slug']} -> "
              f"{item['scraped_fields']['date']} {item['scraped_fields']['time']} "
              f"@ {item['scraped_fields']['location']} / {item['scraped_fields']['presenter_name']!r}",
              file=sys.stderr)
        time.sleep(SLEEP)
    return presentations


def harvest_media_by_id_fallback(via_list):
    """The /media list endpoint intermittently returns empty pages. As a
    completeness check, verify coverage isn't badly short of x-wp-total by
    spot-checking id gaps isn't needed here since fetch_collection already
    retries; this hook is kept for future use if gaps reappear."""
    return via_list


def migrate_categories_to_tags(pages, presentations, categories, tags):
    """This dataset doesn't track WP Posts or the category taxonomy (both
    intentionally dropped - see noai-wp-content-schema.json). Any category
    still assigned on the live site is folded into an equivalent tag here
    (matched by name, created if missing) so classification survives even
    though the category collection itself is never included in the export."""
    tag_by_name = {t['name'].strip().lower(): t for t in tags}
    next_id = (max((t['id'] for t in tags), default=0)) + 1
    cat_by_id = {c['id']: c for c in categories}

    for item in list(pages) + list(presentations):
        cat_ids = item.pop('categories', [])
        if not cat_ids:
            continue
        new_tag_ids = []
        for cid in cat_ids:
            cat = cat_by_id.get(cid)
            if not cat:
                continue
            key = cat['name'].strip().lower()
            tag = tag_by_name.get(key)
            if not tag:
                tag = {
                    "id": next_id, "count": 0, "description": "",
                    "name": cat['name'], "slug": cat['slug'], "taxonomy": "post_tag",
                }
                next_id += 1
                tags.append(tag)
                tag_by_name[key] = tag
            new_tag_ids.append(tag['id'])
        existing = item.get('tags', [])
        item['tags'] = existing + [tid for tid in new_tag_ids if tid not in existing]

    # Recompute every tag's count from real usage (pages+presentations),
    # not the stale public REST 'count' which excludes drafts, and drop
    # any tag left with zero real usage.
    from collections import Counter
    usage = Counter()
    for item in list(pages) + list(presentations):
        for tid in item.get('tags', []):
            usage[tid] += 1
    kept = []
    for t in tags:
        n = usage.get(t['id'], 0)
        if n > 0:
            t['count'] = n
            kept.append(t)
    return kept


def rewrite_presentation_links(pages, presentations):
    """Page content HTML (content.rendered) links presentation titles straight
    to the live site. Rewrite any such link into "#presentation/<slug>" so the
    browser can navigate to it in-app instead of leaving the artifact; links
    to noai.philosophers.group that don't match a presentation (ticketing,
    other pages, retired content) are marked target=_blank instead so they
    at least open cleanly rather than trying to navigate the sandboxed frame
    away."""
    from urllib.parse import urlparse
    pres_slugs = {p['slug'] for p in presentations}
    touched = 0
    for page in pages:
        html = (page.get('content') or {}).get('rendered', '')
        if 'noai.philosophers.group' not in html:
            continue
        soup = BeautifulSoup(html, 'html.parser')
        changed = False
        for a in soup.find_all('a', href=True):
            parsed = urlparse(a['href'])
            if parsed.netloc != 'noai.philosophers.group':
                continue
            segs = [s for s in parsed.path.split('/') if s]
            slug = segs[-1] if segs else ''
            if slug in pres_slugs:
                a['href'] = '#presentation/' + slug
                if a.has_attr('target'):
                    del a['target']
            else:
                a['target'] = '_blank'
                a['rel'] = 'noopener'
            changed = True
        if changed:
            page['content']['rendered'] = str(soup)
            touched += 1
    return touched


def main():
    print("Fetching site meta...", file=sys.stderr)
    body, _ = fetch(f"{BASE}/wp-json/")
    site = json.loads(body)
    site_meta = {k: site[k] for k in
                 ("name", "description", "url", "home", "gmt_offset",
                  "timezone_string", "page_for_posts", "page_on_front",
                  "show_on_front", "namespaces") if k in site}

    # WP Posts are intentionally not part of this dataset - see schema.

    print("Fetching pages...", file=sys.stderr)
    pages = fetch_collection("pages", label="pages")

    print("Fetching presentations (+ scraping custom fields)...", file=sys.stderr)
    presentations = harvest_presentations()

    print("Fetching media...", file=sys.stderr)
    media = fetch_collection("media", per_page=20, label="media")

    print("Fetching categories (for migration only - not included in export)...", file=sys.stderr)
    categories = fetch_collection("categories", label="categories")

    print("Fetching tags...", file=sys.stderr)
    tags = fetch_collection("tags", label="tags")

    print("Migrating any live categories into tags...", file=sys.stderr)
    tags = migrate_categories_to_tags(pages, presentations, categories, tags)

    print("Rewriting page links to presentations for in-app navigation...", file=sys.stderr)
    n = rewrite_presentation_links(pages, presentations)
    print(f"  touched {n} page(s)", file=sys.stderr)

    export = {
        "site": site_meta,
        "pages": pages,
        "presentations": presentations,
        "media": media,
        "tags": tags,
    }

    out_path = sys.argv[1] if len(sys.argv) > 1 else "noai-content-export.json"
    with open(out_path, "w") as f:
        json.dump(export, f, indent=2)

    print("\n=== Summary ===", file=sys.stderr)
    for k in ("pages", "presentations", "media", "tags"):
        print(f"  {k}: {len(export[k])}", file=sys.stderr)
    print(f"Wrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
