# Integration Setup and Verification

How the three external services are wired, what works without credentials, and
how to turn each one on. Nothing here requires a code change — only environment
values.

| Service | Used for | Works without credentials? |
| --- | --- | --- |
| Google Maps | Store locator, delivery pin on checkout | Yes, keyless embed |
| PayMongo | GCash, card and GrabPay checkout | Yes, local simulator (dev only) |
| PayPal | Card / PayPal sandbox checkout | Yes, local simulator (dev only) |
| SMTP email | Order, reset-password, low-stock and contact emails | Yes, preview files |

Environment files:

- `agrimart-api/.env` — PayMongo secret, webhook secret, SMTP credentials.
- `agrimart-web/.env.local` — Google Maps JavaScript API key.

Both servers must be restarted after changing an environment value. Next.js
inlines `NEXT_PUBLIC_*` values at build/dev-server start, and Strapi reads
`.env` only at process start.

---

## 1. Google Maps

### What is implemented

- `components/MapPicker.js`
  - With `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set: a Google Maps JavaScript map
    with a draggable delivery pin. Dragging the pin or clicking the map writes
    six-decimal latitude/longitude back into the checkout form.
  - Without a key, or if the script fails to load: the keyless
    `google.com/maps?q=…&output=embed` iframe. Checkout never breaks.
- `app/checkout/page.js` uses `MapPicker` for the delivery pin. Picking a pin
  switches the form to the new-address path and copies the saved address fields,
  so the order stores a complete address plus coordinates.
- `app/contact/page.js` renders the keyless embed from `contact-info`
  latitude/longitude, falls back to Victoria (13.177, 121.279), and adds a
  **Get directions** link. Blank or `null` database values no longer produce
  `null,null` map queries.
- `components/AccountOrderDetail.js` only uses coordinates when both values are
  present and finite; otherwise it searches by the typed address.

### Enable the draggable pin

1. In Google Cloud Console create/select a project.
2. **APIs & Services → Library → Maps JavaScript API → Enable**.
3. **Credentials → Create credentials → API key**.
4. Restrict the key to your site (`http://localhost:3001/*` for development,
   plus the production domain) and to the Maps JavaScript API.
5. Put it in `agrimart-web/.env.local`:

   ```dotenv
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
   ```

6. Restart `npm run dev` in `agrimart-web`.

No billing-enabled key is required for the embed. The store locator and the
fallback map on checkout work with the key blank.

### Verify

- Open `http://localhost:3001/contact` — the store map loads and **Get
  directions** opens Google Maps.
- Open checkout with a delivery address — dragging the pin changes the
  Latitude/Longitude inputs. With no key, the map still appears and the inputs
  remain editable.

---

## 2. PayMongo

### What is implemented

- `agrimart-api/src/lib/paymongo.js`
  - 20-second request timeout, retries with backoff on 429/5xx/network errors.
  - `Idempotency-Key` on checkout-session creation (the order reference).
  - `PAYMONGO_API_BASE` override for the local mock server.
  - `keyMode()` reports `test`, `live` or `none` from the key prefix.
  - `verifyWebhookSignature()` verifies `t` + `li`/`te` HMAC-SHA256 against the
    **raw** request body and rejects unverifiable events.
- `POST /api/checkout`
  - Creates the order, items and payment row first, then the PayMongo session.
  - Online payment only needs `PAYMONGO_SECRET_KEY`. The webhook secret is
    optional.
  - Stores the `cs_...` checkout-session id in `payment.paymongoRef` so the
    session can be re-checked later.
  - Falls back to `mode: "simulated"` when PayMongo is not configured or the
    sandbox call fails in development.
- `POST /api/checkout/:id/sync-payment` (customer or staff)
  - Pulls the checkout session from PayMongo and, when paid, marks the order
    paid, deducts stock, appends status history and sends the receipt email.
  - Used by the return page when a public webhook cannot reach the API.
- `app/order-confirmation` (`components/OrderConfirmation.js`)
  - After returning with `?payment=success`, it polls `sync-payment` three times
    (0.8 s, 3.5 s, 3.5 s) and updates the page automatically.
  - **Check payment status** runs the same check on demand.
- `POST /api/payments/paymongo/webhook`
  - Verifies the signature, matches the event to an order by `metadata.orderId`,
    `reference_number` (`AGM-…`) or stored session id, then applies the paid or
    failed state. Duplicate events are idempotent (payment already `paid`).
- `GET /api/payments/methods` returns `onlineConfigured`, `webhookConfigured`,
  `keyMode`, `mode` (`paymongo` | `simulated` | `unavailable`) and
  `confirmation` (`webhook` | `sync-on-return` | `simulated`).

### Enable sandbox payments

