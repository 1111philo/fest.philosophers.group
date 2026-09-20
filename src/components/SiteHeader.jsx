import SiteMenu from './SiteMenu';

// Shared across every page - the schedule SPA passes its own onSchedule/
// onAbout/onSponsor for in-app state changes; the standalone registration
// page (an Astro island, which can't receive function props) mounts this
// with no props at all, so the defaults below do a real navigation
// instead. `current` marks whichever page is already showing, in both the
// Register button and the hamburger menu, so it's clear you're already
// there.
export default function SiteHeader({
  onSchedule = () => { window.location.href = '/'; },
  onAbout = () => { window.location.href = '/about/'; },
  onSponsor = () => { window.location.href = '/sponsor/'; },
  current,
}) {
  return (
    <header className="header">
      <div className="header-top">
        <div className="header-text">
          <h1>
            <a
              className="header-title-link"
              href="/"
              onClick={(e) => { e.preventDefault(); onSchedule(); }}
            >
              New Orleans Arts &amp; Ideas Festival
            </a>
          </h1>
          <div className="subtitle">
            November 11&ndash;13, 2026 &bull;{' '}
            <a href="https://louisianastatemuseum.org/museum/new-orleans-jazz-museum-old-us-mint" target="_blank" rel="noopener">
              Historic New Orleans Jazz Museum
            </a>
          </div>
        </div>
        <div className="header-actions">
          {current !== 'register' && (
            <a className="btn-primary" href="/register/">
              Register
            </a>
          )}
          <SiteMenu onSchedule={onSchedule} onAbout={onAbout} onSponsor={onSponsor} current={current} />
        </div>
      </div>
    </header>
  );
}
