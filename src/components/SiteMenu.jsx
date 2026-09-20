import { MenuTrigger, Button, Popover, Menu, MenuItem } from 'react-aria-components';

// `current` (the page this menu is being rendered on - 'schedule' | 'about'
// | 'sponsor' | 'register' | null) marks the matching item with
// aria-current="page" plus a visual highlight, so it's clear you're already
// there instead of the item just silently doing nothing when clicked again.
function PageLabel({ id, current, children }) {
  return (
    <>
      <span className="check" aria-hidden="true">{current === id ? '✓' : ''}</span>
      {children}
    </>
  );
}

export default function SiteMenu({ onSchedule, onAbout, onSponsor, current }) {
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
            else if (key === 'about') onAbout();
            else if (key === 'sponsor') onSponsor();
          }}
        >
          <MenuItem id="schedule" className="site-menu-item" ref={currentRef('schedule')}>
            <PageLabel id="schedule" current={current}>Schedule</PageLabel>
          </MenuItem>
          <MenuItem id="about" className="site-menu-item" ref={currentRef('about')}>
            <PageLabel id="about" current={current}>About</PageLabel>
          </MenuItem>
          <MenuItem id="sponsor" className="site-menu-item" ref={currentRef('sponsor')}>
            <PageLabel id="sponsor" current={current}>Sponsor</PageLabel>
          </MenuItem>
          <MenuItem
            className="site-menu-item"
            href="https://buy.stripe.com/9B6cN4dvP13b6d97BQ7Zu06"
            target="_blank"
            rel="noopener"
          >
            Donate
          </MenuItem>
          <MenuItem
            className="site-menu-item"
            href="https://newsletter.decubing.com/h/r/BF66EBE957B128A22540EF23F30FEDED"
            target="_blank"
            rel="noopener"
          >
            Newsletter
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