1. Sign in at <https://dashboard.paymongo.com>, switch to **Test mode**.
2. **Developers → API keys** → copy the secret key (`sk_test_...`).
3. Put it in `agrimart-api/.env`:

   ```dotenv
   PAYMONGO_SECRET_KEY=sk_test_...
   PAYMONGO_PUBLIC_KEY=pk_test_...
   ```

4. Restart Strapi. Confirm `http://127.0.0.1:1337/api/payments/methods` reports
   `"onlineConfigured": true` and `"keyMode": "test"`.

A webhook is optional for local development. Without a public URL the customer
still returns to `/order-confirmation?order=…&payment=success`, and the page
syncs the session itself.

### Enable the webhook (production / tunnel)

1. **Developers → Webhooks → Create** with URL
   `https://<public-host>/api/payments/paymongo/webhook`.
2. Subscribe to `checkout_session.payment.paid` and
   `checkout_session.payment.failed` (add `checkout_session.expired` if shown).
3. Copy the signing secret (`whsec_...`) to `.env`:

   ```dotenv
   PAYMONGO_WEBHOOK_SECRET=whsec_...
   ```

4. Restart Strapi. The signature check needs the raw body; this is already
   enabled by `config/middlewares.js` (`strapi::body { includeUnparsed: true }`).
   Requests with a missing/invalid signature get `401` and are logged.

The webhook and the return-page sync are safe together: whichever arrives
first marks the payment paid, and the other becomes a no-op.

### Verify without credentials

```powershell
cd C:\laragon\www\agrimart\agrimart-api
node scripts/verify-integrations.mjs
```

The script starts a mock PayMongo server on localhost and checks:
session creation, Basic auth, idempotency, unpaid/paid detection, valid/tampered
signature handling, test-vs-live separation, the email preview fallback and the
HTML template and the PayPal create/capture flow. It prints `22/22 checks passed.` on success and exits non-zero on
failure.

With sandbox keys, place an order with GCash/card in test mode. After the
PayMongo test page redirects back, the confirmation page shows **Payment
received** without a manual refresh.

### Notes

- If PayMongo has paused self-serve dashboard sign-ups, a docs-only account
  (`docs.paymongo.com`) has no merchant profile and no API keys. Do not block
  the demo on it: keep `PAYMONGO_SECRET_KEY` blank and the app uses the
  simulator, or borrow a classmate's **test** key (`sk_test_...`) for local
  testing. Test keys only move fake money.
- `paymongoRef` keeps the `cs_...` id even when a later webhook reports a
  payment id, so the session stays re-checkable.
- A payment that arrives for a cancelled order is recorded as paid and logged
  for refund review; the order is not revived and stock is not deducted twice.
- `PAYMONGO_API_BASE` is for automated tests only — leave it blank in normal
  use.

---

## 2b. PayPal sandbox (when PayMongo signup is paused)

PayPal is the fallback gateway when PayMongo pauses dashboard sign-ups. It is a
real sandbox: the customer approves a payment on PayPal, the app captures it,
and the order becomes paid. No public webhook is needed because the return page
captures the approved order.

### Priority order

The app picks the first configured gateway:

1. `PAYMONGO_SECRET_KEY` → PayMongo
2. `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` → PayPal
3. neither → local simulator

To use PayPal, **leave `PAYMONGO_SECRET_KEY` blank**.

### Get sandbox credentials

1. Create/sign in to a PayPal account, then open
   <https://developer.paypal.com/dashboard/applications/sandbox>.
2. Click **Create App**, name it `AgriMart`, choose the sandbox business account.
3. Copy the **Client ID** and **Secret**.
4. In `agrimart-api/.env`:

   ```dotenv
   PAYPAL_ENV=sandbox
   PAYPAL_CLIENT_ID=your-sandbox-client-id
   PAYPAL_CLIENT_SECRET=your-sandbox-secret
   PAYPAL_API_BASE=
   ```

5. Restart Strapi.

### Test payer account

The PayPal login page needs a **sandbox personal account**, not your real
PayPal login:

1. Developer Dashboard → **Testing Tools → Sandbox Accounts**.
2. Use the generated personal account email/password on the PayPal checkout
   page. Its balance is fake money.
3. Approve the payment; PayPal redirects back to
   `/order-confirmation?order=…&payment=success`.
4. The page captures the order automatically and shows **Payment received**.

If PayPal refuses `http://localhost:3001` as a return URL, expose the web app
with a tunnel (for example `ngrok http 3001`) and set
`FRONTEND_URL=https://your-tunnel-host` in `agrimart-api/.env`, then restart.

### Verify

```powershell
Invoke-RestMethod http://127.0.0.1:1337/api/payments/methods | ConvertTo-Json -Depth 5
```

Expected:

```json
"provider": "paypal",
"onlineConfigured": true,
"keyMode": "sandbox",
"mode": "paypal",
"confirmation": "capture-on-return"
```

