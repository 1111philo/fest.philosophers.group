import { useCallback, useRef } from 'react';
import { ModalOverlay, Modal, Dialog, Button } from 'react-aria-components';

// Shell for the About/Sponsor page modal - a controlled React Aria dialog,
// so focus-trapping, Escape-to-close, and (when isDismissable) outside-
// click-to-close all come from the library instead of hand-rolled state/
// listeners. (The presentation drawer used to share this too, but needed
// a non-blocking background, which ModalOverlay can't do - see Drawer.jsx.)
export default function OverlayDialog({
  isOpen, onOpenChange, isDismissable = true, overlayClassName, modalClassName, ariaLabel, children,
}) {
  const dragRef = useRef(null);
  const cleanupRef = useRef(null);

  // Below 640px this modal is a bottom sheet (see .page-modal-overlay's
  // mobile layout in app.css), so it gets the same downward-drag-to-
  // dismiss the presentation drawer has. React Aria's Modal doesn't offer
  // this itself, so it's wired up by hand via a callback ref, same
  // approach as Drawer.jsx (a non-passive touchmove listener, since only
  // that can stop the browser's own scroll/refresh gesture while dragging).
  const attachSwipeToDismiss = useCallback((node) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!node) return;

    function onTouchStart(e) {
      if (window.innerWidth >= 640) return;
      if (node.scrollTop > 0) return;
      dragRef.current = { startY: e.touches[0].clientY, dy: 0, startTime: Date.now() };
    }
    function onTouchMove(e) {
      if (!dragRef.current) return;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      if (dy <= 0) {
        dragRef.current.dy = 0;
        node.style.transform = '';
        return;
      }
      dragRef.current.dy = dy;
      node.style.transition = 'none';
      node.style.transform = `translateY(${dy}px)`;
      e.preventDefault();
    }
    function onTouchEnd() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      node.style.transition = '';
      node.style.transform = '';
      const velocity = drag.dy / Math.max(Date.now() - drag.startTime, 1);
      if (drag.dy > 100 || velocity > 0.5) onOpenChange(false);
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);
    cleanupRef.current = () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onOpenChange]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={overlayClassName}
    >
      <Modal className={modalClassName} ref={attachSwipeToDismiss}>
        <Dialog aria-label={ariaLabel}>
          {({ close }) => (
            <>
              <div className="drawer-handle" aria-hidden="true" />
              <Button className="modal-close" onPress={close} aria-label="Close">&times;</Button>
              {children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
