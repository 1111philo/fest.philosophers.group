// A slim promo strip for Hôtel 11:11 (coppola.philosophers.group) -
// Francis Ford Coppola's own New Orleans house, run as a limited,
// festival-dates-only retreat. It sits on the page's own background in
// both themes, with a squiggle rule beneath it to set it apart from the
// search/filter toolbar below.
export default function HotelBanner() {
  return (
    <a className="hotel-banner" href="https://coppola.philosophers.group/" target="_blank" rel="noopener">
      <span className="hotel-banner-inner">
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
          <span className="hotel-banner-title">H&ocirc;tel 11:11 Available</span>
          <span className="hotel-banner-sub">Francis Ford Coppola&rsquo;s retreat &middot; Nov 10&ndash;15 &middot; Limited Edition</span>
        </span>
        <span className="hotel-banner-cta">
          View rooms <span aria-hidden="true">&rarr;</span><span className="sr-only"> (opens in a new window)</span>
        </span>
      </span>
      <span className="hotel-banner-rule" aria-hidden="true"><span className="squiggle" /></span>
    </a>
  );
}
