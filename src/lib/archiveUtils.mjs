// Build-time helpers for the /archive/<year>/ pages, which list past
// festivals' talks day-by-day. 2024 and 2025 predate the CSV-based
// `schedule` rows the current festival uses - each of those years' talks
// only carries its own scraped "M/D/YY(YY)" date + "H:MM AM/PM" time on
// the presentation itself, tagged with a "NOAI <year> Presentation" tag.
// Mirrors the date/time parsing in src/lib/scheduleUtils.js (the
// client-side schedule app) so a past year would group into the same
// days here as it would there.
import { stripTags, decodeEntities } from './text.mjs';
import { routeSlug } from './slug.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// 2024's scraped date strings wrap the M/D/YY(YY) in a weekday label and
// parentheses (e.g. "Sunday (11/10/24)"), while 2025's are the bare date -
// search for the date anywhere in the string rather than anchoring to it,
// so both formats parse. The weekday is recomputed from the parsed date
// below rather than trusted from the string, since a few 2024 entries
// have a weekday label that doesn't actually match their own date.
export function parseUsDate(s) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec((s || '').trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dow: WEEKDAYS[d.getDay()],
  };
}

export function parseDisplayTime(s) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((s || '').trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

export function formatDayHeading(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// Groups a past year's tagged presentations into day buckets, each
// sorted by start time the same way the live schedule sorts a day's cards.
export function getPastYearDays(content, year) {
  const yearTag = (content.tags || []).find((t) => t.name === `NOAI ${year} Presentation`);
  if (!yearTag) return [];

  const byDate = {};
  (content.presentations || []).forEach((p) => {
    if ((p.tags || []).indexOf(yearTag.id) === -1) return;
    const sf = p.scraped_fields || {};
    const d = parseUsDate(sf.date);
    const t = parseDisplayTime(sf.time);
    if (!d || !t) return;
    const item = {
      slug: routeSlug(p.slug),
      title: decodeEntities(stripTags(p.title.rendered)),
      presenters: sf.presenter_name || '',
      location: sf.location || '',
      time: sf.time,
      sortTime: t,
    };
    (byDate[d.iso] = byDate[d.iso] || { iso: d.iso, dow: d.dow, items: [] }).items.push(item);
  });

  return Object.values(byDate)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((day) => ({ ...day, items: day.items.sort((a, b) => a.sortTime.localeCompare(b.sortTime)) }));
}
