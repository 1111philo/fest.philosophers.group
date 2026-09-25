import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SearchField, Input, Tabs, TabList, Tab, TabPanel } from 'react-aria-components';
import SiteHeader from './SiteHeader';
import YearMenu from './YearMenu';
import Drawer from './Drawer';
import PresenterBio from './PresenterBio';
import WpContent from './WpContent';
import AddToCalendarMenu from './AddToCalendarMenu';
import {
  getAvailableYears, getScheduleForYear, featuredUrl, dayLabel, typeSlug, stripTags,
  rotateSiteImages, scheduleItemKey, eventInfoForPresentation, groupConsecutiveByType, mergePartyWithTrailingTalks, groupsForYear, groupSlug, itemSlug,
} from '../lib/scheduleUtils';
import { routeSlug } from '../lib/slug';

function navigate(url) {
  if (location.pathname !== url) history.pushState(null, '', url);
}
function navigateHome() {
  if (location.pathname !== '/') history.pushState(null, '', '/');
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

function PresentationBody({ pres, mediaById, onOpenPresentationSlug, eventInfo }) {
  const sf = pres.scraped_fields || {};
  const hero = featuredUrl(mediaById, pres, 'large');
  return (
    <>
      {hero && <img className="modal-hero" src={hero} alt="" />}
      <h2 dangerouslySetInnerHTML={{ __html: pres.title.rendered }} />
      <div className="modal-meta">
        {sf.location && <span className="badge loc">{sf.location}</span>}
        {(sf.date || sf.time) && <span className="badge loc">{[sf.date, sf.time].filter(Boolean).join(' · ')}</span>}
        <TypeBadge type={sf.type} />
      </div>
      {sf.type === 'Workshop' && (
        <p className="reg-note workshop-ticket-note">
          A ticket is required to join this workshop. All registrations include one workshop ticket -
          additional tickets may be available on the <a href="/register/">registration form</a>.
        </p>
      )}
      {eventInfo && (
        <AddToCalendarMenu item={eventInfo} description={sf.presenter_name || ''} />
      )}
      {(sf.presenter_name || sf.presenter_bio) && (
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

export default function ScheduleApp({ initialView }) {
  const [data, setData] = useState(null);
  const [year, setYear] = useState('2026');
  const [day, setDay] = useState('all');
  const [query, setQuery] = useState('');
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

  const openPresentation = useCallback((pres, { push = true } = {}) => {
    setDrawerItem({ kind: 'presentation', pres });
    if (push) navigate(`/p/${routeSlug(pres.slug)}/`);
  }, []);

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
    if (push) navigate(`/item/${itemSlug(item)}/`);
  }, []);

  // Pushes its own history entry (like openPresentation) so that going back
  // from a talk opened from inside the group's drawer returns to the group
  // list, instead of closing straight through to the full schedule.
  const openGroup = useCallback((group, { push = true } = {}) => {
    setDrawerItem({ kind: 'group', item: group });
    if (push) navigate(`/group/${groupSlug(group)}/`);
  }, []);

  const openScheduleItem = useCallback((item) => {
    if (item.kind === 'group') { openGroup(item); return; }
    if (item.presentation_id) {
      const pres = (dataRef.current.presentations || []).find((p) => p.id === item.presentation_id);
      if (pres) { openPresentation(pres); return; }
    }
    openLogisticsItem(item);
  }, [openPresentation, openLogisticsItem, openGroup]);

  const closeDrawer = useCallback((open) => {
    if (!open) { setDrawerItem(null); navigateHome(); }
  }, []);

  const goToSchedule = useCallback(() => {
    setDrawerItem(null);
    navigateHome();
    setDay('all');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const resolveFromLocation = useCallback(() => {
    const path = location.pathname;
    const m = /^\/p\/([^/]+)\/?$/.exec(path);
    if (m) {
      const pres = findPresentationBySlug(decodeURIComponent(m[1]));
      if (pres) { openPresentation(pres, { push: false }); return; }
    }
    const g = /^\/group\/([^/]+)\/?$/.exec(path);
    if (g && dataRef.current) {
      const group = groupsForYear(dataRef.current, year).find((it) => groupSlug(it) === decodeURIComponent(g[1]));
      if (group) { openGroup(group, { push: false }); return; }
    }
    const i = /^\/item\/([^/]+)\/?$/.exec(path);
    if (i && dataRef.current) {
      const item = getScheduleForYear(dataRef.current, year).find((it) => itemSlug(it) === decodeURIComponent(i[1]));
      if (item) { openLogisticsItem(item, { push: false }); return; }
    }
    setDrawerItem(null);
  }, [findPresentationBySlug, openPresentation, openGroup, openLogisticsItem, year]);

  useEffect(() => {
    fetch('/content.json')
      .then((r) => r.json())
      .then((json) => {
        dataRef.current = json;
        setData(json);
        rotateSiteImages(json.site_images);
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

  const years = useMemo(() => (data ? getAvailableYears(data) : []), [data]);
  const scheduleForYear = useMemo(() => (data ? getScheduleForYear(data, year) : []), [data, year]);
  const days = useMemo(
    () => [...new Set(scheduleForYear.map((s) => s.date))].sort(),
    [scheduleForYear],
  );

  if (!data) {
    return (
      <>
        <SiteHeader onSchedule={goToSchedule} current="schedule" />
        <main />
      </>
    );
  }

  const trimmedQuery = query.trim().toLowerCase();
  let mainContent;
  if (trimmedQuery) {
    const matches = scheduleForYear
      .filter((it) => `${it.title} ${it.presenters} ${it.location}`.toLowerCase().includes(trimmedQuery))
      .sort((a, b) => (a.date + a.sort_time).localeCompare(b.date + b.sort_time));
    if (!matches.length) {
      mainContent = <div className="empty-state">No matches for &ldquo;{query}&rdquo;.</div>;
    } else {
      let lastDate = null;
      mainContent = (
        <>
          <p className="search-results-note">{matches.length} result{matches.length === 1 ? '' : 's'} across the full schedule</p>
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
    mainContent = days.map((date) => {
      const lbl = dayLabel(date);
      const dayItems = groupConsecutiveByType(
        mergePartyWithTrailingTalks(scheduleForYear.filter((it) => it.date === date).sort((a, b) => a.sort_time.localeCompare(b.sort_time))),
        'Lightning Talk',
      );
      return (
        <div key={date}>
          <h2 className="day-header">{dayItems[0].day}, {lbl.date}</h2>
          <Tracks dayItems={dayItems} onOpen={openScheduleItem} mediaById={mediaById} presentationsById={presentationsById} />
        </div>
      );
    });
  } else {
    const dayItems = groupConsecutiveByType(
      mergePartyWithTrailingTalks(scheduleForYear.filter((it) => it.date === day).sort((a, b) => a.sort_time.localeCompare(b.sort_time))),
      'Lightning Talk',
    );
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
      : <div className="empty-state">Nothing scheduled yet for this day.</div>;
  }

  return (
    <>
      <SiteHeader onSchedule={goToSchedule} current="schedule" />

      <main>
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
            {mainContent}
          </TabPanel>
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
