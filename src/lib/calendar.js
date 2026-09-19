// Builds "add to calendar" links/files for a schedule item. Every event this
// festival has ever scheduled falls after Daylight Saving ends in the US
// (early November), so New Orleans (America/Chicago) is always fixed at
// CST/UTC-6 for these dates - that lets every time be converted to an exact
// UTC instant with a plain offset, no timezone database needed.
const OFFSET_HOURS = 6;
const DEFAULT_DURATION_MINUTES = 60;

export const VENUE_ADDRESS = '400 Esplanade Ave, New Orleans, LA 70116';

function minutesSinceMidnight(sortTime) {
  const [h, m] = sortTime.split(':').map(Number);
  return h * 60 + m;
}

// raw_time_range gives the end time as a bare 12-hour number with no AM/PM
// ("5:35–6:08", "11:15–11:45", "12:00–1:00") - since every session here is
// under 12 hours and never wraps past midnight, the right interpretation is
// always whichever reading (AM or PM) is soonest after the start time.
function endMinutesFromRange(rawTimeRange, startMinutes) {
  const m = /[\u2013-]\s*(\d{1,2}):(\d{2})/.exec(rawTimeRange || '');
  if (!m) return startMinutes + DEFAULT_DURATION_MINUTES;
  const endH12 = Number(m[1]) % 12;
  const endMin = Number(m[2]);
  const candidates = [endH12 * 60 + endMin, (endH12 + 12) * 60 + endMin];
  const later = candidates.filter((c) => c > startMinutes).sort((a, b) => a - b);
  return later.length ? later[0] : candidates.sort((a, b) => a - b)[0] + 24 * 60;
}

function localMinutesToUtcDate(dateStr, minutes) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes + OFFSET_HOURS * 60));
}

// Accepts any schedule-row-shaped item: {date: 'YYYY-MM-DD', sort_time:
// 'HH:MM' (24h), raw_time_range}.
export function eventWindow(item) {
  const start = minutesSinceMidnight(item.sort_time);
  const end = endMinutesFromRange(item.raw_time_range, start);
  return {
    start: localMinutesToUtcDate(item.date, start),
    end: localMinutesToUtcDate(item.date, end),
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}
function formatUtcCompact(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Google/Outlook.com/Yahoo cover the major *web* calendars via a plain URL;
// the .ics file covers everything else (Apple Calendar, desktop Outlook,
// and any other app that can import one) - between the two, every major
// calendar is supported without needing a server or an OAuth integration.
export function buildCalendarLinks({ title, description, location, start, end }) {
  const startCompact = formatUtcCompact(start);
  const endCompact = formatUtcCompact(end);
  const startIso = start.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const endIso = end.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const durationMinutes = Math.round((end - start) / 60000);
  const dur = `${pad(Math.floor(durationMinutes / 60))}${pad(durationMinutes % 60)}`;

  const google = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startCompact}/${endCompact}&details=${encodeURIComponent(description || '')}&location=${encodeURIComponent(location)}`;

  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&startdt=${encodeURIComponent(startIso)}&enddt=${encodeURIComponent(endIso)}&location=${encodeURIComponent(location)}&body=${encodeURIComponent(description || '')}`;

  const yahoo = `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${encodeURIComponent(title)}&st=${startCompact}&dur=${dur}&desc=${encodeURIComponent(description || '')}&in_loc=${encodeURIComponent(location)}`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//New Orleans Arts & Ideas Festival//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${startCompact}-${Math.random().toString(36).slice(2)}@fest.philosophers.group`,
    `DTSTAMP:${formatUtcCompact(new Date())}`,
    `DTSTART:${startCompact}`,
    `DTEND:${endCompact}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(location)}`,
    description ? `DESCRIPTION:${icsEscape(description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return { google, outlook, yahoo, ics };
}

export function downloadIcs(filename, icsContent) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
