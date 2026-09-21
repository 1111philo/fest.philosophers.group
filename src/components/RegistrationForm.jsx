import { useEffect, useMemo, useState } from 'react';
import {
  Form, TextField, Label, Input, Text, FieldError,
  RadioGroup, Radio, CheckboxGroup, Checkbox, Button, NumberField, Group,
} from 'react-aria-components';
import {
  DAYS, VOLUNTEER_SHIFTS, WORKSHOPS, TICKET_PRICE, WORKSHOP_PRICE, CHECKOUT_ENDPOINT,
} from '../lib/registrationConfig';
import { loadCampaignMonitorScript, submitToCampaignMonitor } from '../lib/campaignMonitor';

const VOLUNTEER_LABELS = {
  no: 'No thanks.',
  yes: 'Yes, I will volunteer.',
};

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function Field({ label, description, children, ...props }) {
  return (
    <TextField className="field" {...props}>
      <Label>{label}</Label>
      {children || <Input />}
      {description && <Text slot="description" className="field-hint">{description}</Text>}
      <FieldError className="field-error" />
    </TextField>
  );
}

export default function RegistrationForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [volunteer, setVolunteer] = useState(null);
  const [volunteerShifts, setVolunteerShifts] = useState([]);
  const [daysAttending, setDaysAttending] = useState([]);
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [registrationQty, setRegistrationQty] = useState(1);
  const [selectedWorkshops, setSelectedWorkshops] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCampaignMonitorScript();
  }, []);

  const showShifts = volunteer === 'yes';

  const workshopTitles = useMemo(
    () => selectedWorkshops.map((id) => WORKSHOPS.find((w) => w.id === id)?.title).filter(Boolean),
    [selectedWorkshops],
  );
  const extraWorkshopQty = Math.max(workshopTitles.length - registrationQty, 0);
  const total = registrationQty * TICKET_PRICE + extraWorkshopQty * WORKSHOP_PRICE;

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitError('');

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setSubmitError('Email addresses do not match.');
      return;
    }
    if (!volunteer) {
      setSubmitError('Please answer the volunteering question.');
      return;
    }
    if (showShifts && volunteerShifts.length === 0) {
      setSubmitError('Please select at least one shift you can volunteer.');
      return;
    }
    if (daysAttending.length === 0) {
      setSubmitError('Please select at least one day you plan on attending.');
      return;
    }

    setSubmitting(true);
    submitToCampaignMonitor({
      name: `${firstName} ${lastName}`.trim(),
      email,
      organization,
      jobTitle,
      volunteerAnswer: VOLUNTEER_LABELS[volunteer],
      volunteerShifts: volunteerShifts.join(', '),
      daysAttending: daysAttending.join(', '),
      accessibilityNotes,
      workshops: workshopTitles.join(', '),
    });

    try {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          registrationQty,
          workshopTitles,
          isVolunteer: volunteer === 'yes',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error('checkout-failed');
      window.location.href = data.url;
    } catch {
      setSubmitError('Something went wrong starting your payment. Please try again in a moment.');
      setSubmitting(false);
    }
  }

  return (
    <Form className="reg-form" onSubmit={onSubmit}>
      <section className="reg-section">
        <h2>Your information</h2>
        <div className="field-row">
          <Field label="First name" value={firstName} onChange={setFirstName} isRequired />
          <Field label="Last name" value={lastName} onChange={setLastName} isRequired />
        </div>
        <div className="field-row">
          <Field label="Email" type="email" value={email} onChange={setEmail} isRequired />
          <Field label="Confirm email" type="email" value={confirmEmail} onChange={setConfirmEmail} isRequired />
        </div>
        <div className="field-row">
          <Field label="Organization" value={organization} onChange={setOrganization} />
          <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
        </div>
      </section>

      <section className="reg-section">
        <h2>Volunteering</h2>
        <RadioGroup
          className="radio-group"
          value={volunteer}
          onChange={setVolunteer}
          isRequired
        >
          <Label>Would you like to volunteer?</Label>
          <Text slot="description" className="field-hint">
            Volunteering is a 4-hour shift. Organizers contact volunteers about two weeks before the festival.
          </Text>
          <Radio className="radio-option" value="no">{VOLUNTEER_LABELS.no}</Radio>
          <Radio className="radio-option" value="yes">{VOLUNTEER_LABELS.yes}</Radio>
          <FieldError className="field-error" />
        </RadioGroup>

        {showShifts && (
          <>
            <p className="reg-callout">
              Your ticket discount is applied automatically at checkout - no code needed.
            </p>
            <CheckboxGroup
              className="checkbox-group"
              value={volunteerShifts}
              onChange={setVolunteerShifts}
              isRequired
            >
              <Label>What shifts can you volunteer?</Label>
              {VOLUNTEER_SHIFTS.map((shift) => (
                <Checkbox key={shift.value} className="checkbox-option" value={shift.value}>
                  {shift.label}
                </Checkbox>
              ))}
              <FieldError className="field-error" />
            </CheckboxGroup>
          </>
        )}
      </section>

      <section className="reg-section">
        <h2>Attendance</h2>
        <CheckboxGroup
          className="checkbox-group"
          value={daysAttending}
          onChange={setDaysAttending}
          isRequired
        >
          <Label>What days are you planning on attending?</Label>
          {DAYS.map((day) => (
            <Checkbox key={day.value} className="checkbox-option" value={day.value}>
              {day.label}
            </Checkbox>
          ))}
          <FieldError className="field-error" />
        </CheckboxGroup>

        <Field
          label="Accessibility requirements"
          value={accessibilityNotes}
          onChange={setAccessibilityNotes}
        />
      </section>

      <section className="reg-section">
        <h2>Registrations &amp; workshops</h2>
        <NumberField
          className="field"
          value={registrationQty}
          onChange={setRegistrationQty}
          minValue={1}
          maxValue={20}
        >
          <Label>Number of registrations</Label>
          <Group className="number-stepper">
            <Button slot="decrement" aria-label="Decrease">&minus;</Button>
            <Input />
            <Button slot="increment" aria-label="Increase">+</Button>
          </Group>
          <Text slot="description" className="field-hint">
            Buying for a group? Each registration includes one workshop.
          </Text>
        </NumberField>

        <CheckboxGroup
          className="checkbox-group"
          value={selectedWorkshops}
          onChange={setSelectedWorkshops}
        >
          <Label>Which workshops are you interested in?</Label>
          <Text slot="description" className="field-hint">
            Select as many as you like. The first {plural(registrationQty, 'registration')} include{registrationQty === 1 ? 's' : ''} a
            workshop each at no extra cost &mdash; anything past that is ${WORKSHOP_PRICE} per workshop.
          </Text>
          {WORKSHOPS.map((w) => (
            <Checkbox key={w.id} className="checkbox-option workshop-option" value={w.id}>
              <span className="workshop-option-title">{w.title}</span>
              <span className="workshop-option-meta">{w.day} &middot; {w.time}</span>
            </Checkbox>
          ))}
        </CheckboxGroup>

        <div className="reg-total">
          <div className="reg-total-line">
            <span>{plural(registrationQty, 'registration')}</span>
            <span>${registrationQty * TICKET_PRICE}</span>
          </div>
          {extraWorkshopQty > 0 && (
            <div className="reg-total-line">
              <span>{plural(extraWorkshopQty, 'extra workshop')}</span>
              <span>${extraWorkshopQty * WORKSHOP_PRICE}</span>
            </div>
          )}
          <div className="reg-total-line reg-total-sum">
            <span>Total</span>
            <span>${total}</span>
          </div>
        </div>
      </section>

      {submitError && <p className="reg-error" role="alert">{submitError}</p>}

      <p className="reg-note">
        Total shown is before any donation or discount code, which you can add on the next page with
        Stripe.
      </p>

      <Button type="submit" className="btn-primary reg-submit" isDisabled={submitting}>
        {submitting ? 'Continuing to payment…' : 'Continue to Payment'}
      </Button>
    </Form>
  );
}
