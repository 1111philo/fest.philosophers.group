import SiteMenu from './SiteMenu';
import NoaiLogo from './NoaiLogo';

// Shared across every page - the schedule SPA passes its own onSchedule
// to reset in-app state instead of reloading; every other page (including
// standalone Astro islands, which can't receive function props at all)
// mounts this with no props, so the default below does a real navigation
// instead. `current` marks whichever page is already showing, in both the
// Register button and the hamburger menu, so it's clear you're already
// there. `titleIsHeading` is turned off on pages that have their own
// <h1> (every PageLayout page), so screen readers find exactly one
// top-level heading - the page's own title, not the site name again.
export default function SiteHeader({
  onSchedule = () => { window.location.href = '/'; },
  current,
  titleIsHeading = true,
}) {
  const TitleTag = titleIsHeading ? 'h1' : 'p';
  return (
    <header className="header">
      <div className="header-top">
        <div className="header-brand">
          {/* The logo repeats the title link right next to it, so it's
              hidden from the accessibility tree and tab order instead of
              announcing the same destination twice. */}
          <a
            className="header-logo-link"
            href="/"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => { e.preventDefault(); onSchedule(); }}
          >
            <NoaiLogo className="header-logo" title="" />
          </a>
          <div className="header-text">
            <TitleTag className="header-title">
              <a
                className="header-title-link"
                href="/"
                onClick={(e) => { e.preventDefault(); onSchedule(); }}
              >
                {/* The logo beside it is aria-hidden, so its name is
                    spoken here instead. */}
                <span className="sr-only">NOAI: </span>An Arts &amp; Ideas Festival
              </a>
            </TitleTag>
            <div className="subtitle">
              November 11&ndash;13, 2026 <span className="subtitle-dot" aria-hidden="true">&bull;</span>{' '}
              <a href="https://nolajazzmuseum.org/" target="_blank" rel="noopener">
                Jazz Museum<span className="sr-only"> (opens in a new window)</span>
              </a>, New Orleans
            </div>
          </div>
        </div>
        <div className="header-actions">
          {current !== 'register' && (
            <a className="btn-primary" href="/register/">
              Register
            </a>
          )}
          <SiteMenu onSchedule={onSchedule} current={current} />
        </div>
      </div>
    </header>
  );
}
