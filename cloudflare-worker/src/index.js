// Creates a Stripe Checkout Session with exact preset quantities (a
// Payment Link's URL parameters can't do this - confirmed against
// Stripe's own docs, which list only prefilled_email/prefilled_promo_code/
// prefilled_amount (pay-what-you-want only)/locale/client_reference_id).
// Registered attendees get one workshop each; anything past that is an
// extra-workshop line item. The chosen workshop titles are attached as
// real Stripe metadata (on both the session and the resulting payment
// intent) instead of being crammed into client_reference_id.
//
// Deploy: wrangler secret put STRIPE_SECRET_KEY   (once)
//         wrangler deploy

const ALLOWED_ORIGINS = new Set([
  'https://fest.philosophers.group',
  'http://localhost:4321',
  'http://localhost:4408',
]);

const TICKET_PRICE_ID = 'price_1UHkiYBryIKI7fPqnuFrImGT';
const WORKSHOP_PRICE_ID = 'price_1UHkiYBryIKI7fPqlvpOJoFc';
const DONATION_PRICE_IDS = [
  'price_1UHmK8BryIKI7fPqhXC2jjoX', // $11
  'price_1UHmK9BryIKI7fPqgjJzesaI', // $33
  'price_1UHmK9BryIKI7fPqbBMCjp6h', // $111
  'price_1UHmK9BryIKI7fPq1hjtfR05', // $1,111
  'price_1UHmK9BryIKI7fPq5VWfT8Vu', // $11,000
];
// 100% off the ticket only (amount_off, not percent_off, so it doesn't
// scale if registrationQty > 1) - see scripts/setup-stripe.mjs.
const VOLUNTEER_PROMO_ID = 'promo_1UHlKkBryIKI7fPqkYFotFAd';

const SUCCESS_URL = 'https://fest.philosophers.group/register/thank-you/?session_id={CHECKOUT_SESSION_ID}';
const CANCEL_URL = 'https://fest.philosophers.group/register/';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const { pathname } = new URL(request.url);

    if (pathname !== '/create-checkout') {
      return jsonResponse({ error: 'Not found' }, 404, origin);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    // CORS headers only stop a *browser* from reading a mismatched-origin
    // response - they don't stop the request from being processed server
    // side (curl, a script, etc. would get a full response regardless).
    // Reject those origins outright instead of just omitting the header.
    if (!ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: 'Forbidden' }, 403, origin);
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400, origin);
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ error: 'A valid email is required' }, 400, origin);
    }

    let registrationQty = Number.parseInt(body.registrationQty, 10);
    if (!Number.isInteger(registrationQty) || registrationQty < 1) registrationQty = 1;
    registrationQty = Math.min(registrationQty, 20);

    const workshopTitles = Array.isArray(body.workshopTitles)
      ? body.workshopTitles
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.trim())
        .slice(0, 30)
      : [];

    const isVolunteer = body.isVolunteer === true;
    const extraWorkshopQty = Math.max(workshopTitles.length - registrationQty, 0);

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('line_items[0][price]', TICKET_PRICE_ID);
    params.set('line_items[0][quantity]', String(registrationQty));
    if (extraWorkshopQty > 0) {
      params.set('line_items[1][price]', WORKSHOP_PRICE_ID);
      params.set('line_items[1][quantity]', String(extraWorkshopQty));
    }
    DONATION_PRICE_IDS.forEach((priceId, i) => {
      params.set(`optional_items[${i}][price]`, priceId);
      params.set(`optional_items[${i}][quantity]`, '1');
    });
    if (isVolunteer) {
      params.set('discounts[0][promotion_code]', VOLUNTEER_PROMO_ID);
    } else {
      params.set('allow_promotion_codes', 'true');
    }

    // Stripe metadata values are capped at 500 characters.
    let workshopNames = workshopTitles.join(', ');
    if (workshopNames.length > 500) workshopNames = `${workshopNames.slice(0, 497)}...`;
    if (workshopNames) {
      params.set('metadata[workshop_names]', workshopNames);
      params.set('payment_intent_data[metadata][workshop_names]', workshopNames);
    }
    params.set('metadata[registration_qty]', String(registrationQty));
    params.set('payment_intent_data[metadata][registration_qty]', String(registrationQty));

    params.set('customer_email', email);
    params.set('client_reference_id', email.slice(0, 200));
    params.set('success_url', SUCCESS_URL);
    params.set('cancel_url', CANCEL_URL);

    let stripeRes;
    try {
      stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } catch {
      return jsonResponse({ error: 'Could not reach Stripe' }, 502, origin);
    }

    const data = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('Stripe error creating checkout session', data.error);
      return jsonResponse({ error: 'Could not start checkout' }, 502, origin);
    }

    return jsonResponse({ url: data.url }, 200, origin);
  },
};
