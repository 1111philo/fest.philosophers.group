import { MenuTrigger, Button, Popover, Menu, MenuItem } from 'react-aria-components';
import { eventWindow, buildCalendarLinks, downloadIcs, VENUE_ADDRESS } from '../lib/calendar';

function slugForFilename(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
}

// `item` is any schedule-row-shaped object (date/sort_time/raw_time_range/
// title/location) - both a real schedule row and the synthesized one built
// for older-year presentations (see eventInfoForPresentation) fit this.
export default function AddToCalendarMenu({ item, description }) {
  const { start, end } = eventWindow(item);
  const location = item.location ? `${item.location}, ${VENUE_ADDRESS}` : VENUE_ADDRESS;
  const links = buildCalendarLinks({ title: item.title, description, location, start, end });

  return (
    <MenuTrigger>
      <Button className="add-to-calendar-btn">
        <span aria-hidden="true">📅</span> Add to Calendar
      </Button>
      <Popover placement="bottom start" offset={6} className="menu-popover">
        <Menu
          className="site-menu"
          onAction={(key) => {
            if (key === 'ics') downloadIcs(`${slugForFilename(item.title)}.ics`, links.ics);
          }}
        >
          <MenuItem id="google" className="site-menu-item" href={links.google} target="_blank" rel="noopener">
            Google Calendar
          </MenuItem>
          <MenuItem id="yahoo" className="site-menu-item" href={links.yahoo} target="_blank" rel="noopener">
            Yahoo Calendar
          </MenuItem>
          <MenuItem id="ics" className="site-menu-item">
            Apple/Outlook Calendar (.ics)
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
