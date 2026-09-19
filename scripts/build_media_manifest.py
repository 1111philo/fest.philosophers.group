#!/usr/bin/env python3
"""Scans media/ for the favicon/social-share image pools and records them in
content.json's `site_images` key. Re-run this after adding new files named
`icon-*` (favicon candidates, ideally square) or `ogg-*` (social share image
candidates, ideally ~1200x630+) to media/, then redeploy."""
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_DIR = os.path.join(REPO, 'media')
CONTENT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'content.json')

EXT_RE = re.compile(r'\.(png|jpe?g|webp)$', re.I)


def pool(prefix):
    files = [f for f in os.listdir(MEDIA_DIR) if f.lower().startswith(prefix) and EXT_RE.search(f)]
    return sorted(f"media/{f}" for f in files)


def main():
    with open(CONTENT) as f:
        data = json.load(f)

    data['site_images'] = {
        "icons": pool('icon-'),
        "ogg": pool('ogg-'),
    }

    with open(CONTENT, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"icons: {len(data['site_images']['icons'])}")
    for p in data['site_images']['icons']:
        print(f"  {p}")
    print(f"ogg: {len(data['site_images']['ogg'])}")
    for p in data['site_images']['ogg']:
        print(f"  {p}")


if __name__ == '__main__':
    main()
