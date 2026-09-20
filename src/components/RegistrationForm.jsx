import { useEffect, useState } from 'react';
import {
  Form, TextField, Label, Input, Text, FieldError,
  RadioGroup, Radio, CheckboxGroup, Checkbox, Button,
} from 'react-aria-components';
import { DAYS, VOLUNTEER_SHIFTS, STRIPE_PAYMENT_LINK_URL, VOLUNTEER_PROMO_CODE } from '../lib/registrationConfig';
import { loadCampaignMonitorScript, submitToCampaignMonitor } from '../lib/campaignMonitor';

const VOLUNTEER_LABELS = {
  no: 'No thanks.',
  yes: 'Yes, I will volunteer.',
};

function buildStripeUrl({ email, isVolunteer }) {
  const url = new URL(STRIPE_PAYMENT_LINK_URL);
  if (email) {
    url.searchParams.set('prefilled_email', email);
    url.searchParams.set('client_reference_id', email.slice(0, 200));
  }
  if (isVolunteer) url.searchParams.set('prefilled_promo_code', VOLUNTEER_PROMO_CODE);
  return url.toString();
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
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCampaignMonitorScript();
  }, []);

  const showShifts = volunteer === 'yes';

  function onSubmit(e) {
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
    });

    window.location.href = buildStripeUrl({
      email,
      isVolunteer: volunteer === 'yes',
    });
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
              Add code <strong>volunteer</strong> at checkout for a free ticket.
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

      {submitError && <p className="reg-error" role="alert">{submitError}</p>}

      <p className="reg-note">
        Tickets, workshops, donations, and discount codes are all set on the next page with Stripe.
      </p>

      <Button type="submit" className="btn-primary reg-submit" isDisabled={submitting}>
        {submitting ? 'Continuing to payment…' : 'Continue to Payment'}
      </Button>
    </Form>
  );
}
