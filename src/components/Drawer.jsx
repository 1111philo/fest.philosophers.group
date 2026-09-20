import { useEffect, useRef, useState } from 'react';

// Presentations (and logistics-only schedule items) open here instead of a
// blocking modal, so the schedule stays interactive behind it on desktop.
// This deliberately isn't React Aria's ModalOverlay: that component always
// hides/inertifies the rest of the page while open (that's what "modal"
// means), which is exactly what a non-blocking side panel can't do. It's a
// plain positioned panel instead, with just enough of its own logic
// (Escape-to-close, a mount/unmount transition, swipe-to-dismiss on mobile)
// to stay pleasant to use.
export default function Drawer({ isOpen, onClose, ariaLabel, children }) {
  const [rendered, setRendered] = useState(isOpen);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      setRendered(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    // React Aria's ModalOverlay moves focus in and restores it on close
    // for free; this hand-rolled panel needs the same done by hand.
    previouslyFocusedRef.current?.focus?.();
    previouslyFocusedRef.current = null;
    const timeout = setTimeout(() => setRendered(false), 240); // matches the CSS transition duration
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (rendered) panelRef.current?.focus();
  }, [rendered]);

  useEffect(() => {
    if (!rendered) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [rendered, onClose]);

  // On mobile the drawer is a bottom sheet, so a downward drag can dismiss
  // it like a native one. Desktop's is a side panel (see the CSS breakpoint
  // below), where a vertical drag wouldn't make sense, so this only engages
  // under that same breakpoint. It only starts once the panel's own content
  // is scrolled to the top, so it doesn't fight normal scrolling of long
  // presentation text. Attached via a ref (not onTouchMove props) because
  // dismissing an in-progress native scroll/refresh gesture requires a
  // non-passive listener, which React's JSX touch handlers don't give you.
  useEffect(() => {
    const panel = panelRef.current;
    if (!rendered || !panel) return undefined;

    function onTouchStart(e) {
      if (window.innerWidth >= 768) return;
      if (panel.scrollTop > 0) return;
      dragRef.current = { startY: e.touches[0].clientY, dy: 0, startTime: Date.now() };
    }
    function onTouchMove(e) {
      if (!dragRef.current) return;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      if (dy <= 0) {
        dragRef.current.dy = 0;
        panel.style.transform = '';
        return;
      }
      dragRef.current.dy = dy;
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${dy}px)`;
      e.preventDefault();
    }
    function onTouchEnd() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      panel.style.transition = '';
      panel.style.transform = '';
      const velocity = drag.dy / Math.max(Date.now() - drag.startTime, 1);
      if (drag.dy > 100 || velocity > 0.5) onClose();
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd);
    panel.addEventListener('touchcancel', onTouchEnd);
    return () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [rendered, onClose]);

  if (!rendered) return null;
  return (
    <div
      className="drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className={`drawer${entered ? '' : ' drawer-hidden'}`} role="dialog" aria-label={ariaLabel} tabIndex={-1}>
        <div className="drawer-handle" aria-hidden="true" />
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">&times;</button>
        {children}
      </div>
    </div>
  );
}
