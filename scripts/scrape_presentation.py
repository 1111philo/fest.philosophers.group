#!/usr/bin/env python3
"""Extract NOAI presentation custom fields (Date/Time/Location, Presenter name/bio)
from rendered HTML, since the WP REST API doesn't expose these (mfb meta fields
aren't in mfb_rest_fields for the presentations post type).
"""
import sys
import json
import time
import urllib.request
from bs4 import BeautifulSoup

API = "https://noai.philosophers.group/wp-json/wp/v2/presentations"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "noai-scraper/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def extract_meta_fields(html):
    soup = BeautifulSoup(html, "html.parser")

    result = {"date": None, "time": None, "location": None,
              "presenter_name": None, "presenter_bio": None,
              "presenter_photo_url": None}

    # "Presentation Details" section: prefix/value pairs (Date/Time/Location)
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

    # "Presenter Biography" section: name (no prefix) then bio (no prefix), plus photo
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


def main():
    per_page = 20
    page = 1
    out = []
    while True:
        url = f"{API}?per_page={per_page}&page={page}"
        data = json.loads(fetch(url))
        if not data:
            break
        for item in data:
            link = item["link"]
            html = fetch(link)
            fields = extract_meta_fields(html)
            out.append({
                "id": item["id"],
                "slug": item["slug"],
                "title": item["title"]["rendered"],
                "link": link,
                **fields,
            })
            print(f"  [{item['id']}] {item['slug']} -> date={fields['date']!r} time={fields['time']!r} location={fields['location']!r} presenter={fields['presenter_name']!r}", file=sys.stderr)
            time.sleep(0.3)
        page += 1

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
