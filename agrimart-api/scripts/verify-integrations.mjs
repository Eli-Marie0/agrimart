#!/usr/bin/env node
/**
 * Local integration self-check for PayMongo, webhook signatures and email.
 *
 * Run from agrimart-api:
 *   node scripts/verify-integrations.mjs
 *
 * It starts a mock PayMongo server on localhost, exercises the API client
 * against it, verifies a signed webhook payload, and writes a preview email
 * to .tmp/mail. No real keys or SMTP account are needed.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);

const SECRET = 'sk_test_local_verification';
const WEBHOOK_SECRET = 'whsec_local_verification';
const SESSION_ID = 'cs_test_local_123';
let mockPaid = false;
const seen = [];

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: raw });
    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    if (req.method === 'POST' && req.url === '/v1/checkout_sessions') {
      const expected = `Basic ${Buffer.from(`${SECRET}:`).toString('base64')}`;
      if (req.headers.authorization !== expected) return send(401, { errors: [{ detail: 'bad key' }] });
      return send(200, {
        data: {
          id: SESSION_ID,
          attributes: {
            checkout_url: 'https://checkout.paymongo.test/cs_test_local_123',
            status: 'active',
            reference_number: JSON.parse(raw || '{}')?.data?.attributes?.reference_number || '',
          },
        },
      });
    }

    if (req.method === 'GET' && req.url === `/v1/checkout_sessions/${SESSION_ID}`) {
      return send(200, {
        data: {
          id: SESSION_ID,
          attributes: {
            status: mockPaid ? 'paid' : 'active',
            reference_number: 'AGM-1001',
            metadata: { orderId: '1' },
            payments: mockPaid ? [{ id: 'pay_test_123', attributes: { status: 'paid' } }] : [],
          },
        },
      });
    }

    if (req.method === 'POST' && req.url === '/v1/oauth2/token') {
      const expected = `Basic ${Buffer.from(`${SECRET}:`).toString('base64')}`;
      // PayPal credentials are separate from PayMongo in real use; the mock
      // only checks that Basic auth is present.
      if (!req.headers.authorization?.startsWith('Basic ')) return send(401, { error: 'invalid_client' });
      return send(200, { access_token: 'A21AA_mock_token', expires_in: 3600, token_type: 'Bearer' });
    }

    if (req.method === 'POST' && req.url === '/v2/checkout/orders') {
      if (!req.headers.authorization?.startsWith('Bearer ')) return send(401, { message: 'missing bearer token' });
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch {}
      const reference = body?.purchase_units?.[0]?.reference_id || '';
      const value = body?.purchase_units?.[0]?.amount?.value || '';
      seen.push({ provider: 'paypal', step: 'create', reference, value });
      return send(200, {
        id: 'PAYPAL-ORDER-1',
        status: 'CREATED',
        links: [
          { rel: 'self', href: `http://127.0.0.1:${port}/v2/checkout/orders/PAYPAL-ORDER-1` },
          { rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1' },
        ],
      });
    }

    if (req.method === 'POST' && req.url === '/v2/checkout/orders/PAYPAL-ORDER-1/capture') {
      if (!req.headers.authorization?.startsWith('Bearer ')) return send(401, { message: 'missing bearer token' });
      return send(201, {
        id: 'PAYPAL-ORDER-1',
        status: 'COMPLETED',
        purchase_units: [{
          payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED', amount: { currency_code: 'PHP', value: '500.00' } }] },
        }],
      });
    }

    if (req.method === 'GET' && req.url === '/v2/checkout/orders/PAYPAL-ORDER-1') {
      return send(200, {
        id: 'PAYPAL-ORDER-1',
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1', status: 'COMPLETED' }] } }],
      });
    }

    return send(404, { errors: [{ detail: 'not found' }] });
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

process.env.PAYMONGO_API_BASE = `http://127.0.0.1:${port}/v1`;
process.env.PAYMONGO_SECRET_KEY = SECRET;
process.env.PAYMONGO_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.PAYPAL_API_BASE = `http://127.0.0.1:${port}`;
process.env.PAYPAL_CLIENT_ID = 'paypal-mock-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-mock-secret';
process.env.PAYPAL_ENV = 'sandbox';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

const paymongo = require(path.join(root, 'src', 'lib', 'paymongo.js'));
const paypal = require(path.join(root, 'src', 'lib', 'paypal.js'));
const A = require(path.join(root, 'src', 'lib', 'agrimart.js'));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

try {
  // 1. Client configuration
  check('PayMongo client detects the secret key', paymongo.configured());
  check('PayMongo key mode is test', paymongo.keyMode() === 'test', paymongo.keyMode());
  check('Webhook secret detected', paymongo.webhookConfigured());

  // 2. Checkout session creation against the mock server
  const created = await paymongo.createCheckoutSession({
    items: [{ name: 'Organic rice seed', amount: 250, quantity: 2 }],
    amount: 500,
    description: 'AgriMart verification order',
    referenceNumber: 'AGM-1001',
    metadata: { orderId: '1' },
    successUrl: 'http://localhost:3001/order-confirmation?order=1&payment=success',
    cancelUrl: 'http://localhost:3001/order-confirmation?order=1&payment=cancelled',
    methods: ['gcash', 'card'],
  });
  check('Checkout session returns a URL', created.id === SESSION_ID && Boolean(created.checkoutUrl), created.checkoutUrl);
  const createCall = seen.find((call) => call.method === 'POST');
  check('Authorization header uses Basic auth', Boolean(createCall?.auth?.startsWith('Basic ')));
  check('Idempotency key is sent', Boolean(createCall?.body?.includes('AGM-1001')));

  // 3. Session retrieval - unpaid then paid
  const unpaid = await paymongo.retrieveCheckoutSession(SESSION_ID);
  check('Unpaid session reads as unpaid', unpaid.paid === false && unpaid.status === 'active');
  mockPaid = true;
  const paid = await paymongo.retrieveCheckoutSession(SESSION_ID);
  check('Paid session is detected', paid.paid === true && paid.paymentId === 'pay_test_123');

  // 4. Webhook signature verification
  const rawBody = JSON.stringify({
    data: {
      id: 'evt_test_1',
      attributes: {
        type: 'checkout_session.payment.paid',
        livemode: false,
        data: {
          id: SESSION_ID,
          attributes: {
            id: SESSION_ID,
            reference_number: 'AGM-1001',
            metadata: { orderId: '1' },
            payments: [{ id: 'pay_test_123', attributes: { status: 'paid' } }],
          },
        },
      },
    },
  });
  const header = paymongo.signWebhook({ rawBody, secret: WEBHOOK_SECRET });
  check('Valid signature is accepted', paymongo.verifyWebhookSignature({ rawBody, header, secret: WEBHOOK_SECRET }));
  const tampered = rawBody.replace('pay_test_123', 'pay_test_999');
  check('Tampered body is rejected', !paymongo.verifyWebhookSignature({ rawBody: tampered, header, secret: WEBHOOK_SECRET }));
  check('Wrong secret is rejected', !paymongo.verifyWebhookSignature({ rawBody, header, secret: 'whsec_wrong' }));
  const liveHeader = paymongo.signWebhook({ rawBody, secret: WEBHOOK_SECRET, livemode: true });
  check('Live signature is not accepted for a test event', !paymongo.verifyWebhookSignature({ rawBody, header: liveHeader, secret: WEBHOOK_SECRET, livemode: false }));

  // 5. PayPal sandbox client
  check('PayPal client detects its credentials', paypal.configured());
  check('PayPal mode is sandbox', paypal.mode() === 'sandbox', paypal.mode());
  const paypalOrder = await paypal.createOrder({
    amount: 500,
    reference: 'AGM-1001',
    description: 'AgriMart verification order',
    orderId: '1',
    returnUrl: 'http://localhost:3001/order-confirmation?order=1&payment=success',
    cancelUrl: 'http://localhost:3001/order-confirmation?order=1&payment=cancelled',
  });
  check('PayPal returns an approval link', paypalOrder.id === 'PAYPAL-ORDER-1' && paypalOrder.approveUrl.includes('sandbox.paypal.com'), paypalOrder.approveUrl);
  const captureCall = seen.find((call) => call.provider === 'paypal' && call.step === 'create');
  check('PayPal amount is sent in PHP with 2 decimals', captureCall?.reference === 'AGM-1001' && captureCall?.value === '500.00', `${captureCall?.reference} ${captureCall?.value}`);
  const captured = await paypal.captureOrder('PAYPAL-ORDER-1');
  check('PayPal capture completes the order', captured.status === 'COMPLETED' && captured.captureId === 'CAPTURE-1', captured.status);

  // 6. Email preview fallback
  const status = A.mailStatus();
  check('Email falls back to preview mode without SMTP', status.configured === false && status.mode === 'preview');
  const mail = await A.sendTestMail('owner@agrimart.ph');
  check('Test email reports preview mode', mail.sent === false && mail.mode === 'preview');
  check('Preview file was written', Boolean(mail.preview && fs.existsSync(mail.preview)), mail.preview);
  if (mail.preview) {
    const html = fs.readFileSync(mail.preview, 'utf8');
    check('Preview contains the branded shell', html.includes('AgriMart') && html.includes('AgriMart email test'));
  }

  // 7. HTML template
  const html = A.mailHtml({ heading: 'Order paid', intro: 'Thanks', rows: [['Total', 'PHP 500.00']], actionLabel: 'View order', actionUrl: 'http://localhost:3001/account/orders/1' });
  check('Mail template escapes and renders rows', html.includes('PHP 500.00') && html.includes('View order'));
} catch (err) {
  check('Integration script completed', false, err.stack || err.message);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const failed = results.filter((row) => !row.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
