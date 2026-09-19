#!/usr/bin/env python3
"""Generates a real, crawlable, directly-loadable URL for every presentation
and for the About/Sponsor pages: p/<slug>/, about/, sponsor/.

Each one is a full copy of index.html - the same app, same content.json,
same everything - with only the <head> tags (title, description, canonical,
og:*, twitter:*) swapped for that item's own. That's what makes a shared
link's preview show the right title/description/image, and why it's real
for SEO: a fresh load or a crawler hitting /p/some-slug/ gets that content
immediately, with no client-side redirect. index.html's own <base href="/">
is what lets the exact same relative content.json/media/* references work
correctly no matter which of these directories the file's served from, and
index.html's own JS (openFromLocation) is what notices, from location.
pathname, which presentation/page to open on load.

Re-run this whenever content.json OR index.html changes, then redeploy.
"""
import html
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'content.json')
INDEX_HTML = os.path.join(REPO, 'index.html')
SITE_URL = "https://fest.philosophers.group"

TAG_RE = re.compile(r'<[^>]+>')


def clean_text(s):
    return html.unescape(TAG_RE.sub(' ', s or '')).strip()


def truncate(s, n=160):
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def set_meta(doc, attr, name, value):
    pattern = re.compile(r'(<meta ' + attr + '="' + re.escape(name) + r'" content=")[^"]*(")')
    new_doc, n = pattern.subn(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(2), doc)
    if n != 1:
        raise ValueError(f"expected exactly one <meta {attr}=\"{name}\"> in index.html, found {n}")
    return new_doc


def set_title(doc, value):
    new_doc, n = re.subn(r'<title>[^<]*</title>', '<title>' + html.escape(value) + '</title>', doc)
    if n != 1:
        raise ValueError(f"expected exactly one <title> in index.html, found {n}")
    return new_doc


def set_canonical(doc, url):
    new_doc, n = re.subn(
        r'(<link rel="canonical" href=")[^"]*(")',
        lambda m: m.group(1) + html.escape(url, quote=True) + m.group(2),
        doc,
    )
    if n != 1:
        raise ValueError(f"expected exactly one <link rel=\"canonical\"> in index.html, found {n}")
    return new_doc


def build_page(template, *, title, description, url, og_type, image, image_w, image_h):
    doc = template
    doc = set_title(doc, title)
    doc = set_meta(doc, 'name', 'description', description)
    doc = set_canonical(doc, url)
    doc = set_meta(doc, 'property', 'og:type', og_type)
    doc = set_meta(doc, 'property', 'og:title', title)
    doc = set_meta(doc, 'property', 'og:description', description)
    doc = set_meta(doc, 'property', 'og:url', url)
    doc = set_meta(doc, 'property', 'og:image', image)
    doc = set_meta(doc, 'property', 'og:image:width', str(image_w))
    doc = set_meta(doc, 'property', 'og:image:height', str(image_h))
    doc = set_meta(doc, 'name', 'twitter:title', title)
    doc = set_meta(doc, 'name', 'twitter:description', description)
    doc = set_meta(doc, 'name', 'twitter:image', image)
    return doc


def write_page(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)


def main():
    with open(CONTENT) as f:
        data = json.load(f)
    with open(INDEX_HTML) as f:
        template = f.read()

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
        page = build_page(
            template,
            title=f"{title} — NOAI",
            description=description,
            url=url,
            og_type="article",
            image=image, image_w=iw, image_h=ih,
        )
        write_page(os.path.join(REPO, 'p', p['slug'], 'index.html'), page)
        count += 1
    print(f"wrote {count} presentation share pages")

    page_specs = [
        (469, 'about', 'website'),
        (620, 'sponsor', 'website'),
    ]
    pages_by_id = {pg['id']: pg for pg in data['pages']}
    for page_id, slug, og_type in page_specs:
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
        page = build_page(
            template,
            title=f"{title} — NOAI",
            description=description,
            url=url,
            og_type=og_type,
            image=image, image_w=iw, image_h=ih,
        )
        write_page(os.path.join(REPO, slug, 'index.html'), page)
        print(f"wrote {slug}/index.html")


if __name__ == '__main__':
    main()
