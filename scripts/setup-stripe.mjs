// One-time setup script: creates the Stripe products/prices, the speaker/
// staff/student/volunteer promotion codes, and the registration Payment
// Link. Run manually (`STRIPE_KEY=sk_... node scripts/setup-stripe.mjs`),
// never in CI - it's not part of the build. Prints the public-safe IDs
// (Payment Link URL, price IDs) to paste into the registration page; the
// secret key itself is never written anywhere.
const KEY = process.env.STRIPE_KEY;
if (!KEY) {
  console.error('Set STRIPE_KEY first.');
  process.exit(1);
}

async function stripe(method, path, body) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

// Stripe's form-encoding for nested objects/arrays.
function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}[${key}]` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, k));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v && typeof v === 'object') Object.assign(out, flatten(v, `${k}[${i}]`));
        else out[`${k}[${i}]`] = v;
      });
    } else if (value !== undefined) {
      out[k] = value;
    }
  }
  return out;
}

async function main() {
  console.log('Creating products/prices...');
  const ticketProduct = await stripe('POST', 'products', flatten({ name: 'New Orleans Arts & Ideas Festival 2026 Ticket', description: 'Access to all event days and one workshop.' }));
  const ticketPrice = await stripe('POST', 'prices', flatten({ product: ticketProduct.id, currency: 'usd', unit_amount: 5500 }));

  const workshopProduct = await stripe('POST', 'products', flatten({ name: 'New Orleans Arts & Ideas Festival 2026 Extra Workshop', description: 'Ticket for an additional workshop.' }));
  const workshopPrice = await stripe('POST', 'prices', flatten({ product: workshopProduct.id, currency: 'usd', unit_amount: 2500 }));

  // Fixed preset tiers, not a "customer chooses price" (pay-what-you-want)
  // price: Stripe only allows one of those as the *sole* line item on a
  // Payment Link, which would rule out selling it alongside the
  // ticket/workshop in the same checkout. Each tier is its own optional
  // item instead, so a donor picks one (via "View all" - see below).
  // 11/33/111/1111/11000, matching 11:11 Philosopher's Group.
  const donationProduct = await stripe('POST', 'products', flatten({ name: 'Donation', description: "Help sustain the festival's programming." }));
  const donationTiers = [1100, 3300, 11100, 111100, 1100000];
  const donationPrices = [];
  for (const amount of donationTiers) {
    donationPrices.push(await stripe('POST', 'prices', flatten({ product: donationProduct.id, currency: 'usd', unit_amount: amount, nickname: `Donation $${amount / 100}` })));
  }

  console.log('Creating coupons + promotion codes...');
  async function makePromo(code, coupon) {
    const c = await stripe('POST', 'coupons', flatten({ ...coupon, applies_to: { products: [ticketProduct.id] } }));
    const p = await stripe('POST', 'promotion_codes', flatten({ coupon: c.id, code }));
    return p;
  }
  // amount_off (a flat $55, one ticket's price), not percent_off: 100 - a
  // percentage discount scales with the ticket line item's *quantity*, so
  // a 100%-off code would comp every ticket in the order if someone bumps
  // the adjustable quantity above 1. A flat amount stays capped at one
  // ticket's worth no matter how many are bought.
  await makePromo('speaker', { amount_off: 5500, currency: 'usd', duration: 'once', name: 'Speaker' });
  await makePromo('staff', { amount_off: 5500, currency: 'usd', duration: 'once', name: 'Staff' });
  await makePromo('student', { amount_off: 2200, currency: 'usd', duration: 'once', name: 'Student' });
  // Not explicitly requested, but the volunteer-with-discount path on the
  // original form needs *some* 100%-off mechanism - flagging this default
  // in the summary so it can be renamed/removed if a different flow (e.g.
  // manual approval) is wanted instead.
  await makePromo('volunteer', { amount_off: 5500, currency: 'usd', duration: 'once', name: 'Volunteer' });
  await makePromo('ACX', { amount_off: 5500, currency: 'usd', duration: 'once', name: 'ACX' });
  await makePromo('patron', { amount_off: 5500, currency: 'usd', duration: 'once', name: 'Patron' });
  await makePromo('teacher', { amount_off: 5500, currency: 'usd', duration: 'once', name: 'Teacher' });

  console.log('Creating payment link...');
  const paymentLink = await stripe('POST', 'payment_links', flatten({
    line_items: [
      { price: ticketPrice.id, quantity: 1, adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 } },
    ],
    optional_items: [
      { price: workshopPrice.id, quantity: 1, adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 } },
      ...donationPrices.map((price) => ({ price: price.id, quantity: 1 })),
    ],
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: { custom_message: "You're registered for the New Orleans Arts & Ideas Festival - see you November 11-13! A receipt is on its way to your email." },
    },
  }));

  console.log('\n=== Done - public-safe values for the site ===');
  console.log('PAYMENT_LINK_URL =', paymentLink.url);
  console.log('TICKET_PRICE_ID =', ticketPrice.id);
  console.log('WORKSHOP_PRICE_ID =', workshopPrice.id);
  console.log('DONATION_PRICE_IDS =', donationPrices.map((p) => p.id));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
