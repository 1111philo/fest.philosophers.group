import { MenuTrigger, Button, Popover, Menu, MenuItem } from 'react-aria-components';

// A dropdown rather than tabs, so it fits to the left of the search box;
// defaults to (and shows a check next to) the most recent year. Hidden
// entirely when there's nothing to pick between.
export default function YearMenu({ years, year, onChange }) {
  if (years.length < 2) return null;
  return (
    <MenuTrigger>
      <Button className="year-toggle">
        <span>{year}</span>
        <span className="year-caret" aria-hidden="true">&#9662;</span>
      </Button>
      <Popover placement="bottom start" offset={6} className="menu-popover">
        <Menu
          className="year-menu"
          selectionMode="single"
          selectedKeys={[year]}
          disallowEmptySelection
          onSelectionChange={(keys) => onChange([...keys][0])}
        >
          {years.map((y) => (
            <MenuItem key={y} id={y} className="year-option" textValue={y}>
              {({ isSelected }) => (
                <>
                  <span className="check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                  {y}
                </>
              )}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
