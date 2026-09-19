import { MenuTrigger, Button, Popover, Menu, MenuItem } from 'react-aria-components';

export default function SiteMenu({ onSchedule, onAbout, onSponsor }) {
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
          <MenuItem id="schedule" className="site-menu-item">Schedule</MenuItem>
          <MenuItem id="about" className="site-menu-item">About</MenuItem>
          <MenuItem id="sponsor" className="site-menu-item">Sponsor</MenuItem>
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
