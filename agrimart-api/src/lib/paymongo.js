'use strict';

/**
 * PayMongo Checkout Session client.
 *
 * Sandbox and live share the same API shape, only the secret key differs.
 * `PAYMONGO_API_BASE` can point at a mock server for local verification.
 */

const DEFAULT_BASE = 'https://api.paymongo.com/v1';
const REQUEST_TIMEOUT_MS = 20000;

function secretKey() {
  return String(process.env.PAYMONGO_SECRET_KEY || '').trim();
}

function webhookSecret() {
  return String(process.env.PAYMONGO_WEBHOOK_SECRET || '').trim();
}

function apiBase() {
  return String(process.env.PAYMONGO_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
}

function configured() {
  return Boolean(secretKey());
}

function webhookConfigured() {
  return Boolean(webhookSecret());
}

/** test | live | unknown | none - derived from the secret key prefix. */
function keyMode() {
  const key = secretKey();
  if (!key) return 'none';
  if (key.startsWith('sk_test_')) return 'test';
  if (key.startsWith('sk_live_')) return 'live';
  return 'unknown';
}

function authHeader() {
  return `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`;
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function retryable(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

async function request(path, options = {}, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: authHeader(),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const message = payload?.errors?.[0]?.detail
        || payload?.errors?.[0]?.title
        || `PayMongo error (${response.status})`;
      if (retryable(response.status) && attempt < 3) {
        await sleep(400 * attempt);
        return request(path, options, attempt + 1);
      }
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } catch (err) {
    const aborted = err.name === 'AbortError';
    const network = !err.status && !aborted;
    if ((aborted || network) && attempt < 3) {
      await sleep(400 * attempt);
      return request(path, options, attempt + 1);
    }
    if (aborted) {
      const error = new Error('PayMongo did not answer in time. Try again in a moment.');
      error.status = 504;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function centavos(amount) {
  return Math.max(0, Math.round(Number(amount || 0) * 100));
}

/**
 * Create a hosted checkout session.
 * @param {object} input
 * @param {Array} input.items - [{ name, amount, quantity, description }]
 * @param {number} input.amount - total in pesos (used as a fallback line item)
 * @param {string} input.description
 * @param {string} input.referenceNumber
 * @param {object} input.metadata
 * @param {string} input.successUrl
 * @param {string} input.cancelUrl
 * @param {Array<string>} input.methods - gcash | card | grabpay | paymaya
 */
async function createCheckoutSession(input) {
  const items = (input.items || []).filter((item) => item && item.amount > 0);
  const lineItems = items.length
    ? items.map((item) => ({
      currency: 'PHP',
      amount: centavos(item.amount),
      name: String(item.name || 'AgriMart item').slice(0, 120),
      quantity: Math.max(1, Number(item.quantity || 1)),
      description: String(item.description || '').slice(0, 255) || undefined,
    }))
    : [{
      currency: 'PHP',
      amount: centavos(input.amount),
      name: 'AgriMart order',
      quantity: 1,
    }];

  const reference = String(input.referenceNumber || '').slice(0, 100);
  const payload = await request('/checkout_sessions', {
    method: 'POST',
    headers: reference ? { 'idempotency-key': reference } : {},
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: String(input.description || '').slice(0, 255),
          reference_number: reference,
          line_items: lineItems,
          payment_method_types: input.methods && input.methods.length
            ? input.methods
            : ['gcash', 'card', 'grabpay'],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata || {},
        },
      },
    }),
  });

  const attributes = payload?.data?.attributes || {};
  return {
    id: payload?.data?.id || '',
    checkoutUrl: attributes.checkout_url || '',
    status: attributes.status || 'active',
    referenceNumber: attributes.reference_number || reference,
    raw: payload,
  };
}

function isPaidSession(attributes = {}) {
  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  const paidPayment = payments.find((payment) => payment?.attributes?.status === 'paid');
  if (paidPayment) return { paid: true, paymentId: paidPayment.id || '' };
  if (attributes.payment_intent?.attributes?.status === 'succeeded') {
    return { paid: true, paymentId: attributes.payment_intent?.id || '' };
  }
  if (attributes.status === 'paid') {
    const first = payments[0];
    return { paid: true, paymentId: first?.id || '' };
  }
  return { paid: false, paymentId: '' };
}

async function retrieveCheckoutSession(sessionId) {
  const payload = await request(`/checkout_sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });
  const attributes = payload?.data?.attributes || {};
  const { paid, paymentId } = isPaidSession(attributes);
  return {
    id: payload?.data?.id || sessionId,
    status: attributes.status || '',
    paid,
    paymentId,
    payments: Array.isArray(attributes.payments) ? attributes.payments : [],
    metadata: attributes.metadata || {},
    referenceNumber: attributes.reference_number || '',
    raw: payload,
  };
}

function parseSignatureHeader(header) {
  const parts = {};
  String(header || '').split(',').forEach((chunk) => {
    const index = chunk.indexOf('=');
    if (index > 0) {
      const key = chunk.slice(0, index).trim();
      const value = chunk.slice(index + 1).trim();
      if (key && value) parts[key] = value;
    }
  });
  return parts;
}

/**
 * Verify a PayMongo webhook signature.
 * The signed payload is `${timestamp}.${rawBody}`; live and test events carry
 * separate signatures (`li` / `te`) so one mode cannot be replayed as the other.
 */
function verifyWebhookSignature({ rawBody, header, secret = webhookSecret(), livemode = false }) {
  if (!secret || !rawBody || !header) return false;
  const parts = parseSignatureHeader(header);
  const signature = livemode ? parts.li : parts.te;
  if (!parts.t || !signature) return false;
  const crypto = require('crypto');
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${parts.t}.`), body])).digest('hex');
  try {
    const expectedBytes = Buffer.from(expected, 'hex');
    const actualBytes = Buffer.from(signature, 'hex');
    return expectedBytes.length === actualBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes);
  } catch {
    return false;
  }
}

/** Build a valid signature header - used by the local integration check. */
function signWebhook({ rawBody, timestamp = Math.floor(Date.now() / 1000), secret = webhookSecret(), livemode = false }) {
  const crypto = require('crypto');
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const digest = crypto.createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), body])).digest('hex');
  return livemode ? `t=${timestamp},li=${digest}` : `t=${timestamp},te=${digest}`;
}

module.exports = {
  apiBase,
  configured,
  keyMode,
  webhookConfigured,
  createCheckoutSession,
  retrieveCheckoutSession,
  verifyWebhookSignature,
  signWebhook,
  centavos,
};
