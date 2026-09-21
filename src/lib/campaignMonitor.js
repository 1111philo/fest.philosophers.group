import { CM_FORM_DATA_ID, CM_FIELDS } from './registrationConfig';

const SCRIPT_SRC = 'https://js.createsend1.com/javascript/copypastesubscribeformlogic.js';

// Loads Campaign Monitor's own "copy and paste form" script once per page -
// it attaches a single delegated `submit` listener on <html> the first time
// it runs (see its own `data-cm-hook` guard), so later calls are no-ops.
// Same script github.com/1111philo/ai-leaders loads for its own signup form.
export function loadCampaignMonitorScript() {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.src = SCRIPT_SRC;
  script.async = true;
  document.body.appendChild(script);
}

// Submits a registrant to the Campaign Monitor list, invisibly, without
// leaving the registration page - the real work (an XHR for a one-time
// secure link, then a real form post to it) happens inside a hidden
// iframe, driven by Campaign Monitor's own script, so it isn't affected by
// this page redirecting to Stripe immediately afterward.
//
// The script only intercepts *real* submit events - calling form.submit()
// directly skips the 'submit' event entirely (a DOM quirk), so this
// dispatches one instead of calling submit().
export function submitToCampaignMonitor(values) {
  const iframeName = `cm-target-${Date.now()}`;
  const iframe = document.createElement('iframe');
  iframe.name = iframeName;
  iframe.style.display = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const form = document.createElement('form');
  form.action = 'https://www.createsend.com/t/subscribeerror?description=';
  form.method = 'post';
  form.className = 'js-cm-form';
  form.target = iframeName;
  form.setAttribute('data-id', CM_FORM_DATA_ID);
  form.style.display = 'none';

  function addField(name, value) {
    if (!name) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value == null ? '' : String(value);
    if (name === CM_FIELDS.email) input.className = 'js-cm-email-input';
    form.appendChild(input);
  }

  addField(CM_FIELDS.name, values.name);
  addField(CM_FIELDS.email, values.email);
  addField(CM_FIELDS.organization, values.organization);
  addField(CM_FIELDS.jobTitle, values.jobTitle);
  addField(CM_FIELDS.volunteerAnswer, values.volunteerAnswer);
  addField(CM_FIELDS.volunteerShifts, values.volunteerShifts);
  addField(CM_FIELDS.daysAttending, values.daysAttending);
  addField(CM_FIELDS.accessibilityNotes, values.accessibilityNotes);
  addField(CM_FIELDS.workshops, values.workshops);

  document.body.appendChild(form);
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  setTimeout(() => {
    form.remove();
    iframe.remove();
  }, 8000);
}
