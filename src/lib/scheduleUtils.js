// Pure helpers for the client-side schedule app - reading/filtering
// content.json once it's fetched into the browser. Kept framework-free so
// they're easy to test/reuse regardless of the component that calls them.
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function stripTags(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').trim();
}

export function typeSlug(type) {
  return (type || '').toLowerCase().trim().replace(/\s+/g, '-');
}

// Presentations from years before the CSV-based schedule (2024/2025) only
// have their own scraped "M/D/YYYY" or "M/D/YY" date + "H:MM AM/PM" time -
// parse those into the same {date, sort_time, day} shape the 2026 schedule
// rows already have, so both render through the same code.
export function parseUsDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec((s || '').trim());
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

export function getAvailableYears(data) {
  const years = {};
  (data.schedule || []).forEach((s) => { years[s.year] = true; });
  const yearTagRe = /^NOAI (\d{4}) Presentation$/;
  (data.tags || []).forEach((t) => {
    const m = yearTagRe.exec(t.name);
    if (m) years[m[1]] = true;
  });
  return Object.keys(years).sort().reverse();
}

// Unifies the rich, CSV-sourced 2026 schedule with a schedule synthesized
// from presentations[] for other years (which only have their own scraped
// date/time/location - no logistics-only slots, no type/tag).
export function getScheduleForYear(data, year) {
  const rows = (data.schedule || []).filter((s) => s.year === year);
  if (rows.length) return rows;

  const yearTag = (data.tags || []).find((t) => t.name === `NOAI ${year} Presentation`);
  if (!yearTag) return rows;

  const synthesized = [];
  (data.presentations || []).forEach((p) => {
    if ((p.tags || []).indexOf(yearTag.id) === -1) return;
    const sf = p.scraped_fields || {};
    const d = parseUsDate(sf.date);
    const t = parseDisplayTime(sf.time);
    if (!d || !t) return;
    synthesized.push({
      year, day: d.dow, date: d.iso, time: sf.time, sort_time: t,
      raw_time_range: sf.time, location: sf.location || 'TBA',
      title: stripTags(p.title.rendered), presenters: sf.presenter_name || '',
      type: '', tag: '', presentation_id: p.id,
    });
  });
  return synthesized;
}

// A schedule row has no id of its own (it's a CSV row, not a database
// record) - title+time alone collides for recurring slots like "Lunch"
// that appear on multiple days at the same time, so React needs the full
// combination to tell rows apart as a stable list key.
export function scheduleItemKey(it) {
  return `${it.date}|${it.sort_time}|${it.location}|${it.title}`;
}

export function mediaUrl(m, size) {
  if (!m) return null;
  const sizes = (m.media_details && m.media_details.sizes) || {};
  return (sizes[size] && sizes[size].source_url) || m.source_url || null;
}

export function featuredUrl(mediaById, item, size) {
  if (!item || !item.featured_media) return null;
  const m = mediaById[item.featured_media];
  return m ? mediaUrl(m, size) : null;
}

export function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

// Picks a fresh favicon (and, cosmetically, a fresh og:image tag in this
// document) on every load, from whatever icon-*/ogg-* files the media
// manifest currently lists. Note this can't make *shared-link* previews
// change per click: social crawlers read the static og:image already
// baked into the HTML they fetch and never run this script.
export function rotateSiteImages(images) {
  const icons = (images && images.icons) || [];
  const ogg = (images && images.ogg) || [];
  if (icons.length) {
    const el = document.getElementById('site-favicon');
    if (el) el.href = icons[Math.floor(Math.random() * icons.length)];
  }
  if (ogg.length) {
    const pick = `${location.origin}/${ogg[Math.floor(Math.random() * ogg.length)]}`;
    ["meta[property='og:image']", "meta[name='twitter:image']"].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute('content', pick);
    });
  }
}
