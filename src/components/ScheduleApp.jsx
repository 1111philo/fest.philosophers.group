import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchField, Input, Tabs, TabList, Tab, TabPanel, Button } from 'react-aria-components';
import SiteHeader from './SiteHeader';
import YearMenu from './YearMenu';
import AudienceMenu from './AudienceMenu';
import Drawer from './Drawer';
import PresenterBio from './PresenterBio';
import WpContent from './WpContent';
import AddToCalendarMenu from './AddToCalendarMenu';
import {
  getAvailableYears, getScheduleForYear, featuredUrl, dayLabel, typeSlug, stripTags,
  scheduleItemKey, eventInfoForPresentation, groupConsecutiveByType, mergePartyWithTrailingTalks, groupsForYear, groupSlug, itemSlug,
} from '../lib/scheduleUtils';
import { routeSlug } from '../lib/slug';
import audienceData from '../data/audiences.json';

// Audience tags (data/audiences.json). Stored and shown without "For" -
// the UI supplies the "For:" label wherever they appear.
const AUDIENCES = [
  ['teachers', 'Teachers'],
  ['students', 'Students'],
  ['business', 'Business'],
  ['artists', 'Artists'],
  ['fun', 'Fun'],
];
const AUDIENCE_IDS = AUDIENCES.map(([id]) => id);
const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES);

// A schedule row's audiences: its presentation's tags, or - for rows with
// no presentation (parties, receptions) - tags keyed by the row's title.
function audiencesFor(item) {
  // A grouped card (a run of lightning talks, or a party with its talks)
  // stands for every audience of the items inside it.
  if (Array.isArray(item.items)) {
    const inner = new Set([...(audienceData.scheduleItems[item.title] || []), ...item.items.flatMap(audiencesFor)]);
    return AUDIENCE_IDS.filter((id) => inner.has(id));
  }
  const pres = item.presentation_id && audienceData.presentations[item.presentation_id];
  if (pres) return pres.for;
  return audienceData.scheduleItems[item.title] || [];
}

