#!/usr/bin/env python3
"""Generates a real, crawlable URL for every presentation and for the
About/Sponsor pages: p/<slug>/, about/, sponsor/. GitHub Pages is plain
static hosting with no server-side logic, so a single index.html can't
show a different <meta og:image> per shared link - social-media crawlers
read whatever's baked into the HTML they fetch and never run JavaScript.
So each of these is its own small static file with real meta tags baked
in at generation time, that redirects a human visitor into the real
interactive app (index.html#presentation/<slug> etc) via JS/meta-refresh.

Re-run this whenever content.json changes (new presentations, matched
featured images, etc) and redeploy.
"""
import html
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'content.json')
SITE_URL = "https://fest.philosophers.group"

TAG_RE = re.compile(r'<[^>]+>')


def clean_text(s):
    return html.unescape(TAG_RE.sub(' ', s or '')).strip()


def truncate(s, n=160):
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="New Orleans Arts &amp; Ideas Festival">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="{image_w}">
<meta property="og:image:height" content="{image_h}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{image}">
<meta http-equiv="refresh" content="0; url={redirect}">
<script>location.replace({redirect_js});</script>
<style>
  body {{ font-family: Georgia, serif; background: #f6f3ee; color: #241d15; max-width: 640px; margin: 60px auto; padding: 0 20px; line-height: 1.6; }}
  a {{ color: #a8752c; }}
</style>
</head>
<body>
<p>Redirecting to the New Orleans Arts &amp; Ideas Festival schedule&hellip;</p>
<h1>{heading}</h1>
<p>{description}</p>
<p><a href="{redirect}">Continue to the schedule &rarr;</a></p>
</body>
</html>
"""


def write_page(path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(PAGE_TEMPLATE.format(redirect_js=json.dumps(kw['redirect']), **kw))


def main():
    with open(CONTENT) as f:
        data = json.load(f)

    media_by_id = {m['id']: m for m in data['media']}
    ogg_pool = (data.get('site_images') or {}).get('ogg') or []

    def image_for(featured_media_id, fallback_key):
        m = media_by_id.get(featured_media_id)
        if m:
            return (
                f"{SITE_URL}/{m['source_url']}",
                m['media_details']['width'],
                m['media_details']['height'],
            )
        if ogg_pool:
            pick = ogg_pool[fallback_key % len(ogg_pool)]
            return (f"{SITE_URL}/{pick}", 1424, 752)
        return (f"{SITE_URL}/media/ogg-arts.png", 1424, 752)

    count = 0
    for p in data['presentations']:
        if not p.get('slug'):
            continue
        title = clean_text(p['title']['rendered'])
        sf = p.get('scraped_fields') or {}
        excerpt = clean_text((p.get('excerpt') or {}).get('rendered', ''))
        description = truncate(excerpt or sf.get('presenter_bio') or clean_text(p['content']['rendered']) or title)
        image, iw, ih = image_for(p.get('featured_media'), p['id'])
        url = f"{SITE_URL}/p/{p['slug']}/"
        write_page(
            os.path.join(REPO, 'p', p['slug'], 'index.html'),
            title=html.escape(f"{title} — NOAI"),
            heading=html.escape(title),
            description=html.escape(description),
            url=url,
            og_type="article",
            image=image, image_w=iw, image_h=ih,
            redirect=f"/#presentation/{p['slug']}",
        )
        count += 1
    print(f"wrote {count} presentation share pages")

    page_specs = [
        (469, 'about', '#about', 'website'),
        (620, 'sponsor', '#sponsor', 'website'),
    ]
    pages_by_id = {pg['id']: pg for pg in data['pages']}
    for page_id, slug, hash_target, og_type in page_specs:
        pg = pages_by_id.get(page_id)
        if not pg:
            continue
        title = clean_text(pg['title']['rendered'])
        description = truncate(clean_text(pg['content']['rendered']) or title)
        image, iw, ih = image_for(pg.get('featured_media'), page_id)
        # Prefer the page's own first inline image (e.g. About's gallery) over the random pool.
        first_img = re.search(r'src="(media/[^"]+)"', pg['content']['rendered'] or '')
        if first_img:
            local = first_img.group(1)
            match = next((m for m in data['media'] if m['source_url'] == local), None)
            if match:
                image = f"{SITE_URL}/{local}"
                iw, ih = match['media_details']['width'], match['media_details']['height']
        url = f"{SITE_URL}/{slug}/"
        write_page(
            os.path.join(REPO, slug, 'index.html'),
            title=html.escape(f"{title} — NOAI"),
            heading=html.escape(title),
            description=html.escape(description),
            url=url,
            og_type=og_type,
            image=image, image_w=iw, image_h=ih,
            redirect=f"/{hash_target}",
        )
        print(f"wrote {slug}/index.html")


if __name__ == '__main__':
    main()
