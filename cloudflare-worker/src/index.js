// Creates a Stripe Checkout Session with exact preset quantities (a
// Payment Link's URL parameters can't do this - confirmed against
// Stripe's own docs, which list only prefilled_email/prefilled_promo_code/
// prefilled_amount (pay-what-you-want only)/locale/client_reference_id).
// Registered attendees get one workshop each; anything past that is an
// extra-workshop line item. The chosen workshop titles are attached as
// real Stripe metadata (on both the session and the resulting payment
// intent) instead of being crammed into client_reference_id.
//
// Also serves GET /registrations - a simple admin-only view of who's
// registered so far, reading directly from Stripe (nothing is stored here
// or anywhere else - this repo/Worker has no database). Guarded by a
// separate ADMIN_KEY secret, checked against a `?key=` query param; never
// linked from the public site.
//
// Deploy: wrangler secret put STRIPE_SECRET_KEY   (once - full/live key,
//           only ever used server-side here)
//         wrangler secret put ADMIN_KEY            (once - any long random
//           string you choose, shared only with whoever should see the
//           registrant list)
//         wrangler deploy

const ALLOWED_ORIGINS = new Set([
  'https://fest.philosophers.group',
  'http://localhost:4321',
  'http://localhost:4408',
]);

const TICKET_PRICE_ID = 'price_1UHkiYBryIKI7fPqnuFrImGT';
const WORKSHOP_PRICE_ID = 'price_1UHkiYBryIKI7fPqlvpOJoFc';
const MAX_DONATION = 50000; // sanity ceiling against fat-fingered/abusive input
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

// Plain === lets a mistyped/malicious key be distinguished from a correct
// one by how long the comparison took (a timing side channel) - compare
// every character of both strings regardless of where they first differ.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Walks every page of completed Checkout Sessions - a single festival's
// worth of registrations is nowhere near Stripe's 100-per-page limit, but
// this doesn't assume that and keeps paging (capped well above any
// plausible real count) until Stripe says there's no more.
async function fetchAllCheckoutSessions(env) {
  const sessions = [];
  let startingAfter = null;
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      limit: '100',
      status: 'complete',
      'expand[]': 'data.total_details.breakdown.discounts',
    });
    if (startingAfter) params.set('starting_after', startingAfter);

    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    // eslint-disable-next-line no-await-in-loop
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Stripe list request failed');

    sessions.push(...data.data);
    if (!data.has_more || data.data.length === 0) break;
    startingAfter = data.data[data.data.length - 1].id;
  }
  return sessions;
}

function toRegistrationRow(session) {
  const discounts = session.total_details?.breakdown?.discounts || [];
  const isVolunteer = discounts.some((d) => d.discount?.promotion_code === VOLUNTEER_PROMO_ID);
  return {
    created: new Date(session.created * 1000).toISOString(),
    email: session.customer_details?.email || session.customer_email || '',
    name: session.customer_details?.name || '',
    registrationQty: session.metadata?.registration_qty || '',
    workshopNames: session.metadata?.workshop_names || '',
    amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
    currency: (session.currency || 'usd').toUpperCase(),
    isVolunteer,
    sessionId: session.id,
  };
}

