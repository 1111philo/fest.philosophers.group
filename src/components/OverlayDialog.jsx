import { ModalOverlay, Modal, Dialog, Button } from 'react-aria-components';

// Shared shell for both the About/Sponsor modal and the presentation
// drawer - a controlled React Aria dialog, so focus-trapping, Escape-to-
// close, and (when isDismissable) outside-click-to-close all come from the
// library instead of hand-rolled state/listeners.
export default function OverlayDialog({
  isOpen, onOpenChange, isDismissable = true, overlayClassName, modalClassName, ariaLabel, children,
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      className={overlayClassName}
    >
      <Modal className={modalClassName}>
        <Dialog aria-label={ariaLabel}>
          {({ close }) => (
            <>
              <Button className="modal-close" onPress={close} aria-label="Close">&times;</Button>
              {children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
