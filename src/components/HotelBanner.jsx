// A promotional banner for Hôtel 11:11 (coppola.philosophers.group) -
// Francis Ford Coppola's own New Orleans house, run as a limited,
// festival-dates-only retreat. Lives on the schedule's own site (not that
// one, which has its own period/engraved aesthetic deliberately unlike
// this one) so it gets this site's flat Swiss-poster treatment instead -
// same offset-shadow hover as a .card, same brand colors, same squiggle -
// rather than importing that page's look wholesale.
export default function HotelBanner() {
  return (
    <a className="hotel-banner" href="https://coppola.philosophers.group/" target="_blank" rel="noopener">
      <span className="hotel-banner-portrait">
        <img
          src="/media/hotel-1111-ada-lovelace.jpg"
          alt="Oval portrait of Ada Lovelace, patron saint of the 11:11 Philosophers Group"
          width="292"
          height="394"
          loading="lazy"
        />
      </span>
      <span className="hotel-banner-body">
        <span className="hotel-banner-kicker">Limited NOAI Edition &middot; Nov 10&ndash;15</span>
        <span className="hotel-banner-title">H&ocirc;tel 11:11</span>
        <span className="hotel-banner-tagline">
          Stay <span aria-hidden="true">&bull;</span> Think <span aria-hidden="true">&bull;</span> Act
        </span>
        <span className="hotel-banner-lede">
          Francis Ford Coppola&rsquo;s own French Quarter house, five nights with hosted dinners and VIP festival access.
        </span>
        <span className="hotel-banner-cta">
          View rooms <span aria-hidden="true">&rarr;</span><span className="sr-only"> (opens in a new window)</span>
        </span>
      </span>
    </a>
  );
}
