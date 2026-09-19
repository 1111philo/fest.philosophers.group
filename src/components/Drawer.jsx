import { useEffect, useState } from 'react';

// Presentations (and logistics-only schedule items) open here instead of a
// blocking modal, so the schedule stays interactive behind it on desktop.
// This deliberately isn't React Aria's ModalOverlay: that component always
// hides/inertifies the rest of the page while open (that's what "modal"
// means), which is exactly what a non-blocking side panel can't do. It's a
// plain positioned panel instead, with just enough of its own logic
// (Escape-to-close, a mount/unmount transition) to stay pleasant to use.
export default function Drawer({ isOpen, onClose, ariaLabel, children }) {
  const [rendered, setRendered] = useState(isOpen);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const timeout = setTimeout(() => setRendered(false), 240); // matches the CSS transition duration
    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!rendered) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [rendered, onClose]);

  if (!rendered) return null;
  return (
    <div
      className="drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`drawer${entered ? '' : ' drawer-hidden'}`} role="dialog" aria-label={ariaLabel}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">&times;</button>
        {children}
      </div>
    </div>
  );
}
