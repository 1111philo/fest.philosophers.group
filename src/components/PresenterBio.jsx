import { useLayoutEffect, useRef, useState } from 'react';

// Long bios truncate to ~3 lines with a fade and a "Read more" button that
// expands in place; short bios that already fit render plainly with no
// button at all, decided by actually measuring after layout.
export default function PresenterBio({ text }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflows(el.scrollHeight - el.clientHeight > 4);
  }, [text]);

  return (
    <>
      <div ref={ref} className={`presenter-bio${!expanded ? ' collapsed' : ''}`}>
        {text}
      </div>
      {overflows && (
        <button
          type="button"
          className="bio-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </>
  );
}
