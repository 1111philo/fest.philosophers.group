# Registration checkout Worker

Creates a Stripe Checkout Session server-side, with exact preset quantities
(registrations + only-as-many-extra-workshops-as-selected) and the chosen
workshop titles attached as Stripe metadata - none of which a Payment
Link's URL parameters can do. Called by `RegistrationForm.jsx` via
`CHECKOUT_ENDPOINT` in `src/lib/registrationConfig.js`.

## Deploy

```sh
cd cloudflare-worker
npx wrangler login          # once, opens a browser
npx wrangler secret put STRIPE_SECRET_KEY   # paste the live secret key when prompted
npx wrangler deploy
```

`wrangler deploy` prints the Worker's URL (`https://fest-registration.<subdomain>.workers.dev`).
Copy `<url>/create-checkout` into `CHECKOUT_ENDPOINT` in
`../src/lib/registrationConfig.js`.

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
secret for local dev with a `.dev.vars` file (gitignored):

```
STRIPE_SECRET_KEY=sk_live_...
```
