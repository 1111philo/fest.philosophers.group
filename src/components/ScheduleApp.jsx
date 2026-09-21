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
  rotateSiteImages, scheduleItemKey, eventInfoForPresentation,
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

function ScheduleCard({ item, onOpen }) {
  return (
    <button type="button" className="card" onClick={() => onOpen(item)}>
      <div className="card-time">{item.time}</div>
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
function Tracks({ dayItems, onOpen }) {
  const byLocation = {};
  dayItems.forEach((it) => { (byLocation[it.location] = byLocation[it.location] || []).push(it); });
  // Main Stage leads the other venue columns regardless of which track's
  // items happen to sort earliest in the underlying data.
  const majorTracks = Object.keys(byLocation)
    .filter((loc) => byLocation[loc].length >= 3)
    .sort((a, b) => (a.startsWith('Main Stage') ? -1 : b.startsWith('Main Stage') ? 1 : 0));

  if (majorTracks.length >= 2) {
    const minorItems = dayItems.filter((it) => majorTracks.indexOf(it.location) === -1);
    return (
      <div className="tracks multi">
        {majorTracks.map((loc) => (
          <div key={loc}>
            <div className="track-heading">{loc}</div>
            <div className="track-list">
              {byLocation[loc].map((it) => <ScheduleCard key={scheduleItemKey(it)} item={it} onOpen={onOpen} />)}
            </div>
          </div>
        ))}
        {minorItems.length > 0 && (
          <div>
            <div className="track-heading">Also Today</div>
            <div className="track-list">
              {minorItems.map((it) => <ScheduleCard key={scheduleItemKey(it)} item={it} onOpen={onOpen} />)}
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="tracks">
      <div className="track-list">
        {dayItems.map((it) => <ScheduleCard key={scheduleItemKey(it)} item={it} onOpen={onOpen} />)}
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
        Baylee Badawy, Sabelo Jupiter, and Luke Hawley.
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

  const openLogisticsItem = useCallback((item) => {
    setDrawerItem({ kind: 'logistics', item });
  }, []);

  const openScheduleItem = useCallback((item) => {
    if (item.presentation_id) {
      const pres = (dataRef.current.presentations || []).find((p) => p.id === item.presentation_id);
      if (pres) { openPresentation(pres); return; }
    }
    openLogisticsItem(item);
  }, [openPresentation, openLogisticsItem]);

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
    setDrawerItem(null);
  }, [findPresentationBySlug, openPresentation]);

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
                {showHeader && <div className="day-header">{it.day}, {lbl.date}</div>}
                <div className="track-list">
                  <ScheduleCard item={it} onOpen={openScheduleItem} />
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
      const dayItems = scheduleForYear.filter((it) => it.date === date).sort((a, b) => a.sort_time.localeCompare(b.sort_time));
      return (
        <div key={date}>
          <div className="day-header">{dayItems[0].day}, {lbl.date}</div>
          <Tracks dayItems={dayItems} onOpen={openScheduleItem} />
        </div>
      );
    });
  } else {
    const dayItems = scheduleForYear.filter((it) => it.date === day).sort((a, b) => a.sort_time.localeCompare(b.sort_time));
    mainContent = dayItems.length
      ? <Tracks dayItems={dayItems} onOpen={openScheduleItem} />
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
      </Drawer>
    </>
  );
}
