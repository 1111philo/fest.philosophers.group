import { MenuTrigger, Button, Popover, Menu, MenuItem } from 'react-aria-components';

// The audience filter, as a dropdown beside the search box (matching the
// year menu) rather than a row of toggles, so it doesn't crowd the sticky
// toolbar. Multi-select: items are menuitemcheckbox with aria-checked, and
// the menu stays open while you tick several. The button shows a count,
// and its accessible name says what it does and how many are chosen.
export default function AudienceMenu({ audiences, options, onChange }) {
  const n = audiences.length;
  return (
    <MenuTrigger>
      <Button
        className={`filter-toggle${n ? ' is-active' : ''}`}
        aria-label={`Filter by audience${n ? `, ${n} selected` : ''}`}
      >
        <svg className="filter-icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M3 6h18M7 12h10M10 18h4" />
        </svg>
        <span>Filter</span>
        {n > 0 && <span className="filter-count" aria-hidden="true">{n}</span>}
      </Button>
      <Popover placement="bottom end" offset={6} className="menu-popover">
        <Menu
          className="year-menu"
          aria-label="Filter by audience"
          selectionMode="multiple"
          selectedKeys={new Set(audiences)}
          onSelectionChange={(keys) => onChange(options.map(([id]) => id).filter((id) => keys.has(id)))}
        >
          {options.map(([id, label]) => (
            <MenuItem key={id} id={id} className="year-option aud-option" textValue={`For ${label}`}>
              {({ isSelected }) => (
                <>
                  <span className="check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                  <span className={`aud-mark aud-${id}`} aria-hidden="true" />
                  <span>For {label}</span>
                </>
              )}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
