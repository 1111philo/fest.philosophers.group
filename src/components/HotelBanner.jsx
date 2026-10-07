// A slim promo strip for Hôtel 11:11 (coppola.philosophers.group) -
// Francis Ford Coppola's own New Orleans house, run as a limited,
// festival-dates-only retreat. One row, not a card - same device as the
// year/search toolbar above it, not a second hero.
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
      <span className="hotel-banner-text">
        <span className="hotel-banner-title">H&ocirc;tel 11:11</span>
        <span className="hotel-banner-sub">Francis Ford Coppola&rsquo;s retreat &middot; Nov 10&ndash;15 &middot; Limited Edition</span>
      </span>
      <span className="hotel-banner-cta">
        View rooms <span aria-hidden="true">&rarr;</span><span className="sr-only"> (opens in a new window)</span>
      </span>
    </a>
  );
}