On checkout, the online option becomes **PayPal / Card** and the tag reads
**PayPal**. You are redirected to `sandbox.paypal.com` after placing the order.

### How it works

- `src/lib/paypal.js` gets an OAuth token, creates an Orders v2 order in PHP,
  returns the `approve` link, and captures the order when the customer returns.
- `POST /api/checkout` stores the PayPal order id in `payment.paymongoRef` (the
  field is reused as a generic gateway reference).
- `POST /api/checkout/:id/sync-payment` captures the PayPal order, tolerates a
  repeated capture (already captured), then marks the order paid and sends the
  receipt.
- A failed or cancelled PayPal approval leaves the order pending, so the
  customer can retry or cancel it.

### Notes

- Sandbox only: keep `PAYPAL_ENV=sandbox`. `live` requires a PayPal business
  account and would move real money.
- PayPal supports PHP, cards and PayPal balance; it does not offer GCash, which
  is why PayMongo remains the preferred gateway when available.
- `PAYPAL_API_BASE` is for the automated mock test only; leave it blank.

---

## 3. Email (SMTP)

### What is implemented

- `agrimart-api/src/lib/agrimart.js`
  - `smtpConfig()` treats a host with sample/placeholder credentials
    (`your-…`, `changeme`, `example.com`) as **not configured**, so a copied
    `.env.example` no longer produces silent authentication failures.
  - Unconfigured sends are written to `agrimart-api/.tmp/mail/*.html` and logged
    as `[email:preview]`. The file is a full branded HTML email you can open in
    a browser.
  - Configured sends use pooled nodemailer transports with 10 s connection and
    15 s socket timeouts. Transient network/5xx errors retry once; permanent
    errors (`EAUTH`, bad envelope) fail immediately.
  - Every transactional email uses `mailHtml()` — the same ivory/forest/lime
    shell as the storefront.
  - `sendOrderMail()` now renders an item table, totals, status and address.
- `GET /api/admin/mail` (admin) reports mode, host, port, masked user and the
  preview directory.
- `POST /api/admin/mail/test` (admin) verifies the SMTP connection and sends a
  test message. Without SMTP it writes a preview and returns its path.
- `Admin → Settings → Email delivery` shows the current mode and has a
  **Send test email** button.

Emails sent by the app:

| Trigger | Recipient |
| --- | --- |
| Order placed (pickup / delivery) | Customer |
| Payment received | Customer |
| Order status change | Customer |
| Password reset | User |
| Low-stock alert | Settings `lowStockEmail` |
| Website contact form | Settings `supportEmail` |

### Enable real email

Gmail (development only):

1. Enable 2-step verification on the Google account.
2. Create an **App Password** (Google Account → Security → App passwords).
3. Set:

   ```dotenv
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your.address@gmail.com
   SMTP_PASS=the16charapppassword
   MAIL_FROM=AgriMart <your.address@gmail.com>
   ```

4. Restart Strapi, then use **Admin → Settings → Send test email**.

Local capture (Mailpit / MailHog) needs no account. Laragon ships Mailpit and this project is already pointed at it (inbox UI at <http://127.0.0.1:8025>):

```dotenv
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=AgriMart <no-reply@agrimart.ph>
```

Production: use the provider's SMTP host, port 465 with `SMTP_SECURE=true` or
587 with STARTTLS as instructed, and a dedicated sending domain.

### Verify

- **No credentials:** `POST /api/admin/mail/test` returns `sent: false`,
  `mode: "preview"` and a `preview` path. Open that HTML file.
- **With credentials:** the same call returns `sent: true` and `verified: true`;
  the message arrives at the address you entered.
- Place a test order and check the order-received email. The order confirmation
  page also shows the email state indirectly (no blocking error if delivery
  fails).

### Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `mode: "preview"` with a host set | Credentials still look like placeholders, or `SMTP_PASS` is empty. |
| `EAUTH` / `535` | Gmail needs an App Password, not the account password. |
| `ETIMEDOUT` / `ECONNECTION` | Wrong host/port, firewall, or `SMTP_SECURE` mismatch (465 = true). |
| Mail sent but not received | Check spam, then the provider's sending log; verify `MAIL_FROM` is allowed. |
| Nothing in `.tmp/mail` | The process cannot write to the project folder, or `to` was empty. |

---

## Quick health checks

```powershell
# Payment configuration and confirmation strategy
Invoke-RestMethod http://127.0.0.1:1337/api/payments/methods | ConvertTo-Json -Depth 5

# Admin mail status (after signing in as admin)
# GET /api/admin/mail with an Authorization: Bearer <token> header
```

Expected with a fresh checkout and no credentials:

```json
{ "onlineConfigured": false, "webhookConfigured": false, "keyMode": "none",
  "mode": "simulated", "confirmation": "simulated" }
```

Add the keys when you are ready to demonstrate live sandbox payments and real
email delivery; the UI and API switch automatically.
