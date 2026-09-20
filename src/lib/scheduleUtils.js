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

// Collapses a run of consecutive, same-location schedule rows of the given
// type (e.g. seven straight Lightning Talks) into one synthetic "program"
// card, so a slot like that reads as a single block on the schedule
// instead of crowding the track with a card per speaker. `items` is
// already time-sorted; a run only continues while both the type and the
// location keep matching, so it's safe to call on a full day's rows (mixed
// locations) as well as a single location's own list.
export function groupConsecutiveByType(items, type) {
  const result = [];
  let run = [];
  const flushRun = () => {
    if (run.length === 1) {
      result.push(run[0]);
    } else if (run.length > 1) {
      const first = run[0];
      const last = run[run.length - 1];
      const startTime = (first.raw_time_range || first.time || '').split(/[–-]/)[0].trim();
      const endTime = (last.raw_time_range || last.time || '').split(/[–-]/).pop().trim();
      const timeRange = `${startTime}–${endTime}`;
      result.push({
        kind: 'group',
        year: first.year, day: first.day, date: first.date, sort_time: first.sort_time,
        time: timeRange, raw_time_range: timeRange,
        location: first.location, title: `${type}s`,
        presenters: `${run.length} speakers`, type, tag: first.tag,
        items: run,
      });
    }
    run = [];
  };
  items.forEach((it) => {
    if (it.type === type && (!run.length || run[0].location === it.location)) {
      run.push(it);
    } else {
      flushRun();
      if (it.type === type) run.push(it);
      else result.push(it);
    }
  });
  flushRun();
  return result;
}

// A short, readable URL segment for a group - unique enough in practice
// (one group of a given type per day) without the noise of encoding its
// full scheduleItemKey.
export function groupSlug(group) {
  return `${typeSlug(group.type)}-${group.date}`;
}

// Every Lightning-Talk-style group for a year, across all days - lets a
// /group/<key>/ URL (pushed when a group card is opened, so the browser's
// back button can return to it from a talk opened inside) be resolved back
// to the right group, the same way findPresentationBySlug resolves /p/.
export function groupsForYear(data, year) {
  const rows = getScheduleForYear(data, year)
    .slice()
    .sort((a, b) => (a.date + a.sort_time).localeCompare(b.date + b.sort_time));
  return groupConsecutiveByType(rows, 'Lightning Talk').filter((it) => it.kind === 'group');
}

// A schedule row has no id of its own (it's a CSV row, not a database
// record) - title+time alone collides for recurring slots like "Lunch"
// that appear on multiple days at the same time, so React needs the full
// combination to tell rows apart as a stable list key.
export function scheduleItemKey(it) {
  return `${it.date}|${it.sort_time}|${it.location}|${it.title}`;
}

// Finds (or, for years before the CSV schedule existed, synthesizes) the
// date/time/location a given presentation happened at, in the same shape
// AddToCalendarMenu expects - shared with getScheduleForYear's synthesis
// logic above, since it's the same data either way.
export function eventInfoForPresentation(data, pres) {
  const row = (data.schedule || []).find((s) => s.presentation_id === pres.id);
  if (row) return row;

  const sf = pres.scraped_fields || {};
  const d = parseUsDate(sf.date);
  const t = parseDisplayTime(sf.time);
  if (!d || !t) return null;
  return {
    day: d.dow, date: d.iso, time: sf.time, sort_time: t, raw_time_range: sf.time,
    location: sf.location || 'TBA', title: stripTags(pres.title.rendered),
    presenters: sf.presenter_name || '', type: sf.type || '',
  };
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
