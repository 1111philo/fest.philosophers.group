import { useEffect, useState } from 'react';
import {
  Form, TextField, Label, Input, Text, FieldError,
  RadioGroup, Radio, CheckboxGroup, Checkbox, Button,
} from 'react-aria-components';
import { DAYS, VOLUNTEER_SHIFTS, STRIPE_PAYMENT_LINK_URL, VOLUNTEER_PROMO_CODE } from '../lib/registrationConfig';
import { loadCampaignMonitorScript, submitToCampaignMonitor } from '../lib/campaignMonitor';

const VOLUNTEER_LABELS = {
  no: 'No thanks.',
  yes_no_discount: "Yes! I will volunteer and don't need a discount.",
  yes_discount: 'Yes! I will volunteer and receive a discount.',
};

function buildStripeUrl({ email, wantsVolunteerDiscount, donationAmount }) {
  const url = new URL(STRIPE_PAYMENT_LINK_URL);
  if (email) {
    url.searchParams.set('prefilled_email', email);
    url.searchParams.set('client_reference_id', email.slice(0, 200));
  }
  if (wantsVolunteerDiscount) url.searchParams.set('prefilled_promo_code', VOLUNTEER_PROMO_CODE);
  if (donationAmount > 0) url.searchParams.set('prefilled_amount', String(Math.round(donationAmount * 100)));
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
  const [wantsDonation, setWantsDonation] = useState(null);
  const [donationAmount, setDonationAmount] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCampaignMonitorScript();
  }, []);

  const showShifts = volunteer === 'yes_no_discount' || volunteer === 'yes_discount';

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
    if (!wantsDonation) {
      setSubmitError('Please answer the donation question.');
      return;
    }
    const donation = wantsDonation === 'yes' ? Number(donationAmount) : 0;
    if (wantsDonation === 'yes' && !(donation > 0)) {
      setSubmitError('Please enter a donation amount, or choose "No thanks" above.');
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
      wantsVolunteerDiscount: volunteer === 'yes_discount',
      donationAmount: donation,
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
            Volunteers receive 100% discount for helping during a 4-hour shift. Organizers contact volunteers about two weeks before NOAI.
          </Text>
          <Radio className="radio-option" value="no">{VOLUNTEER_LABELS.no}</Radio>
          <Radio className="radio-option" value="yes_no_discount">{VOLUNTEER_LABELS.yes_no_discount}</Radio>
          <Radio className="radio-option" value="yes_discount">{VOLUNTEER_LABELS.yes_discount}</Radio>
          <FieldError className="field-error" />
        </RadioGroup>

        {showShifts && (
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
        <h2>Support NOAI</h2>
        <RadioGroup
          className="radio-group"
          value={wantsDonation}
          onChange={setWantsDonation}
          isRequired
        >
          <Label>Would you like to add a donation?</Label>
          <Text slot="description" className="field-hint">
            We&rsquo;re a volunteer run organization. Help us sustain our programming!
          </Text>
          <Radio className="radio-option" value="yes">Yes!</Radio>
          <Radio className="radio-option" value="no">No thanks.</Radio>
          <FieldError className="field-error" />
        </RadioGroup>

        {wantsDonation === 'yes' && (
          <Field
            label="Donation amount (USD)"
            type="number"
            inputMode="decimal"
            minValue={1}
            value={donationAmount}
            onChange={setDonationAmount}
          />
        )}
      </section>

      {submitError && <p className="reg-error" role="alert">{submitError}</p>}

      <p className="reg-note">
        Ticket ($55, includes all days and one workshop), extra workshops ($25 each), and your donation
        amount are finalized on the next page with Stripe, where you can also enter a discount code
        (speakers, staff, and students - ask the organizers if you&rsquo;re not sure which applies to you).
      </p>

      <Button type="submit" className="btn-primary reg-submit" isDisabled={submitting}>
        {submitting ? 'Continuing to payment…' : 'Continue to Payment'}
      </Button>
    </Form>
  );
}
