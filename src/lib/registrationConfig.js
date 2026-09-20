// Campaign Monitor's "copy and paste" subscribe form mechanism (same one
// used by github.com/1111philo/ai-leaders): the `data-id` and each field's
// `cm-*` name are public tokens generated in the list's dashboard, not
// secrets - safe to ship in client code. See RegistrationForm.jsx for how
// they're submitted (a hidden-iframe form post, so it happens invisibly
// alongside the redirect to Stripe).
export const CM_FORM_DATA_ID = '5B5E7037DA78A748374AD499497E309ED0EAAC29577C1884421F30179B35EBB008E95F73F68235B0A0D711AB0759486EE121408FBE59335AA6A2041E7A27960B';
export const CM_FIELDS = {
  name: 'cm-name',
  email: 'cm-bkutrku-bkutrku',
  organization: 'cm-f-dkiuydkk',
  jobTitle: 'cm-f-dkiuydku',
  volunteerAnswer: 'cm-f-dkiuydul',
  volunteerShifts: 'cm-f-dkiuydur',
  daysAttending: 'cm-f-dkiuyduy',
  accessibilityNotes: 'cm-f-dkiuyduj',
};

// Created by `node scripts/setup-stripe.mjs` (run once, locally, with a
// secret key that's never committed) - see that script for what it made.
export const STRIPE_PAYMENT_LINK_URL = 'https://buy.stripe.com/14AaEW1N75jr30X5tI7Zu0e';

// Prefilled via the Payment Link's `prefilled_promo_code` URL parameter
// when someone picks "volunteer and receive a discount" - see
// scripts/setup-stripe.mjs for where this code is created (100% off the
// ticket only, not workshops/donations). Speaker/staff/student codes
// aren't wired up the same way: those are typed directly into Stripe's own
// native "Add promotion code" field on the checkout page, same as the
// original site's plain "Coupon" input.
export const VOLUNTEER_PROMO_CODE = 'volunteer';

export const DAYS = [
  { value: '11/11', label: 'Wed, Nov 11' },
  { value: '11/12', label: 'Thu, Nov 12' },
  { value: '11/13', label: 'Fri, Nov 13' },
];

const SHIFT_TIMES = [
  { key: 'am', label: 'Morning (9AM–1PM)' },
  { key: 'pm', label: 'Afternoon (1PM–5PM)' },
  { key: 'eve', label: 'Evening (5PM–9PM)' },
];
export const VOLUNTEER_SHIFTS = DAYS.flatMap((day) => (
  SHIFT_TIMES.map((shift) => ({
    value: `${day.value} ${shift.key}`,
    label: `${day.label}, ${shift.label}`,
  }))
));
