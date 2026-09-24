# Registration checkout Worker

Creates a Stripe Checkout Session server-side, with exact preset quantities
(registrations + only-as-many-extra-workshops-as-selected) and the chosen
workshop titles attached as Stripe metadata - none of which a Payment
Link's URL parameters can do. Called by `RegistrationForm.jsx` via
`CHECKOUT_ENDPOINT` in `src/lib/registrationConfig.js`.

Also serves `GET /registrations` - an admin-only page listing who's
registered so far (name, email, quantity, workshops, volunteer status,
amount paid), read live from Stripe. Nothing is stored anywhere - not in
this repo, not in the Worker - every request re-fetches from Stripe.

## Deploy

```sh
cd cloudflare-worker
npx wrangler login          # once, opens a browser
npx wrangler secret put STRIPE_SECRET_KEY   # paste the live secret key when prompted
npx wrangler secret put ADMIN_KEY           # paste any long random string you choose
npx wrangler deploy
```

`wrangler deploy` prints the Worker's URL (`https://fest-registration.<subdomain>.workers.dev`).
Copy `<url>/create-checkout` into `CHECKOUT_ENDPOINT` in
`../src/lib/registrationConfig.js`.

## Viewing registrations

Visit `<worker-url>/registrations?key=<ADMIN_KEY>` (the same value you set
above). Add `&format=json` for raw JSON instead of the HTML table. This
URL is not linked from the site anywhere and returns 401 without the
correct key - share the key only with whoever should see registrant PII
(names/emails), and treat the URL itself as sensitive since anyone who has
it can view the list.

## Updating

Price/promo IDs and the donation tier list are hardcoded in `src/index.js`
(same objects `scripts/setup-stripe.mjs` created). If those ever change in
Stripe, update them here too, then `npx wrangler deploy` again.

## Local testing

```sh
npx wrangler dev
```

Runs the function locally; point `CHECKOUT_ENDPOINT` at the printed
`http://localhost:8787/create-checkout` URL for local testing, and set the
secrets for local dev with a `.dev.vars` file (gitignored):

```
STRIPE_SECRET_KEY=sk_test_...
ADMIN_KEY=whatever-you-want-locally
```
