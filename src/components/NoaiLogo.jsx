// The festival logotype - blue N, ringed red O, yellow A and I, laced
// through with the poster's black squiggles. Colors come from CSS classes
// (not presentation attributes) so the ink strokes and the O's cream
// center follow the page's light/dark theme instead of being baked in.
export default function NoaiLogo({ className, title = 'NOAI' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 548"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <g fill="none" className="logo-ink" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
        <path className="logo-yellow" stroke="none" d="M1100 20h74v476.5h-74z" />
        <path d="M1058 414.3q14-21.4 28 0t28 0t28 0M456 112q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 4.8 4 3.8 4 2.1 4 0 4 -2.1 4 -3.8" />
        <path className="logo-blue" stroke="none" d="M50 30.5h89.2L274 318.5v-288h88V490h-88L139.1 202v288H50z" />
        <path className="logo-yellow" stroke="none" fillRule="evenodd" d="M834.7 20h113.5L1090 496.5h-96.4l-31.8-107.8H820l-34 107.8H681.6zm53.4 104.4 45.3 192.9H840.4z" />
        <path d="M22 110q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 4.8 4 3.8 4 2.1M1000 110q14-21.4 28 0t28 0t28 0l4 4.8 4 3.8 4 2.1 4 0M22 185q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 4.8 4 3.8 4 2.1 4 0 4 -2.1 4 -3.8M450 185q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 -4.8M1025 185q14-21.4 28 0t28 0l4 -4.8 4 -3.8 4 -2.1 4 0 4 2.1M22 265q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 4.8M650 265q14-21.4 28 0t28 0t28 0l4 4.8 4 3.8 4 2.1 4 0 4 -2.1 4 -3.8M22 345q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 -4.8 4 -3.8 4 -2.1 4 0 4 2.1M1065 345q14-21.4 28 0t28 0t28 0l4 4.8 4 3.8 4 2.1 4 0 4 -2.1 4 -3.8M22 425q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 -4.8 4 -3.8 4 -2.1 4 0 4 2.1M675 425q14-21.4 28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0t28 0l4 4.8 4 3.8M652,352c6.84-7.7,14.14-16.89,24-20.8,10.69-4.24,20.73,1.96,29.3,7.91s17.97,13.47,29.03,11.28c10.58-2.09,18.54-11.68,25.41-19.31,7.03-7.8,13.84-16.48,23.13-21.7,10.08-5.67,20.16-1.91,29.13,4.02,8.44,5.58,17.39,14.02,28.14,14.09,11.18.07,19.96-9.22,26.96-16.82s13.43-16.25,21.94-22.27c10.12-7.15,20.03-6.33,30.34.02,2.01,1.24,4.01,2.5,5.92,3.88" />
        <path strokeWidth="15.5" d="M1034.45,266.76c8.13,3.27,14.5,10.01,22.41,13.85,8.08,3.93,16.99,4.99,25.14.59" />
      </g>
      <circle className="logo-paper logo-teal-ring" cx="530" cy="355" r="130" strokeWidth="26" />
      <circle className="logo-red" cx="530" cy="355" r="98" />
    </svg>
  );
}
