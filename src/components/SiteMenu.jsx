import { MenuTrigger, Button, Popover, Menu, MenuItem } from 'react-aria-components';

// Small external-link glyph plus screen-reader-only text, for menu items
// that leave the site in a new tab (Donate, Newsletter) - so it's
// announced instead of silently opening a second tab.
function ExternalLinkHint() {
  return (
    <>
      <svg className="external-icon" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      <span className="sr-only"> (opens in a new window)</span>
    </>
  );
}

export default function SiteMenu({ onSchedule, current }) {
  // MenuItem strips aria-current from props before it reaches the DOM -
  // react-aria's filterDOMProps only lets a fixed allowlist of aria-*
  // attributes through (label/labelledby/describedby/details), regardless
  // of link vs. action items - so it's set by hand via a ref instead. The
  // visible checkmark still comes through the normal render path.
  function currentRef(id) {
    return (el) => {
      if (!el) return;
      if (current === id) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    };
  }
  return (
    <MenuTrigger>
      <Button aria-label="Menu" className="hamburger-btn">
        <span className="hamburger-icon" />
      </Button>
      <Popover placement="bottom end" offset={6} className="menu-popover">
        <Menu
          className="site-menu"
          onAction={(key) => {
            if (key === 'schedule') onSchedule();
          }}
        >
          <MenuItem id="schedule" className="site-menu-item" ref={currentRef('schedule')}>
            Schedule
          </MenuItem>
          <MenuItem id="about" className="site-menu-item" href="/about/" ref={currentRef('about')}>
            About
          </MenuItem>
          <MenuItem id="sponsor" className="site-menu-item" href="/sponsor/" ref={currentRef('sponsor')}>
            Sponsor
          </MenuItem>
          <MenuItem
            className="site-menu-item"
            href="https://buy.stripe.com/9B6cN4dvP13b6d97BQ7Zu06"
            target="_blank"
            rel="noopener"
          >
            Donate
            <ExternalLinkHint />
          </MenuItem>
          <MenuItem
            className="site-menu-item"
            href="https://newsletter.decubing.com/h/r/BF66EBE957B128A22540EF23F30FEDED"
            target="_blank"
            rel="noopener"
          >
            Newsletter
            <ExternalLinkHint />
          </MenuItem>
          <MenuItem
            className="site-menu-item"
            href="https://join.slack.com/t/1111philo/shared_invite/zt-2gmnevnx3-qR6119iBjUFxS4BgP8wXzA"
            target="_blank"
            rel="noopener"
          >
            Join our Slack
            <ExternalLinkHint />
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
