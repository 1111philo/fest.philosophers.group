// The festival logotype - blue N, a large ringed red O tucked behind it
// and the yellow A, and the I. Colors come from CSS classes (not presentation
// attributes) so the O's cream center follows the page's light/dark theme
// instead of being baked in. The viewBox is cropped to the letters.
export default function NoaiLogo({ className, title = 'NOAI' }) {
  return (
    <svg
      className={className}
      viewBox="50 20 1124 481"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {/* The O is drawn first so it tucks behind both the N and the A. */}
      <circle className="logo-o logo-paper logo-teal-ring" cx="560" cy="286.5" r="195" strokeWidth="39" />
      <circle className="logo-o logo-red" cx="560" cy="286.5" r="147" />
      <path className="logo-n logo-blue" d="M50 30.5h89.2L274 318.5v-288h88V490h-88L139.1 202v288H50z" />
      <path className="logo-a logo-yellow" fillRule="evenodd" d="M834.7 20h113.5L1090 496.5h-96.4l-31.8-107.8H820l-34 107.8H681.6zm53.4 104.4 45.3 192.9H840.4z" />
      <path className="logo-i logo-yellow" d="M1100 20h74v476.5h-74z" />
    </svg>
  );
}
