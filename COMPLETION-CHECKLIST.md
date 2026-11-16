# AgriMart requirements completion checklist

Checked against `AgriMart – Agricultural Supply Store Web Application Project Documentation.docx` and `FINAL PROJECT REQUIREMENTS (2).docx`.

## Implemented in the project

- Storefront pages for home, about, products, announcements, contact, registration, login, account, orders, cart and checkout.
- Strapi APIs and management screens for products/categories, customer and staff operations, orders, inventory, announcements, content, users, settings and reports.
- MySQL configuration, relational Strapi content types, bcrypt password hashing, JWT authentication, role checks and server-side validation.
- Inventory movements, reorder alerts, sales/inventory reports and CSV exports.
- PayMongo checkout and webhook code with retry, idempotency and optional webhook; PayPal Orders v2 sandbox checkout with capture-on-return; SMTP email code with preview fallback and branded templates; Google Maps store/contact embed with an optional draggable checkout pin.
- Checkout delivery pin support: device location, draggable map pin (with a Maps JavaScript API key), manual coordinates, map preview, coordinate range checks, and storage on the address record.
- Online payments confirm either through the signed PayMongo webhook or, when no public webhook is reachable, by syncing the checkout session from the return page. An admin email screen reports delivery mode and sends a test message.
- Order flow rechecks product price and stock at checkout, rejects stock shortages when committing inventory, handles successful PayMongo events after cancellation without reviving the order, and uses the order reference to find its matching order.
- PayMongo webhook signatures are checked against the correct test/live signature. Paid checkout clears only the purchased quantities after the order is committed, preserving unrelated cart contents.
- Logout, password changes and password resets invalidate prior sessions; inactive browser sessions expire after 30 minutes.
- Admin product form uploads image files through a role-protected API endpoint (8 MB maximum).
- Product photos for the full demo catalog, served from `agrimart-web/public/products/` and referenced by each product's `imageUrl`.
- Product reviews: customers rate and comment only on items from a delivered (`completed`) order, with one review per customer per product. Product pages show the star average, distribution, verified-purchase reviews and a review form when eligible; product cards show the average once reviews exist. Admin → Reviews lists every review with product, customer, order reference and rating, and supports hide/show plus delete.
- Demo account seeding is off by default. Production authentication refuses to start without `JWT_SECRET`.
- A MySQL backup script is available at `agrimart-api/scripts/backup-database.ps1`.
- System design artifacts are generated into `docs/`: use case, ER, context and architecture diagrams plus nine page wireframes, each as an editable SVG with 2× PNG exports (`docs/png/`) and a print-ready `docs/preview.html`.

## Still requires your accounts or machine setup

1. **Payment:** PayMongo can pause self-serve dashboard sign-ups, so a docs-only account has no API keys. Either add `PAYMONGO_SECRET_KEY` (`sk_test_...`) when a merchant dashboard is available, or create a free PayPal sandbox app and set `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (`PAYPAL_ENV=sandbox`). PayPal wins only when the PayMongo key is blank. For production or a tunnel, also set `PAYMONGO_WEBHOOK_SECRET` and register `https://YOUR_API_DOMAIN/api/payments/paymongo/webhook`. With neither gateway, the built-in simulator still demonstrates the full order, stock and email flow. See `docs/INTEGRATIONS.md`.
2. **Email:** Local capture is already wired: `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025` sends to Laragon's Mailpit (inbox at <http://127.0.0.1:8025>), verified with test, order-received and status-change messages. For real inboxes, replace those values with a provider (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and a `MAIL_FROM` the provider allows) and restart Strapi, then use **Admin → Settings → Send test email**. With SMTP blank, every message is saved to `agrimart-api/.tmp/mail` instead.
3. **Maps:** The store locator and checkout map work keylessly. A draggable in-page pin needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `agrimart-web/.env.local` and a dev-server restart. Browser geolocation requires HTTPS outside localhost.
4. **Daily backup:** Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\laragon\www\agrimart\agrimart-api\scripts\backup-database.ps1"` once. After it succeeds, create a Windows Task Scheduler task to run that command daily. Keep the backup directory on a separate drive or protected storage and periodically test restoring a backup.
5. **Production:** Set `NODE_ENV=production`, use unique strong Strapi/JWT secrets, set `SEED_DEMO=false`, set `FRONTEND_URL` to the HTTPS web origin, allow only that origin in CORS, enable HTTPS, and configure real production database credentials.
6. **Quality checks:** Verify pages on a phone and current Chrome/Firefox/Edge/Safari; check keyboard use, labels and contrast; measure mobile page load; and test cart, checkout, payment webhook, all order transitions, low-stock notification, password reset and report export against the live MySQL database.

## Verification status

- Latest frontend build compiled the application and passed TypeScript, then stopped during static page generation with Windows `EPERM` creating `.next/server/app/_global-error.segments/_global-error`. Re-run the full build after resolving this generated-output directory access issue.
- Backend JavaScript syntax checks: passed for the edited controllers, route files and shared helpers.
- Integration self-check: `node agrimart-api/scripts/verify-integrations.mjs` passed 22/22 checks (mock PayMongo sessions and signatures, mock PayPal create/capture, email preview and template) without external credentials.
- Review flow checked against live MySQL: eligibility opens only for the completed order `AGM-00007`, a UI submission saved rating 4 with its comment, duplicate submissions return `409`, ratings outside 1–5 return `400`, product/catalog aggregates update, hiding a review removes it from the product page and averages, and showing it restores both.
- Strapi production build: not yet verified in this Windows environment because its installed SWC native binding cannot create/read its secure cache; Strapi reached the admin build stage and stopped on that environment error.
- Live MySQL, PayMongo, SMTP, daily Task Scheduler execution, HTTPS, restore, accessibility and cross-browser checks require running the configured services and are not represented as passed here.
- The Plus membership is currently presented as a store program, and supplier promotions/bulk pre-orders are business-model ideas; subscription billing and those transaction modules are not implemented requirements in the functional-requirements section.
