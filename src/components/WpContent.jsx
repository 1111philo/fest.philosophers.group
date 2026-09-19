import { useEffect, useRef } from 'react';

// Renders WordPress's already-encoded HTML as-is (it's meant to be inserted
// raw, not re-escaped), and rewires any "#presentation/<slug>" links baked
// into that HTML - cross-links between presentations from the original
// site - into in-app navigation instead of a dead same-page anchor.
export default function WpContent({ html, onOpenPresentationSlug, className = 'wp-content' }) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const links = root.querySelectorAll('a[href^="#presentation/"]');
    function handleClick(e, slug) {
      e.preventDefault();
      onOpenPresentationSlug(slug);
    }
    const cleanups = [];
    links.forEach((a) => {
      const slug = a.getAttribute('href').slice('#presentation/'.length);
      const listener = (e) => handleClick(e, slug);
      a.addEventListener('click', listener);
      cleanups.push(() => a.removeEventListener('click', listener));
    });
    return () => cleanups.forEach((fn) => fn());
  }, [html, onOpenPresentationSlug]);

  // eslint-disable-next-line react/no-danger
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html || '' }} />;
}