function summarize(rows) {
  const totalRegistrations = rows.reduce((sum, r) => sum + (Number(r.registrationQty) || 1), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  return { totalRegistrations, totalRevenue, orders: rows.length };
}

function renderTableRows(rows) {
  return rows.map((r) => `
    <tr>
      <td>${escapeHtml(new Date(r.created).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.registrationQty)}</td>
      <td>${r.isVolunteer ? 'Yes' : ''}</td>
      <td>${escapeHtml(r.workshopNames)}</td>
      <td>${r.amount === null ? '' : `$${r.amount.toFixed(2)} ${escapeHtml(r.currency)}`}</td>
    </tr>`).join('');
}

// Polls /registrations?format=json every 20s and swaps in fresh rows -
// picking up new signups without anyone needing to manually reload this
// tab during the event. Rebuilds the table with DOM APIs (textContent),
// not string concatenation, so it can't reintroduce the injection risk
// escapeHtml() guards against server-side.
const LIVE_REFRESH_SCRIPT = `
<script>
const POLL_MS = 20000;
function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtAmount(r) {
  return r.amount === null ? '' : ('$' + r.amount.toFixed(2) + ' ' + r.currency);
}
function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}
function render(rows) {
  const tbody = document.getElementById('rows');
  tbody.textContent = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.append(
      cell(fmtDate(r.created)), cell(r.name), cell(r.email), cell(r.registrationQty),
      cell(r.isVolunteer ? 'Yes' : ''), cell(r.workshopNames), cell(fmtAmount(r)),
    );
    tbody.appendChild(tr);
  }
  const totalRegistrations = rows.reduce((sum, r) => sum + (Number(r.registrationQty) || 1), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  document.getElementById('count').textContent = rows.length;
  document.getElementById('summary').textContent =
    totalRegistrations + ' total registration' + (totalRegistrations === 1 ? '' : 's') +
    ' across ' + rows.length + ' order' + (rows.length === 1 ? '' : 's') +
    ' \\u00b7 $' + totalRevenue.toFixed(2) + ' total paid';
  document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US');
}
async function refresh() {
  try {
    const res = await fetch('/registrations?format=json', { credentials: 'same-origin' });
    if (!res.ok) return;
    render(await res.json());
  } catch {
    // Transient network hiccup - next poll will retry; leave the table as-is.
  }
}
setInterval(refresh, POLL_MS);
</script>`;

function renderRegistrationsHtml(rows) {
  const { totalRegistrations, totalRevenue, orders } = summarize(rows);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Registrations</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
  h1 { font-size: 20px; }
  .summary { margin-bottom: 4px; color: #444; }
  .updated { margin: 0 0 16px; color: #888; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; position: sticky; top: 0; }
</style>
</head>
<body>
<h1>Registrations (<span id="count">${rows.length}</span>)</h1>
<p class="summary" id="summary">${totalRegistrations} total registration${totalRegistrations === 1 ? '' : 's'} across ${orders} order${orders === 1 ? '' : 's'} &middot; $${totalRevenue.toFixed(2)} total paid</p>
<p class="updated" id="updated">Live - refreshes automatically every 20s</p>
<table>
<thead><tr><th>Date</th><th>Name</th><th>Email</th><th>Qty</th><th>Volunteer</th><th>Workshops</th><th>Paid</th></tr></thead>
<tbody id="rows">${renderTableRows(rows)}</tbody>
</table>
${LIVE_REFRESH_SCRIPT}
</body>
</html>`;
}

const AUTH_COOKIE = 'admin_key';
// A year - this is a bookmarked internal tool, not a session that should
// need re-authenticating; the key itself is what actually gates access.
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return '';
}

// Checks the `?key=` query param first (what the very first, shared link
// uses) and falls back to the admin_key cookie a prior visit would have
// set - so the key only ever needs to be typed/pasted once per browser,
// not appended to the URL on every visit afterward. Returns whether the
// visitor set the cookie just now via the query param, so the caller
// knows to attach Set-Cookie to its response.
function checkAuth(request, url, env) {
  if (!env.ADMIN_KEY) return { ok: false, setCookie: false };
  const queryKey = url.searchParams.get('key') || '';
  if (queryKey && safeEqual(queryKey, env.ADMIN_KEY)) return { ok: true, setCookie: true };
  const cookieKey = readCookie(request, AUTH_COOKIE);
  if (cookieKey && safeEqual(cookieKey, env.ADMIN_KEY)) return { ok: true, setCookie: false };
  return { ok: false, setCookie: false };
}

async function handleRegistrations(request, url, env) {
  const auth = checkAuth(request, url, env);
  if (!env.ADMIN_KEY) {
    return new Response('Not configured', { status: 500 });
  }
  if (!auth.ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  const headers = {};
  if (auth.setCookie) {
    headers['Set-Cookie'] = `${AUTH_COOKIE}=${encodeURIComponent(env.ADMIN_KEY)}; Max-Age=${AUTH_COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  }

  let sessions;
  try {
    sessions = await fetchAllCheckoutSessions(env);
  } catch (err) {
    return new Response(`Could not load registrations: ${err.message}`, { status: 502, headers });
  }

  const rows = sessions
    .map(toRegistrationRow)
    .sort((a, b) => b.created.localeCompare(a.created));

  if (url.searchParams.get('format') === 'json') {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  return new Response(renderRegistrationsHtml(rows), {
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/registrations') {
      return handleRegistrations(request, url, env);
    }

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

    let donationAmount = Number(body.donationAmount);
    if (!Number.isFinite(donationAmount) || donationAmount < 0) donationAmount = 0;
    donationAmount = Math.min(donationAmount, MAX_DONATION);
    const donationCents = Math.round(donationAmount * 100);

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    let lineItemIndex = 0;
    params.set(`line_items[${lineItemIndex}][price]`, TICKET_PRICE_ID);
    params.set(`line_items[${lineItemIndex}][quantity]`, String(registrationQty));
    lineItemIndex += 1;
    if (extraWorkshopQty > 0) {
      params.set(`line_items[${lineItemIndex}][price]`, WORKSHOP_PRICE_ID);
      params.set(`line_items[${lineItemIndex}][quantity]`, String(extraWorkshopQty));
      lineItemIndex += 1;
    }
    if (donationCents > 0) {
      // An ad hoc price (no pre-created Price object needed) so the
      // donation can be any amount chosen on the form, not just one of a
      // handful of fixed tiers.
      params.set(`line_items[${lineItemIndex}][price_data][currency]`, 'usd');
      params.set(`line_items[${lineItemIndex}][price_data][unit_amount]`, String(donationCents));
      params.set(`line_items[${lineItemIndex}][price_data][product_data][name]`, 'Donation');
      params.set(`line_items[${lineItemIndex}][quantity]`, '1');
      lineItemIndex += 1;
    }
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
    // Setting receipt_email directly forces Stripe to send a receipt for
    // this payment regardless of the account's "Successful payments" email
    // setting - customer_email alone (above) only prefills the Checkout
    // page, it doesn't trigger a receipt.
    params.set('payment_intent_data[receipt_email]', email);
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
