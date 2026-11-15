// A slim teaser for the 2026 recap page, in the same toolbar-banner
// language as HotelBanner - the festival just wrapped, so this sits
// above the schedule to point people at the final figures.
export default function RecapBanner() {
  return (
    <a className="hotel-banner" href="/2026-recap/">
      <span className="hotel-banner-inner">
        <span className="hotel-banner-text">
          <span className="hotel-banner-title">NOAI 2026 Recap</span>
          <span className="hotel-banner-sub">Attendance, revenue, and expenses &mdash; the final figures</span>
        </span>
        <span className="hotel-banner-cta">
          View recap <span aria-hidden="true">&rarr;</span>
        </span>
      </span>
      <span className="hotel-banner-rule" aria-hidden="true"><span className="squiggle" /></span>
    </a>
  );
}
