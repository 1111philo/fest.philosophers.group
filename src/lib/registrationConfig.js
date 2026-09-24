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
  // Comma-separated chosen workshop titles.
  workshops: 'cm-f-dkiujllj',
};

// Cloudflare Worker that creates a Stripe Checkout Session server-side -
// unlike a Payment Link, this lets us preset exact line-item quantities
// (registrations + only-as-many-extra-workshops-as-selected) and attach
// the chosen workshop names as real Stripe metadata, neither of which a
// Payment Link's URL parameters can do (confirmed against Stripe's own
// docs - prefilled_amount is pay-what-you-want only). See
// cloudflare-worker/ for the function's source.
export const CHECKOUT_ENDPOINT = 'https://fest-registration.philosophers-group.workers.dev/create-checkout';

export const TICKET_PRICE = 55;
export const WORKSHOP_PRICE = 25;
// Flat, not a percentage - see the Worker's VOLUNTEER_PROMO_ID comment for
// why (a percent-off coupon would scale with registrationQty).
export const VOLUNTEER_DISCOUNT = 55;

export const DONATION_SUGGESTIONS = [11, 33, 111, 1111];

// Every 2026 workshop (type: "Workshop" rows in content.json's schedule) -
// kept as static config here, same as DAYS below, rather than fetched at
// runtime, since RegistrationForm doesn't otherwise need content.json.
export const WORKSHOPS = [
  { id: 'tai-chi-basics', title: 'Tai Chi Basics', leader: 'Blake Bertuccelli-Booth', day: 'Thu', time: '9:30 AM' },
  { id: 'letterpress-workshop', title: 'Analog Intelligence Since 1440: A Hands-On Letterpress Workshop', leader: 'Joseph Makkos', day: 'Thu', time: '10:30 AM' },
  { id: 'why-machines-cannot-crochet', title: 'Why Machines Cannot Crochet', leader: 'Julia Feliciano', day: 'Thu', time: '1:00 PM' },
  { id: 'offline-voice-ai-chat-bot', title: 'Age of AI Meets Pre-Internet Times: How to Build an Offline Voice AI Chat Bot', leader: 'Vanessa Pyne', day: 'Thu', time: '2:15 PM' },
  { id: 'e-bike-conversion-speedrun', title: 'E-Bike Conversion Speedrun', leader: 'Matt Candler', day: 'Thu', time: '3:45 PM' },
  { id: 'intro-to-clown', title: 'Intro to Clown', leader: 'Grace Bertuccelli-Booth', day: 'Thu', time: '5:00 PM' },
  { id: 'small-language-models', title: 'Small Language Models', leader: 'Sabelo Jupiter', day: 'Fri', time: '9:30 AM' },
  { id: 'local-agents-crash-course', title: 'Free and Private Agentic AI: Local Agents Crash Course', leader: 'Legare Kerrison', day: 'Fri', time: '10:45 AM' },
  { id: 'device-free-writing-lab', title: 'The Intentional Page: A Device-Free Writing Lab with S.I.L.K.', leader: 'Marcus Rosser + Kaylon Seaberry', day: 'Fri', time: '1:00 PM' },
  { id: 'screening-ai-use-cases', title: 'The Most Valuable AI Skill Is Saying No: Screening AI Use Cases for Real Return', leader: 'Dustin T. Hughes', day: 'Fri', time: '2:30 PM' },
  { id: 'redesigning-assessment', title: 'Explain It: Redesigning Assessment for the AI Classroom', leader: 'Dr. Blaine Fisher', day: 'Fri', time: '3:45 PM' },
];

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