// "Teachers", "Teachers or Artists", "Teachers, Students, or Artists".
function audiencePhrase(ids) {
  const labels = ids.map((id) => AUDIENCE_LABEL[id]);
  if (labels.length <= 2) return labels.join(' or ');
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

// ?for=teachers&for=artists (also tolerates a comma list), validated and
// kept in the canonical AUDIENCES order.
function parseAudiences(params) {
  const wanted = new Set(params.getAll('for').flatMap((v) => v.split(',')));
  return AUDIENCE_IDS.filter((id) => wanted.has(id));
}

function navigate(url) {
  if (location.pathname + location.search !== url) history.pushState(null, '', url);
}
function navigateHome(search = '') {
  const url = `/${search}`;
  if (location.pathname + location.search !== url) history.pushState(null, '', url);
}

// Reflects the year/day/search/audience filters as query params, so a link
// to (say) a past year, a specific day, a search result, or a set of
// audiences is shareable/bookmarkable - omitting whichever ones are just
// the default, so the common case (this year, all days, no search, every
// audience) still has a clean bare URL.
function buildFilterSearch(year, day, query, audiences = []) {
  const params = new URLSearchParams();
  if (year && year !== '2026') params.set('year', year);
  if (day && day !== 'all') params.set('day', day);
  if (query && query.trim()) params.set('q', query.trim());
  audiences.forEach((id) => params.append('for', id));
  const s = params.toString();
  return s ? `?${s}` : '';
}

function TypeBadge({ type }) {
  if (!type) return null;
  return <span className={`badge type-${typeSlug(type)}`}>{type}</span>;
}

// A presentation's own thumbnail if it has one (checked in the same
// preference order as the build-time og:image fallback: featured media,
// then the scraped presenter photo), otherwise null - logistics rows
// (breaks, parties, etc.) never have one, and just don't get a thumbnail
// rather than a fake placeholder swatch.
function scheduleThumb(item, presentationsById, mediaById) {
  if (!item.presentation_id) return null;
  const pres = presentationsById[item.presentation_id];
  if (!pres) return null;
  return featuredUrl(mediaById, pres, 'thumbnail') || (pres.scraped_fields || {}).presenter_photo_url || null;
}

// "For: Teachers, Students" - the audience tags wherever they're shown. A
// block-level <span>, not <p>, since cards and group rows are <button>s.
function AudienceLine({ ids, className = '' }) {
  if (!ids || !ids.length) return null;
  return (
    <span className={`aud-line ${className}`.trim()}>
      <span className="aud-line-label">For:</span>{' '}
      {ids.map((id, i) => (
        <span key={id} className={`aud-tag aud-${id}`}>
          {AUDIENCE_LABEL[id]}{i < ids.length - 1 && ', '}
        </span>
      ))}
    </span>
  );
}

function ScheduleCard({ item, onOpen, mediaById, presentationsById }) {
  const thumb = scheduleThumb(item, presentationsById, mediaById);
  return (
    <button type="button" className="card" onClick={() => onOpen(item)}>
      <div className="card-time">{item.time}</div>
      {thumb && <img className="card-thumb" src={thumb} alt="" loading="lazy" />}
      <div className="card-body">
        <div className="card-title">{item.title}</div>
        {item.presenters && <div className="card-presenter">{item.presenters}</div>}
        <div className="card-meta">
          <span className="badge loc">{item.location}</span>
          <TypeBadge type={item.type} />
        </div>
        <AudienceLine ids={audiencesFor(item)} className="card-aud" />
      </div>
    </button>
  );
}

// Builds the (possibly multi-column, by-venue) tracks for one day's worth
// of already-sorted items. Shared by the single-day view and each section
// of the all-days view.
function Tracks({ dayItems, onOpen, mediaById, presentationsById }) {
  const byLocation = {};
  dayItems.forEach((it) => { (byLocation[it.location] = byLocation[it.location] || []).push(it); });
  // Object.keys() order otherwise falls out of whichever venue's first item
  // happens earliest that day - pin Main Stage first regardless, since
  // it's the festival's primary venue.
  const majorTracks = Object.keys(byLocation)
    .filter((loc) => byLocation[loc].length >= 3)
    .sort((a, b) => (b.startsWith('Main Stage') ? 1 : 0) - (a.startsWith('Main Stage') ? 1 : 0));

  if (majorTracks.length >= 2) {
    const minorItems = dayItems.filter((it) => majorTracks.indexOf(it.location) === -1);
    return (
      <div className="tracks multi">
        {majorTracks.map((loc) => (
          <div key={loc}>
            <h3 className="track-heading">{loc}</h3>
            <div className="track-list">
              {byLocation[loc].map((it) => (
                <ScheduleCard key={scheduleItemKey(it)} item={it} onOpen={onOpen} mediaById={mediaById} presentationsById={presentationsById} />
              ))}
            </div>
          </div>
        ))}
        {minorItems.length > 0 && (
          <div>
            <h3 className="track-heading">Also Today</h3>
            <div className="track-list">
              {minorItems.map((it) => (
                <ScheduleCard key={scheduleItemKey(it)} item={it} onOpen={onOpen} mediaById={mediaById} presentationsById={presentationsById} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="tracks">
      <div className="track-list">
        {dayItems.map((it) => (
          <ScheduleCard key={scheduleItemKey(it)} item={it} onOpen={onOpen} mediaById={mediaById} presentationsById={presentationsById} />
        ))}
      </div>
    </div>
  );
}

// "Wednesday, Nov 11, 2026" from an ISO date, read as a calendar date (no
// timezone shift).
function formatEventDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

// "8:40–8:50 PM": the schedule's range ("8:40–8:50") with the meridiem
// from its start time ("8:40 PM"), flipped for the end when the range
// crosses noon ("11:30–12:30" from "11:30 AM" ends PM). Falls back to
// whichever field is there.
function timeRangeLabel({ time = '', raw_time_range: range = '' }) {
  const m = /^(\d{1,2}):\d{2}\s*(AM|PM)$/i.exec(time.trim());
  const r = /^(\d{1,2}):\d{2}\s*[–-]\s*(\d{1,2}):\d{2}$/.exec(range.trim());
  if (!m || !r) return range || time;
  let mer = m[2].toUpperCase();
  const start = Number(r[1]) % 12;
  const end = Number(r[2]) % 12;
  if (end < start) mer = mer === 'AM' ? 'PM' : 'AM';
  return `${range.trim()} ${mer}`;
}

function PresentationBody({ pres, mediaById, onOpenPresentationSlug, eventInfo }) {
  const sf = pres.scraped_fields || {};
  const hero = featuredUrl(mediaById, pres, 'large');
  // When/where/type come from the published schedule row (eventInfo) when
  // there is one - the same source as the schedule cards. The WordPress
  // post's own fields go stale as the schedule changes, so they're only a
  // fallback for talks with no schedule row.
  const location = (eventInfo && eventInfo.location) || sf.location;
  const when = eventInfo
    ? [eventInfo.date && formatEventDate(eventInfo.date), timeRangeLabel(eventInfo)].filter(Boolean).join(' · ')
    : [sf.date, sf.time].filter(Boolean).join(' · ');
  const type = (eventInfo && eventInfo.type) || sf.type;
  return (
    <>
      {hero && <img className="modal-hero" src={hero} alt="" />}
      <h2 dangerouslySetInnerHTML={{ __html: pres.title.rendered }} />
      <div className="modal-meta">
        {location && <span className="badge loc">{location}</span>}
        {when && <span className="badge loc">{when}</span>}
        <TypeBadge type={type} />
      </div>
      <AudienceLine ids={(audienceData.presentations[pres.id] || {}).for} className="modal-aud" />
      {type === 'Workshop' && (
        <p className="reg-note workshop-ticket-note">
          A ticket is required to join this workshop. All registrations include one workshop ticket -
          additional tickets may be available on the <a href="/register/">registration form</a>.
        </p>
      )}
      {eventInfo && (
        <AddToCalendarMenu item={eventInfo} description={sf.presenter_name || ''} />
      )}
      {sf.presenters ? sf.presenters.map((person) => (
        <div className="presenter-card" key={person.name}>
          {person.photo_url && <img src={person.photo_url} alt="" />}
          <div>
            <div className="presenter-name">{person.name}</div>
            <PresenterBio text={person.bio || ''} />
          </div>
        </div>
      )) : (sf.presenter_name || sf.presenter_bio) && (
        <div className="presenter-card">
          {sf.presenter_photo_url && <img src={sf.presenter_photo_url} alt="" />}
          <div>
            <div className="presenter-name">{sf.presenter_name || 'Presenter'}</div>
            <PresenterBio text={sf.presenter_bio || ''} />
          </div>
        </div>
      )}
      <WpContent html={pres.content && pres.content.rendered} onOpenPresentationSlug={onOpenPresentationSlug} />
    </>
  );
}

const SPONSORS = [
  { name: 'New Orleans Jazz Museum', logo: '/media/sponsors/jazz-museum.jpg', url: 'https://nolajazzmuseum.org' },
  { name: 'Louisiana Economic Development', logo: '/media/sponsors/led.jpg', url: 'https://www.opportunitylouisiana.gov' },
  { name: 'Excella', logo: '/media/sponsors/excella.png', url: 'https://www.excella.com' },
  { name: 'Intelligent Archives', logo: '/media/sponsors/intelligent-archives.png', url: null },
  { name: 'Starbucks', logo: '/media/sponsors/starbucks.png', url: null },
  { name: 'Astral Codex Ten', logo: '/media/sponsors/astral-codex-ten.jpeg', url: null },
  { name: 'Equalify', logo: '/media/sponsors/equalify.png', url: 'https://equalify.app/' },
];

function SponsorLogo({ sponsor }) {
  const img = <img src={sponsor.logo} alt={sponsor.name} loading="lazy" />;
  if (!sponsor.url) return <span className="sponsor-logo">{img}</span>;
  return (
    <a className="sponsor-logo" href={sponsor.url} target="_blank" rel="noopener">
      {img}
      <span className="sr-only"> (opens in a new window)</span>
    </a>
  );
}

function SponsorStrip() {
  return (
    <section className="sponsor-strip" aria-label="Sponsors">
      <h2 className="sponsor-strip-heading">Sponsors</h2>
      <div className="sponsor-logos">
        {SPONSORS.map((sponsor) => <SponsorLogo key={sponsor.name} sponsor={sponsor} />)}
      </div>
      <p className="sponsor-thanks">
        <strong>Special thanks</strong> to Jesse Hoppes, Dustin Gaspard, Latoya Taylor, Phillip Brimer,
        Sam Birdsong, Blake Bertuccelli-Booth, Joseph Makkos, Ray Fontaine, George Mauer, Chuck Taylor,
        Baylee Badawy, Sabelo Jupiter, Luke Hawley, Renee Peck, the Kirin family, and Walter Isaacson.
      </p>
    </section>
  );
}

function LogisticsBody({ item }) {
  return (
    <>
      <h2>{item.title}</h2>
      <div className="modal-meta">
        <span className="badge loc">{item.location}</span>
        <TypeBadge type={item.type} />
      </div>
      <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
        {item.day} &bull; {item.raw_time_range || item.time}
      </p>
      {item.presenters && <p style={{ fontSize: '14px' }}>{item.presenters}</p>}
      <AddToCalendarMenu item={item} description={item.presenters || ''} />
    </>
  );
}

// A run of same-location, same-type talks collapsed into one card (see
// groupConsecutiveByType) - lists each nested talk, opening its own
// presentation drawer on click if it has one.
function GroupBody({ group, onOpenPresentationId }) {
  return (
    <>
      <h2>{group.title}</h2>
      <div className="modal-meta">
        <span className="badge loc">{group.location}</span>
        <span className="badge loc">{group.raw_time_range}</span>
      </div>
      <AddToCalendarMenu item={group} description={group.presenters} />
      <ul className="group-talk-list">
        {group.items.map((it) => (
          <li key={scheduleItemKey(it)}>
            {it.presentation_id ? (
              <button type="button" className="group-talk group-talk-link" onClick={() => onOpenPresentationId(it.presentation_id)}>
                <span className="group-talk-time">{it.time}</span>
                <span className="sr-only">, </span>
                <span className="group-talk-title">{it.title}</span>
                {it.presenters && (
                  <>
                    <span className="sr-only">, </span>
                    <span className="group-talk-presenter">{it.presenters}</span>
                    <AudienceLine ids={audiencesFor(it)} className="group-talk-aud" />
                  </>
                )}
              </button>
            ) : (
              <div className="group-talk">
                <span className="group-talk-time">{it.time}</span>
                <span className="sr-only">, </span>
                <span className="group-talk-title">{it.title}</span>
                {it.presenters && (
                  <>
                    <span className="sr-only">, </span>
                    <span className="group-talk-presenter">{it.presenters}</span>
                    <AudienceLine ids={audiencesFor(it)} className="group-talk-aud" />
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// Seeds year/day/search from the URL the page was loaded with, so a link
// like /?year=2023, /?year=2023&day=2023-11-11, or /?q=chess opens straight
// into that filtered view instead of always starting from the defaults.
function initialFilters() {
  if (typeof window === 'undefined') return { year: '2026', day: 'all', query: '', audiences: [] };
  const params = new URLSearchParams(window.location.search);
  return {
    year: params.get('year') || '2026',
    day: params.get('day') || 'all',
    query: params.get('q') || '',
    audiences: parseAudiences(params),
  };
}

export default function ScheduleApp({ initialView }) {
  const [data, setData] = useState(null);
  const [year, setYear] = useState(() => initialFilters().year);
  const [day, setDay] = useState(() => initialFilters().day);
  const [query, setQuery] = useState(() => initialFilters().query);
  const [audiences, setAudiences] = useState(() => initialFilters().audiences);
  const [drawerItem, setDrawerItem] = useState(null); // { kind: 'presentation'|'logistics', pres?, item? }
  const dataRef = useRef(null);

  const mediaById = useMemo(() => {
    const map = {};
    (data && data.media || []).forEach((m) => { map[m.id] = m; });
    return map;
  }, [data]);

  const presentationsById = useMemo(() => {
    const map = {};
    (data && data.presentations || []).forEach((p) => { map[p.id] = p; });
    return map;
  }, [data]);

  // Matches on routeSlug() both sides so this works whether `slug` is a raw
  // WP slug (internal cross-links baked into old content HTML) or a URL
  // path segment (from location.pathname) - the one WP slug with literal
  // percent-hex text in it (an old emoji title) isn't safely routable, so
  // its real URL uses a sanitized form; routeSlug() is a no-op for every
  // other (normal) slug, so this doesn't change matching for anything else.
  const findPresentationBySlug = useCallback((slug) => (
    (dataRef.current && dataRef.current.presentations || []).find((p) => routeSlug(p.slug) === routeSlug(slug))
  ), []);

  // Carried along on every pushed drawer URL (and reapplied when one
  // closes back to "/") so the current year/day/search filters stay
  // reflected in the address bar no matter what else is showing.
  const filterSearch = useMemo(() => buildFilterSearch(year, day, query, audiences), [year, day, query, audiences]);

  const openPresentation = useCallback((pres, { push = true } = {}) => {
    setDrawerItem({ kind: 'presentation', pres });
    if (push) navigate(`/p/${routeSlug(pres.slug)}/${filterSearch}`);
  }, [filterSearch]);

  const openPresentationSlug = useCallback((slug) => {
    const pres = findPresentationBySlug(slug);
    if (pres) openPresentation(pres);
  }, [findPresentationBySlug, openPresentation]);

  const openPresentationId = useCallback((id) => {
    const pres = (dataRef.current.presentations || []).find((p) => p.id === id);
    if (pres) openPresentation(pres);
  }, [openPresentation]);

  // Pushes its own URL, like openPresentation/openGroup, so a talk with no
  // presentation of its own (no write-up ever came in for it) is still
  // linkable/bookmarkable instead of only reachable by clicking through
  // the schedule.
  const openLogisticsItem = useCallback((item, { push = true } = {}) => {
    setDrawerItem({ kind: 'logistics', item });
    if (push) navigate(`/item/${itemSlug(item)}/${filterSearch}`);
  }, [filterSearch]);

  // Pushes its own history entry (like openPresentation) so that going back
  // from a talk opened from inside the group's drawer returns to the group
  // list, instead of closing straight through to the full schedule.
  const openGroup = useCallback((group, { push = true } = {}) => {
    setDrawerItem({ kind: 'group', item: group });
    if (push) navigate(`/group/${groupSlug(group)}/${filterSearch}`);
  }, [filterSearch]);

  const openScheduleItem = useCallback((item) => {
    if (item.kind === 'group') { openGroup(item); return; }
    if (item.presentation_id) {
      const pres = (dataRef.current.presentations || []).find((p) => p.id === item.presentation_id);
      if (pres) { openPresentation(pres); return; }
    }
    openLogisticsItem(item);
  }, [openPresentation, openLogisticsItem, openGroup]);

  const closeDrawer = useCallback((open) => {
    if (!open) { setDrawerItem(null); navigateHome(filterSearch); }
  }, [filterSearch]);

  const goToSchedule = useCallback(() => {
    setDrawerItem(null);
    navigateHome();
    setDay('all');
    setQuery('');
    setAudiences([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Re-syncs both the drawer (from the path) and the year/day/search
  // filters (from the query string) to whatever URL is now showing - used
  // on back/forward, where the browser has already restored an earlier
  // URL and React state needs to catch up to match it. Reads the year
  // straight from that URL (not the possibly-stale `year` state) since a
  // pushed group/item URL is scoped to whatever year was active when it
  // was pushed.
  const resolveFromLocation = useCallback(() => {
    const path = location.pathname;
    const params = new URLSearchParams(location.search);
    const urlYear = params.get('year') || '2026';
    setYear(urlYear);
    setDay(params.get('day') || 'all');
    setQuery(params.get('q') || '');
    setAudiences(parseAudiences(params));

    const m = /^\/p\/([^/]+)\/?$/.exec(path);
    if (m) {
      const pres = findPresentationBySlug(decodeURIComponent(m[1]));
      if (pres) { openPresentation(pres, { push: false }); return; }
    }
    const g = /^\/group\/([^/]+)\/?$/.exec(path);
    if (g && dataRef.current) {
      const group = groupsForYear(dataRef.current, urlYear).find((it) => groupSlug(it) === decodeURIComponent(g[1]));
      if (group) { openGroup(group, { push: false }); return; }
    }
    const i = /^\/item\/([^/]+)\/?$/.exec(path);
    if (i && dataRef.current) {
      const item = getScheduleForYear(dataRef.current, urlYear).find((it) => itemSlug(it) === decodeURIComponent(i[1]));
      if (item) { openLogisticsItem(item, { push: false }); return; }
    }
    setDrawerItem(null);
  }, [findPresentationBySlug, openPresentation, openGroup, openLogisticsItem]);

  useEffect(() => {
    fetch('/content.json')
      .then((r) => r.json())
      .then((json) => {
        dataRef.current = json;
        setData(json);
        if (initialView && initialView.type === 'presentation') {
          const pres = (json.presentations || []).find((p) => p.slug === initialView.slug);
          if (pres) setDrawerItem({ kind: 'presentation', pres });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', resolveFromLocation);
    return () => window.removeEventListener('popstate', resolveFromLocation);
  }, [resolveFromLocation]);

  // Keeps whatever path is currently showing ("/" or a drawer's own
  // "/p/<slug>/" etc.) in sync with the live year/day/search filters, so
  // changing a filter while a talk is open still ends up reflected in the
  // address bar. A plain replaceState (not pushState) - filter changes
  // shouldn't each get their own back-button stop the way opening a talk
  // does.
  useEffect(() => {
    const url = location.pathname + filterSearch;
    if (location.pathname + location.search !== url) history.replaceState(null, '', url);
  }, [filterSearch]);

  const years = useMemo(() => (data ? getAvailableYears(data) : []), [data]);
  const scheduleForYear = useMemo(() => (data ? getScheduleForYear(data, year) : []), [data, year]);
  // What the audience filter leaves showing (any selected audience
  // matches). Day tabs still come from the full year, so picking an
  // audience never makes a tab vanish out from under you.
  const visibleSchedule = useMemo(() => {
    if (!audiences.length) return scheduleForYear;
    const wanted = new Set(audiences);
    return scheduleForYear.filter((it) => audiencesFor(it).some((id) => wanted.has(id)));
  }, [scheduleForYear, audiences]);
  const days = useMemo(
    () => [...new Set(scheduleForYear.map((s) => s.date))].sort(),
    [scheduleForYear],
  );

  if (!data) {
    return (
      <>
        <SiteHeader onSchedule={goToSchedule} current="schedule" />
        <main id="main" tabIndex={-1} />
      </>
    );
  }

  const trimmedQuery = query.trim().toLowerCase();
  const forPhrase = audiences.length ? ` for ${audiencePhrase(audiences)}` : '';
  // How many cards the current view shows (a run of lightning talks is one
  // grouped card) - for the audience status line and its announcement.
  let shownCount = 0;
  let mainContent;
  if (trimmedQuery) {
    const matches = visibleSchedule
      .filter((it) => `${it.title} ${it.presenters} ${it.location}`.toLowerCase().includes(trimmedQuery))
      .sort((a, b) => (a.date + a.sort_time).localeCompare(b.date + b.sort_time));
    shownCount = matches.length;
    if (!matches.length) {
      mainContent = <div className="empty-state">No matches for &ldquo;{query}&rdquo;{forPhrase}.</div>;
    } else {
      let lastDate = null;
      mainContent = (
        <>
          <p className="search-results-note">{matches.length} result{matches.length === 1 ? '' : 's'}{forPhrase} across the full schedule</p>
          {matches.map((it) => {
            const showHeader = it.date !== lastDate;
            lastDate = it.date;
            const lbl = dayLabel(it.date);
            return (
              <div key={scheduleItemKey(it)}>
                {showHeader && <h2 className="day-header">{it.day}, {lbl.date}</h2>}
                <div className="track-list">
                  <ScheduleCard item={it} onOpen={openScheduleItem} mediaById={mediaById} presentationsById={presentationsById} />
                </div>
              </div>
            );
          })}
        </>
      );
    }
  } else if (!scheduleForYear.length) {
    mainContent = <div className="empty-state">No schedule published for {year} yet.</div>;
  } else if (day === 'all') {
    // Days the audience filter empties are skipped rather than shown as a
    // bare heading.
    const sections = days.map((date) => {
      const lbl = dayLabel(date);
      const dayItems = groupConsecutiveByType(
        mergePartyWithTrailingTalks(visibleSchedule.filter((it) => it.date === date).sort((a, b) => a.sort_time.localeCompare(b.sort_time))),
        'Lightning Talk',
      );
      if (!dayItems.length) return null;
      shownCount += dayItems.length;
      return (
        <div key={date}>
          <h2 className="day-header">{dayItems[0].day}, {lbl.date}</h2>
          <Tracks dayItems={dayItems} onOpen={openScheduleItem} mediaById={mediaById} presentationsById={presentationsById} />
        </div>
      );
    }).filter(Boolean);
    mainContent = sections.length
      ? sections
      : <div className="empty-state">Nothing{forPhrase} in the {year} schedule yet.</div>;
  } else {
    const dayItems = groupConsecutiveByType(
      mergePartyWithTrailingTalks(visibleSchedule.filter((it) => it.date === day).sort((a, b) => a.sort_time.localeCompare(b.sort_time))),
      'Lightning Talk',
    );
    shownCount = dayItems.length;
    mainContent = dayItems.length
      ? (
        <>
          {/* Visually-hidden - the day tab above already shows this, but a
              track heading (h3) follows immediately and needs an h2
              ancestor so heading-level navigation doesn't skip from h1. */}
          <h2 className="sr-only">{dayItems[0].day}, {dayLabel(day).date}</h2>
          <Tracks dayItems={dayItems} onOpen={openScheduleItem} mediaById={mediaById} presentationsById={presentationsById} />
        </>
      )
      : <div className="empty-state">{audiences.length ? `Nothing${forPhrase} on this day.` : 'Nothing scheduled yet for this day.'}</div>;
  }

  // Spoken through a persistent live region whenever the audience filter
  // (or the view it applies to) changes; the visible status line below
  // says the same thing for sighted users.
  const itemWord = shownCount === 1 ? 'session' : 'sessions';
  const audienceStatus = audiences.length ? `Showing ${shownCount} ${itemWord}${forPhrase}.` : '';

  return (
    <>
      <SiteHeader onSchedule={goToSchedule} current="schedule" />

      <main id="main" tabIndex={-1}>
        <Tabs
          selectedKey={day}
          onSelectionChange={(key) => { setDay(key); setQuery(''); }}
        >
          <div className="toolbar">
            <div className="toolbar-inner">
              <div className="search-row">
                <YearMenu
                  years={years}
                  year={year}
                  onChange={(y) => { setYear(y); setDay('all'); setQuery(''); }}
                />
                <SearchField className="search-field" value={query} onChange={setQuery} aria-label="Search talks, speakers">
                  <Input className="search" placeholder="Search talks, speakers&hellip;" />
                </SearchField>
                <AudienceMenu audiences={audiences} options={AUDIENCES} onChange={setAudiences} />
              </div>


              <TabList aria-label="Day" className="day-tabs">
                <Tab id="all" className="day-tab">All Days</Tab>
                {days.map((date) => {
                  const lbl = dayLabel(date);
                  return (
                    <Tab key={date} id={date} className="day-tab">
                      <span className="dow">{lbl.dow}</span>{lbl.date}
                    </Tab>
                  );
                })}
              </TabList>
            </div>
          </div>

          {/* One real TabPanel, matching whichever tab is selected -
              mainContent already accounts for the active day (and for
              search, which overrides the day view entirely). Rendering it
              here gives the active tab's aria-controls a real element to
              point to, instead of a dangling reference. */}
          <TabPanel id={day} className="main-panel">
            {audiences.length > 0 && (
              <div className="aud-status">
                <p className="aud-status-text">{audienceStatus}</p>
                <Button className="aud-clear" onPress={() => setAudiences([])}>Clear audience filter</Button>
              </div>
            )}
            {mainContent}
          </TabPanel>
          <p className="sr-only" role="status" aria-live="polite">{audienceStatus}</p>
        </Tabs>

        <SponsorStrip />
      </main>

      <Drawer
        isOpen={!!drawerItem}
        onClose={() => closeDrawer(false)}
        ariaLabel={drawerItem && drawerItem.kind === 'presentation' ? stripTags(drawerItem.pres.title.rendered) : (drawerItem ? drawerItem.item.title : 'Details')}
      >
        {drawerItem && drawerItem.kind === 'presentation' && (
          <PresentationBody
            pres={drawerItem.pres}
            mediaById={mediaById}
            onOpenPresentationSlug={openPresentationSlug}
            eventInfo={eventInfoForPresentation(data, drawerItem.pres)}
          />
        )}
        {drawerItem && drawerItem.kind === 'logistics' && <LogisticsBody item={drawerItem.item} />}
        {drawerItem && drawerItem.kind === 'group' && (
          <GroupBody group={drawerItem.item} onOpenPresentationId={openPresentationId} />
        )}
      </Drawer>
    </>
  );
}
