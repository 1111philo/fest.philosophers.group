import { useEffect, useState } from 'react';
import {
  ModalOverlay, Modal, Dialog, Heading, Button,
  Form, TextField, Label, Input, FieldError,
} from 'react-aria-components';
import { loadCampaignMonitorScript, submitToCampaignMonitor } from '../lib/campaignMonitor';

const DONATE_URL = 'https://buy.stripe.com/9B6cN4dvP13b6d97BQ7Zu06';
const SLACK_INVITE_URL = 'https://join.slack.com/t/1111philo/shared_invite/zt-2gmnevnx3-qR6119iBjUFxS4BgP8wXzA';
const SHOWN_KEY = 'noai-engage-popup-shown';
const SHOW_DELAY_MS = 4000;

// A once-per-session nudge toward the three ways to support NOAI outside
// of just attending: donating, the Slack, and the newsletter. Unlike
// Drawer (see its own comment), this one is a real ModalOverlay - it's
// asking for something, not showing more detail on what's already on
// screen, so blocking the page and trapping focus until it's dismissed
// is the right call here.
export default function EngagePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let alreadyShown = true;
    try {
      alreadyShown = !!sessionStorage.getItem(SHOWN_KEY);
    } catch (e) {
      alreadyShown = false; // storage blocked - show once anyway
    }
    if (alreadyShown) return undefined;
    const timer = setTimeout(() => setIsOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    setIsOpen(false);
    try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch (e) { /* storage blocked - may reshow */ }
  }

  function onSubscribe(e) {
    e.preventDefault();
    if (!email) return;
    loadCampaignMonitorScript();
    submitToCampaignMonitor({ email });
    setSubscribed(true);
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) dismiss(); }}
      isDismissable
      className="engage-overlay"
    >
      <Modal className="engage-modal">
        <Dialog className="engage-dialog">
          <Button className="modal-close" aria-label="Close" onPress={dismiss}>&times;</Button>
          <div className="engage-squiggle" aria-hidden="true" />
          <Heading slot="title" className="engage-title">Help keep NOAI going</Heading>
          <p className="engage-body">
            NOAI runs on donations, volunteers, and a community that keeps talking all year. Pick one:
          </p>
          <div className="engage-actions">
            <a
              className="engage-action engage-action-red"
              href={DONATE_URL}
              target="_blank"
              rel="noopener"
              onClick={dismiss}
            >
              <span className="engage-action-title">Donate</span>
              <span className="engage-action-sub">
                Support the festival<span className="sr-only"> (opens in a new window)</span>
              </span>
            </a>
            <a
              className="engage-action engage-action-teal"
              href={SLACK_INVITE_URL}
              target="_blank"
              rel="noopener"
              onClick={dismiss}
            >
              <span className="engage-action-title">Join our Slack</span>
              <span className="engage-action-sub">
                Talk with the community<span className="sr-only"> (opens in a new window)</span>
              </span>
            </a>
          </div>
          {subscribed ? (
            <p className="engage-success">You're on the list — thanks for joining!</p>
          ) : (
            <Form className="engage-newsletter" onSubmit={onSubscribe}>
              <TextField
                className="field engage-field"
                type="email"
                value={email}
                onChange={setEmail}
                isRequired
              >
                <Label>Join our newsletter</Label>
                <Input placeholder="you@example.com" />
                <FieldError className="field-error" />
              </TextField>
              <Button type="submit" className="btn-primary engage-subscribe-btn">Subscribe</Button>
            </Form>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
