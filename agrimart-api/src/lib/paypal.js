'use strict';

/**
 * Minimal PayPal Orders v2 client for sandbox payments.
 *
 * The customer is redirected to PayPal, approves the payment, and returns to
 * the store. The return page calls capture and the order becomes paid. This
 * keeps working on localhost without a public webhook.
 */

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';
const REQUEST_TIMEOUT_MS = 20000;

function clientId() {
  return String(process.env.PAYPAL_CLIENT_ID || '').trim();
}

function clientSecret() {
  return String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
}

function configured() {
  return Boolean(clientId() && clientSecret());
}

function mode() {
  return String(process.env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
}

function apiBase() {
  return String(process.env.PAYPAL_API_BASE || (mode() === 'live' ? LIVE_BASE : SANDBOX_BASE)).replace(/\/+$/, '');
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function money(value) {
  return (Math.round(Number(value || 0) * 100) / 100).toFixed(2);
}

let tokenCache = { token: '', expiresAt: 0 };

async function accessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) return tokenCache.token;
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!response.ok || !payload?.access_token) {
    const message = payload?.error_description || payload?.error || `PayPal authentication failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status || 502;
    throw error;
  }
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 300) * 1000,
  };
  return tokenCache.token;
}

function retryable(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

async function request(path, options = {}, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = await accessToken();
    const response = await fetch(`${apiBase()}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
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
      const detail = payload?.details?.[0]?.description
        || payload?.details?.[0]?.issue
        || payload?.message
        || `PayPal error (${response.status})`;
      if (retryable(response.status) && attempt < 3) {
        await sleep(400 * attempt);
        return request(path, options, attempt + 1);
      }
      const error = new Error(detail);
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
      const error = new Error('PayPal did not answer in time. Try again in a moment.');
      error.status = 504;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function captureIdOf(payload) {
  const units = Array.isArray(payload?.purchase_units) ? payload.purchase_units : [];
  for (const unit of units) {
    const captures = unit?.payments?.captures;
    if (Array.isArray(captures) && captures.length) {
      const completed = captures.find((capture) => capture.status === 'COMPLETED') || captures[0];
      if (completed?.id) return completed.id;
    }
  }
  return '';
}

async function createOrder({ amount, reference, description, orderId, returnUrl, cancelUrl }) {
  const payload = await request('/v2/checkout/orders', {
    method: 'POST',
    headers: reference ? { 'paypal-request-id': String(reference).slice(0, 100) } : {},
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: String(reference || '').slice(0, 256),
        custom_id: String(orderId || '').slice(0, 127),
        description: String(description || 'AgriMart order').slice(0, 127),
        amount: {
          currency_code: 'PHP',
          value: money(amount),
        },
      }],
      application_context: {
        brand_name: 'AgriMart',
        landing_page: 'NO_PREFERENCE',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  const links = Array.isArray(payload?.links) ? payload.links : [];
  const approve = links.find((link) => link.rel === 'approve' || link.rel === 'payer-action');
  return {
    id: payload?.id || '',
    status: payload?.status || '',
    approveUrl: approve?.href || '',
    raw: payload,
  };
}

async function getOrder(orderId) {
  const payload = await request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  return {
    id: payload?.id || orderId,
    status: payload?.status || '',
    captureId: captureIdOf(payload),
    raw: payload,
  };
}

/**
 * Capture an approved order.
 *
 * Two normal cases must not surface as errors:
 * - ORDER_ALREADY_CAPTURED: the browser retried after a successful capture.
 * - PAYER_ACTION_REQUIRED / ORDER_NOT_APPROVED: the customer is back on the
 *   return page but has not approved yet (or pressed back). The order is still
 *   pending, so return its state and let the page poll again.
 */
async function captureOrder(orderId) {
  try {
    const payload = await request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'paypal-request-id': `capture-${String(orderId).slice(0, 90)}` },
    });
    return {
      id: payload?.id || orderId,
      status: payload?.status || '',
      captureId: captureIdOf(payload),
      raw: payload,
    };
  } catch (err) {
    const issues = (Array.isArray(err.payload?.details) ? err.payload.details : [])
      .map((detail) => String(detail?.issue || '').toUpperCase());
    const alreadyCaptured = issues.some((issue) => issue.includes('ALREADY_CAPTURED'));
    const notApproved = issues.some((issue) => issue.includes('PAYER_ACTION_REQUIRED') || issue.includes('ORDER_NOT_APPROVED'));
    if (alreadyCaptured || notApproved || err.status === 422 || err.status === 409) {
      const existing = await getOrder(orderId);
      if (existing.status === 'COMPLETED') return existing;
      if (notApproved) return existing;
    }
    throw err;
  }
}

module.exports = {
  apiBase,
  configured,
  mode,
  createOrder,
  captureOrder,
  getOrder,
  money,
};
