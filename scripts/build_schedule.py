#!/usr/bin/env python3
"""Builds a first-class `schedule` collection in content.json from the 2026
festival schedule CSV, linking each row to its presentation record where one
exists (matches vetted by hand - see conversation history for the
title+presenter cross-check against the live 2026 draft pool)."""
import csv
import json
import re
import sys

CSV_PATH = '/root/.claude/uploads/c2eb04e8-2b4e-575e-abaf-dbba9beaaa5c/0d5b3618-noai_2026_schedule.csv'
JSON_PATH = sys.argv[1] if len(sys.argv) > 1 else 'content.json'

# CSV row index (0-based, excluding header) -> presentation id.
MATCH = {
    6: 2815, 7: 2650, 8: 2706, 9: 2800, 11: 2607, 12: 2656, 13: 2631,
    14: 2640, 15: 2659, 18: 2823, 19: 2820, 20: 2803, 22: 2729, 23: 2644,
    31: 2621, 32: 2624, 35: 2826, 36: 2720, 37: 2732, 38: 2647, 39: 2754,
}

MONTHS = {'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
          'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12}


def convert_date(s):
    m = re.match(r'(\w+)\s+(\d+),\s*(\d+)', s.strip())
    mo, day, yr = MONTHS[m.group(1).lower()], int(m.group(2)), int(m.group(3))
    return f"{yr:04d}-{mo:02d}-{day:02d}"


def convert_time(s):
    """First clock time in the range, normalized to 24h HH:MM for sorting,
    plus a display string. Times are 8am-7pm; below 8 never occurs so a
    simple AM/PM split at hour 8-11 works."""
    start = re.split(r'[–\-→]', s.strip())[0].strip()
    hm = re.match(r'(\d+):(\d+)', start)
    hour, minute = int(hm.group(1)), hm.group(2)
    ampm = 'AM' if hour in (8, 9, 10, 11) else 'PM'
    hour24 = hour if hour == 12 or ampm == 'AM' else hour + 12
    if hour == 12 and ampm == 'AM':
        hour24 = 0
    return f"{hour24:02d}:{minute}", f"{hour}:{minute} {ampm}"


def main():
    rows = []
    with open(CSV_PATH, newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r.get('Session Title', '').strip():
                rows.append(r)

    schedule = []
    for idx, row in enumerate(rows):
        sort_time, display_time = convert_time(row['Time'])
        schedule.append({
            "year": "2026",
            "day": row['Day'].strip(),
            "date": convert_date(row['Date']),
            "time": display_time,
            "sort_time": sort_time,
            "raw_time_range": row['Time'].strip(),
            "location": row['Location'].strip(),
            "title": row['Session Title'].strip(),
            "presenters": row['Presenter(s)'].strip(),
            "type": row['Type'].strip(),
            "tag": row['Tags'].strip(),
            "presentation_id": MATCH.get(idx),
        })

    with open(JSON_PATH) as f:
        data = json.load(f)
    data['schedule'] = schedule
    with open(JSON_PATH, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Wrote {len(schedule)} schedule rows to {JSON_PATH}")
    matched = sum(1 for s in schedule if s['presentation_id'])
    print(f"  {matched} linked to a presentation record, {len(schedule) - matched} logistics/unmatched")
    days = sorted(set((s['date'], s['day']) for s in schedule))
    for date, day in days:
        count = sum(1 for s in schedule if s['date'] == date)
        print(f"  {day} {date}: {count} items")


if __name__ == '__main__':
    main()
