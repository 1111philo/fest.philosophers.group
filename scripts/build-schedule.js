#!/usr/bin/env node
// Builds a first-class `schedule` collection in content.json from the 2026
// festival schedule CSV, linking each row to its presentation record where
// one exists (matches vetted by hand - title text alone isn't reliable for
// recurring names like "Opening Remarks," which show up every year -
// matches were cross-checked against presenter names too).
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
const CSV_PATH = process.argv[2] || path.join(REPO, 'noai_2026_schedule.csv');
const CONTENT_PATH = process.argv[3] || path.join(REPO, 'content.json');

// CSV row index (0-based, excluding header) -> presentation id.
const MATCH = {
  6: 2815, 7: 2650, 8: 2706, 9: 2800, 11: 2607, 12: 2656, 13: 2631,
  14: 2640, 15: 2659, 18: 2823, 19: 2820, 20: 2803, 22: 2729, 23: 2644,
  31: 2621, 32: 2624, 35: 2826, 36: 2720, 37: 2732, 38: 2647, 39: 2754,
};

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readCsvRecords(text) {
  const rows = parseCsv(text);
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] || ''])));
}

function convertDate(s) {
  const m = /(\w+)\s+(\d+),\s*(\d+)/.exec(s.trim());
  const mo = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  const yr = Number(m[3]);
  return `${String(yr).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// First clock time in the range, normalized to 24h HH:MM for sorting, plus
// a display string. Times are 8am-7pm; below 8 never occurs so a simple
// AM/PM split at hour 8-11 works.
function convertTime(s) {
  const start = s.trim().split(/[–→-]/)[0].trim();
  const hm = /(\d+):(\d+)/.exec(start);
  const hour = Number(hm[1]);
  const minute = hm[2];
  const ampm = [8, 9, 10, 11].includes(hour) ? 'AM' : 'PM';
  let hour24 = hour === 12 || ampm === 'AM' ? hour : hour + 12;
  if (hour === 12 && ampm === 'AM') hour24 = 0;
  return [`${String(hour24).padStart(2, '0')}:${minute}`, `${hour}:${minute} ${ampm}`];
}

function main() {
  const records = readCsvRecords(fs.readFileSync(CSV_PATH, 'utf8'))
    .filter((r) => (r['Session Title'] || '').trim());

  const schedule = records.map((row, idx) => {
    const [sortTime, displayTime] = convertTime(row.Time);
    return {
      year: '2026',
      day: row.Day.trim(),
      date: convertDate(row.Date),
      time: displayTime,
      sort_time: sortTime,
      raw_time_range: row.Time.trim(),
      location: row.Location.trim(),
      title: row['Session Title'].trim(),
      presenters: row['Presenter(s)'].trim(),
      type: row.Type.trim(),
      tag: row.Tags.trim(),
      presentation_id: MATCH[idx] || null,
    };
  });

  const data = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
  data.schedule = schedule;
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2));

  console.log(`Wrote ${schedule.length} schedule rows to ${CONTENT_PATH}`);
  const matched = schedule.filter((s) => s.presentation_id).length;
  console.log(`  ${matched} linked to a presentation record, ${schedule.length - matched} logistics/unmatched`);
  const days = [...new Set(schedule.map((s) => `${s.date}\t${s.day}`))].sort();
  for (const key of days) {
    const [date, day] = key.split('\t');
    const count = schedule.filter((s) => s.date === date).length;
    console.log(`  ${day} ${date}: ${count} items`);
  }
}

main();
