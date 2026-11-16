'use strict';

const A = require('../../../lib/agrimart');
const paymongo = require('../../../lib/paymongo');
const paypal = require('../../../lib/paypal');

function rawBodyOf(ctx) {
  return ctx.request.rawBody
    || ctx.request.body?.[Symbol.for('unparsedBody')]
    || ctx.request.body?.__raw
    || '';
}

async function orderIdFromEvent(attributes) {
  const metadata = attributes?.metadata || {};
  if (metadata.orderId) return A.num(metadata.orderId);
  if (metadata.order_id) return A.num(metadata.order_id);
  const reference = String(attributes?.reference_number || '').trim();
  const match = reference.match(/AGM-(\d+)/i);
  if (match) {
    const orderNumber = A.num(match[1]);
    const order = await strapi.db.query(A.UID.order).findOne({ where: { orderNumber } });
    if (order) return A.num(order.id);
  }
  const sessionId = attributes?.id || '';
  if (sessionId) {
    const payment = await strapi.db.query(A.UID.payment).findOne({ where: { paymongoRef: sessionId } });
    if (payment) {
      return typeof payment.order === 'object' ? A.num(payment.order.id) : A.num(payment.order);
    }
  }
  return null;
}

function sessionReference(attributes) {
  // `attributes.id` is the checkout session id for checkout_session.* events.
  const id = String(attributes?.id || '');
  if (id.startsWith('cs_')) return id;
  const payId = attributes?.payments?.[0]?.id || '';
  return payId || id;
}

module.exports = {
  /** POST /api/payments/paymongo/webhook */
  async webhook(ctx) {
    return A.guard(async () => {
      const event = ctx.request.body || {};
      const livemode = Boolean(event?.data?.attributes?.livemode);
      const valid = paymongo.verifyWebhookSignature({
        rawBody: rawBodyOf(ctx),
        header: ctx.request.headers['paymongo-signature'],
        livemode,
      });
      if (!valid) {
        strapi.log.warn('[paymongo] webhook signature rejected');
        return A.fail(ctx, 401, 'Invalid or unverifiable webhook signature.');
      }
      const eventType = event?.data?.attributes?.type || event?.type || '';
      const attributes = event?.data?.attributes?.data?.attributes || {};
      const eventId = event?.data?.id || '';

      strapi.log.info(`[paymongo] webhook ${eventType} ${eventId}`);

      const paidEvents = [
        'checkout_session.payment.paid',
        'payment.paid',
        'checkout_session.payment_intent.succeeded',
      ];
      const failedEvents = [
        'checkout_session.payment.failed',
        'payment.failed',
        'checkout_session.expired',
      ];

      if (paidEvents.includes(eventType)) {
        const orderId = await orderIdFromEvent(attributes);
        const reference = sessionReference(attributes);
        if (orderId) {
          const order = await A.getOrderById(orderId);
          if (order) {
            await A.markOrderPaid(order.id, {
              paymongoRef: reference || order.payment?.paymongoRef,
              user: null,
            });
          } else {
            strapi.log.warn(`[paymongo] order ${orderId} not found for paid event`);
          }
        } else {
          strapi.log.warn(`[paymongo] paid event ${eventId} did not match an order`);
        }
      } else if (failedEvents.includes(eventType)) {
        const orderId = await orderIdFromEvent(attributes);
        if (orderId) {
          const order = await A.getOrderById(orderId);
          if (order && order.payment && order.payment.status !== 'paid') {
            await strapi.db.query(A.UID.payment).update({
              where: { id: order.payment.id },
              data: { status: 'failed', updatedAt: new Date() },
            });
          }
        }
      }

      ctx.body = { received: true, type: eventType };
    });
  },

  /** GET /api/payments/methods */
  async methods(ctx) {
    const simulated = process.env.NODE_ENV !== 'production';
    let provider = 'none';
    let onlineConfigured = false;
    let keyMode = 'none';
    let mode = simulated ? 'simulated' : 'unavailable';
    let confirmation = simulated ? 'simulated' : 'unavailable';
    let online = simulated ? ['gcash', 'card', 'grabpay'] : [];

    if (paymongo.configured()) {
      provider = 'paymongo';
      onlineConfigured = true;
      keyMode = paymongo.keyMode();
      mode = 'paymongo';
      confirmation = paymongo.webhookConfigured() ? 'webhook' : 'sync-on-return';
      online = ['gcash', 'card', 'grabpay'];
    } else if (paypal.configured()) {
      provider = 'paypal';
      onlineConfigured = true;
      keyMode = paypal.mode();
      mode = 'paypal';
      // The return page captures the approved order; no public webhook needed.
      confirmation = 'capture-on-return';
      online = ['card'];
    }

    ctx.body = {
      data: {
        provider,
        onlineConfigured,
        webhookConfigured: provider === 'paymongo' ? paymongo.webhookConfigured() : false,
        keyMode,
        online,
        offline: ['cod'],
        mode,
        confirmation,
      },
    };
  },

  /** GET /api/payments/paymongo/verify/:sessionId - staff check of a session. */
  async verify(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      if (!paymongo.configured()) return A.fail(ctx, 400, 'PayMongo is not configured.');
      if (!String(ctx.params.sessionId || '').startsWith('cs_')) {
        return A.fail(ctx, 400, 'That is not a PayMongo checkout session id.');
      }
      const session = await paymongo.retrieveCheckoutSession(ctx.params.sessionId);
      ctx.body = {
        data: {
          id: session.id,
          status: session.status,
          paid: session.paid,
          paymentId: session.paymentId,
          referenceNumber: session.referenceNumber,
          metadata: session.metadata,
        },
      };
    });
  },
};
