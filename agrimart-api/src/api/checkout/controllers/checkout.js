'use strict';

const A = require('../../../lib/agrimart');
const paymongo = require('../../../lib/paymongo');
const paypal = require('../../../lib/paypal');

const PAYMENT_METHODS = ['cod', 'gcash', 'card', 'grabpay'];
const PAYMONGO_METHOD_MAP = {
  gcash: 'gcash',
  card: 'card',
  grabpay: 'grabpay',
  cod: 'cod',
};

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

/** Which online gateway is active: PayMongo first, then PayPal, else simulator. */
function onlineProvider() {
  if (paymongo.configured()) return 'paymongo';
  if (paypal.configured()) return 'paypal';
  return 'simulated';
}

function ownerIdOf(row) {
  if (!row || !row.user) return null;
  return typeof row.user === 'object' ? A.num(row.user.id) : A.num(row.user);
}

async function addressOwnedBy(userId, addressId) {
  const row = await strapi.db.query(A.UID.address).findOne({
    where: { id: A.num(addressId) },
    populate: { user: true },
  });
  if (!row) return null;
  return ownerIdOf(row) === A.num(userId) ? row : null;
}

function serializeAddress(row) {
  return {
    id: row.id,
    label: row.label || '',
    street: row.street || '',
    barangay: row.barangay || '',
    municipality: row.municipality || '',
    province: row.province || 'Oriental Mindoro',
    latitude: row.latitude ? A.num(row.latitude) : null,
    longitude: row.longitude ? A.num(row.longitude) : null,
    isDefault: Boolean(row.isDefault),
  };
}

async function createAddressRow(userId, input, { save }) {
  const body = input || {};
  const barangay = String(body.barangay || '').trim();
  const municipality = String(body.municipality || '').trim();
  if (!barangay || !municipality) {
    throw Object.assign(new Error('Add the barangay and municipality for delivery.'), { status: 400, expose: true });
  }

  let makeDefault = Boolean(body.isDefault);
  if (save) {
    const existing = await strapi.db.query(A.UID.address).findMany({ where: { user: userId }, limit: 20 });
    if (existing.length >= 20) {
      throw Object.assign(new Error('You can save up to 20 addresses.'), { status: 400, expose: true });
    }
    if (existing.length === 0) makeDefault = true;
    if (makeDefault) {
      await strapi.db.query(A.UID.address).updateMany({ where: { user: userId }, data: { isDefault: false } });
    }
  } else {
    makeDefault = false;
  }

  return strapi.db.query(A.UID.address).create({
    data: {
      user: save ? userId : null,
      label: String(body.label || 'Delivery').slice(0, 60),
      street: String(body.street || '').trim().slice(0, 200),
      barangay: barangay.slice(0, 120),
      municipality: municipality.slice(0, 120),
      province: String(body.province || 'Oriental Mindoro').slice(0, 120),
      ...A.coordinates(body),
      isDefault: makeDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

async function resolveAddress(user, body, fulfillmentType) {
  if (fulfillmentType === 'pickup') return null;
  if (body.addressId) {
    const row = await addressOwnedBy(user.id, body.addressId);
    if (!row) {
      throw Object.assign(new Error('Choose one of your saved addresses.'), { status: 400, expose: true });
    }
    return row;
  }
  if (body.address) {
    return createAddressRow(user.id, body.address, { save: Boolean(body.saveAddress) });
  }
  throw Object.assign(new Error('Choose a delivery address.'), { status: 400, expose: true });
}

async function loadCartProducts(items) {
  const wanted = new Map();
  for (const item of items) {
    const productId = A.num(item.productId ?? item.id);
    const quantity = Math.floor(A.num(item.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error('One of the cart items is not valid.'), { status: 400, expose: true });
    }
    if (quantity > 99) {
      throw Object.assign(new Error('The most you can order of one item is 99.'), { status: 400, expose: true });
    }
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }
  if (wanted.size === 0) {
    throw Object.assign(new Error('Your cart is empty.'), { status: 400, expose: true });
  }

  const rows = await strapi.db.query(A.UID.product).findMany({
    where: { id: { $in: [...wanted.keys()] } },
    populate: { category: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const lines = [];
  for (const [productId, quantity] of wanted.entries()) {
    const product = byId.get(productId);
    if (!product || product.isActive === false) {
      throw Object.assign(new Error('One of the products is no longer available. Remove it and try again.'), {
        status: 400,
        expose: true,
      });
    }
    const available = A.num(product.stockQty);
    if (quantity > available) {
      const message = available <= 0
        ? `${product.name} is out of stock.`
        : `Only ${available} ${product.unit || 'piece'} of ${product.name} left.`;
      const error = new Error(message);
      error.status = 400;
      error.expose = true;
      error.details = { productId: product.id, name: product.name, available };
      throw error;
    }
    const unitPrice = A.num(product.price);
    lines.push({
      product,
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity,
    });
  }
  return lines;
}

function orderSummary(lines, fulfillmentType, municipality, settings) {
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const deliveryFee = A.deliveryFeeFor(municipality, subtotal, settings, fulfillmentType);
  return { subtotal, deliveryFee, total: subtotal + deliveryFee };
}

/**
 * Ask PayMongo for the state of an order's checkout session and apply it.
 * This is the fallback for local development, where PayMongo cannot reach a
 * webhook on localhost: the customer lands back on the confirmation page and
 * the browser asks the API to pull the latest session state.
 */
async function syncOrderPayment(order, user) {
  const payment = order && order.payment;
  if (!payment) return { synced: false, reason: 'no-payment', order: order ? A.serializeOrder(order) : null };
  if (payment.method === 'cod') return { synced: false, reason: 'cod', order: A.serializeOrder(order) };
  if (payment.status === 'paid') return { synced: true, paid: true, order: A.serializeOrder(order) };

  const ref = String(payment.paymongoRef || '');
  if (!ref) return { synced: false, reason: 'no-session', order: A.serializeOrder(order) };

  // PayPal order ids do not start with cs_. This also lets a stored order be
  // confirmed after the configured gateway changes.
  if (!ref.startsWith('cs_')) {
    if (!paypal.configured()) {
      return { synced: false, reason: 'not-configured', order: A.serializeOrder(order) };
    }
    const captured = await paypal.captureOrder(ref);
    if (captured.status === 'COMPLETED') {
      const updated = await A.markOrderPaid(order.id, { user });
      return { synced: true, paid: true, status: captured.status, order: updated };
    }
    const fresh = await A.getOrderById(order.id);
    return {
      synced: true,
      paid: false,
      status: captured.status || 'pending',
      order: A.serializeOrder(fresh),
    };
  }

  if (!paymongo.configured()) {
    return { synced: false, reason: 'not-configured', order: A.serializeOrder(order) };
  }

  const session = await paymongo.retrieveCheckoutSession(ref);
  if (session.paid) {
    const updated = await A.markOrderPaid(order.id, { paymongoRef: session.id, user });
    return { synced: true, paid: true, status: session.status, order: updated };
  }

  if (session.status === 'expired') {
    await strapi.db.query(A.UID.payment).update({
      where: { id: payment.id },
      data: { status: 'failed', updatedAt: new Date() },
    });
  }
  const fresh = await A.getOrderById(order.id);
  return {
    synced: true,
    paid: false,
    status: session.status || 'pending',
    order: A.serializeOrder(fresh),
  };
}

module.exports = {
  /** POST /api/checkout — create an order from the cart. */
  async create(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['customer']);
      if (!user) return;

      const body = ctx.request.body || {};
      const items = Array.isArray(body.items) ? body.items : [];
      const fulfillmentType = body.fulfillmentType === 'pickup' ? 'pickup' : 'delivery';
      const method = PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : 'cod';
      const notes = String(body.notes || '').slice(0, 1000);
      const provider = onlineProvider();
      if (method !== 'cod' && provider === 'paymongo' && !paymongo.webhookConfigured()) {
        strapi.log.warn('[paymongo] PAYMONGO_WEBHOOK_SECRET is empty; online payments rely on the return-page sync.');
      }
      if (method !== 'cod' && provider === 'simulated' && process.env.NODE_ENV === 'production') {
        return A.fail(ctx, 503, 'Online payment is not configured. Choose cash on delivery or contact the store.');
      }

      const settings = await A.getSettings();
      const lines = await loadCartProducts(items);
      const address = await resolveAddress(user, body, fulfillmentType);
      const municipality = fulfillmentType === 'pickup'
        ? ''
        : String((address && address.municipality) || '').trim();
      const summary = orderSummary(lines, fulfillmentType, municipality, settings);

      const orderNumber = await A.nextOrderNumber();
      const now = new Date();
      const order = await strapi.db.query(A.UID.order).create({
        data: {
          orderNumber,
          user: user.id,
          address: address ? address.id : null,
          fulfillmentType,
          deliveryFee: summary.deliveryFee,
          totalAmount: summary.total,
          status: 'pending',
          municipality,
          notes,
          stockDeducted: false,
          statusHistory: [{ status: 'pending', at: now.toISOString(), by: user.fullName || user.username || 'Customer' }],
          createdAt: now,
          updatedAt: now,
        },
      });

      for (const line of lines) {
        await strapi.db.query(A.UID.orderItem).create({
          data: {
            order: order.id,
            product: line.product.id,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            createdAt: now,
            updatedAt: now,
          },
        });
      }

      const payment = await strapi.db.query(A.UID.payment).create({
        data: {
          order: order.id,
          method,
          amount: summary.total,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        },
      });

      let mode = 'cod';
      let checkoutUrl = null;
      let sessionId = null;
      let notice = '';

      if (method !== 'cod') {
        const reference = `AGM-${String(orderNumber).padStart(5, '0')}`;
        const successUrl = `${frontendBase()}/order-confirmation?order=${order.id}&payment=success`;
        const cancelUrl = `${frontendBase()}/order-confirmation?order=${order.id}&payment=cancelled`;

        if (provider === 'paymongo') {
          try {
            const session = await paymongo.createCheckoutSession({
              items: [
                ...lines.map((line) => ({
                  name: line.product.name,
                  description: `${line.quantity} x ${A.money(line.unitPrice)}`,
                  amount: line.unitPrice,
                  quantity: line.quantity,
                })),
                ...(summary.deliveryFee > 0 ? [{
                  name: 'Delivery fee',
                  description: municipality,
                  amount: summary.deliveryFee,
                  quantity: 1,
                }] : []),
              ],
              amount: summary.total,
              description: `${settings.storeName || 'AgriMart'} order ${reference}`,
              referenceNumber: reference,
              metadata: { orderId: String(order.id), orderNumber: String(orderNumber) },
              successUrl,
              cancelUrl,
              methods: [PAYMONGO_METHOD_MAP[method] || 'card'],
            });
            if (!session.id || !session.checkoutUrl) {
              throw new Error('PayMongo did not return a usable checkout link.');
            }
            mode = 'paymongo';
            checkoutUrl = session.checkoutUrl;
            sessionId = session.id;
            await strapi.db.query(A.UID.payment).update({
              where: { id: payment.id },
              data: { paymongoRef: session.id, updatedAt: new Date() },
            });
          } catch (err) {
            strapi.log.warn(`[paymongo] checkout session failed: ${err.message}`);
            if (process.env.NODE_ENV === 'production') {
              await A.setOrderStatus(order.id, 'cancelled', user);
              return A.fail(ctx, 502, 'Online payment could not be started. Your cart is still saved; try again or choose cash on delivery.');
            }
            mode = 'simulated';
            notice = 'Online payment is temporarily unavailable, so this order uses the sandbox simulator.';
          }
        } else if (provider === 'paypal') {
          try {
            const paypalOrder = await paypal.createOrder({
              amount: summary.total,
              reference,
              description: `${settings.storeName || 'AgriMart'} order ${reference}`,
              orderId: order.id,
              returnUrl: successUrl,
              cancelUrl,
            });
            if (!paypalOrder.id || !paypalOrder.approveUrl) {
              throw new Error('PayPal did not return an approval link.');
            }
            mode = 'paypal';
            checkoutUrl = paypalOrder.approveUrl;
            sessionId = paypalOrder.id;
            await strapi.db.query(A.UID.payment).update({
              where: { id: payment.id },
              data: { paymongoRef: paypalOrder.id, updatedAt: new Date() },
            });
          } catch (err) {
            strapi.log.warn(`[paypal] order creation failed: ${err.message}`);
            if (process.env.NODE_ENV === 'production') {
              await A.setOrderStatus(order.id, 'cancelled', user);
              return A.fail(ctx, 502, 'PayPal could not start the payment. Your cart is still saved; try again or choose cash on delivery.');
            }
            mode = 'simulated';
            notice = 'PayPal is temporarily unavailable, so this order uses the sandbox simulator.';
          }
        } else {
          mode = 'simulated';
          notice = 'No payment gateway is configured, so this order uses the sandbox simulator.';
        }
      }

      const serialized = A.serializeOrder(await A.getOrderById(order.id));
      await A.sendOrderMail(
        serialized,
        `Order ${serialized.reference} received`,
        method === 'cod'
          ? 'We received your order. Pay in cash when it arrives or when you pick it up.'
          : 'We received your order. Complete the payment to confirm it.'
      );

      ctx.body = {
        data: {
          order: serialized,
          payment: {
            id: payment.id,
            method,
            status: 'pending',
            mode,
            checkoutUrl,
            sessionId,
            notice,
            simulateUrl: mode === 'simulated' ? `/api/checkout/${order.id}/simulate-pay` : null,
          },
        },
      };
    });
  },

  /** GET /api/checkout/mine — the signed-in customer's orders. */
  async mine(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const status = ctx.query?.status;
      const orders = await A.listOrders({
        userId: user.id,
        status: A.ORDER_STATUSES.includes(status) ? status : undefined,
        limit: A.num(ctx.query?.limit, 100),
      });
      ctx.body = { data: orders };
    });
  },

  /** GET /api/checkout/mine/:id — one of the signed-in customer's orders. */
  async mineOne(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const order = await A.getOrderById(ctx.params.id);
      if (!order) return A.fail(ctx, 404, 'Order not found.');
      const ownerId = ownerIdOf(order);
      const privileged = ['staff', 'admin'].includes(user.roleName || 'customer');
      if (ownerId !== user.id && !privileged) return A.fail(ctx, 404, 'Order not found.');
      ctx.body = { data: A.serializeOrder(order) };
    });
  },

  /** POST /api/checkout/:id/cancel — cancel a pending or paid order. */
  async cancel(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const order = await A.getOrderById(ctx.params.id);
      if (!order) return A.fail(ctx, 404, 'Order not found.');
      const privileged = ['staff', 'admin'].includes(user.roleName || 'customer');
      if (ownerIdOf(order) !== user.id && !privileged) return A.fail(ctx, 404, 'Order not found.');
      if (!['pending', 'paid'].includes(order.status)) {
        return A.fail(ctx, 400, 'This order is already being prepared. Call the store to change it.');
      }
      const updated = await A.setOrderStatus(order.id, 'cancelled', user);
      ctx.body = { data: updated };
    });
  },

  /** POST /api/checkout/:id/sync-payment - confirm the gateway payment state. */
  async syncPayment(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const order = await A.getOrderById(ctx.params.id);
      if (!order) return A.fail(ctx, 404, 'Order not found.');
      const privileged = ['staff', 'admin'].includes(user.roleName || 'customer');
      if (ownerIdOf(order) !== user.id && !privileged) return A.fail(ctx, 404, 'Order not found.');
      const result = await syncOrderPayment(order, user).catch(async (err) => {
        // A gateway timeout or a transient PayPal error should not break the
        // return page; report the order as pending and let the page retry.
        strapi.log.warn(`[payment-sync] order ${order.id}: ${err.message}`);
        const fresh = await A.getOrderById(order.id);
        return {
          synced: true,
          paid: fresh?.payment?.status === 'paid',
          status: 'pending',
          message: 'The payment provider did not answer yet. Refresh in a moment.',
          order: A.serializeOrder(fresh),
        };
      });
      if (!result.synced && result.reason === 'not-configured') {
        return A.fail(ctx, 503, 'Online payment is not configured on this server.');
      }
      ctx.body = { data: result };
    });
  },

  /** POST /api/checkout/:id/simulate-pay - sandbox payment success without PayMongo. */
  async simulatePay(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      if (process.env.NODE_ENV === 'production') {
        return A.fail(ctx, 403, 'The payment simulator is disabled in production.');
      }
      const order = await A.getOrderById(ctx.params.id);
      if (!order) return A.fail(ctx, 404, 'Order not found.');
      const privileged = ['staff', 'admin'].includes(user.roleName || 'customer');
      if (ownerIdOf(order) !== user.id && !privileged) return A.fail(ctx, 404, 'Order not found.');
      if (order.status === 'cancelled') return A.fail(ctx, 400, 'This order was cancelled.');
      if (order.payment && order.payment.method === 'cod') {
        return A.fail(ctx, 400, 'Cash on delivery orders are paid on handover.');
      }
      const paid = await A.markOrderPaid(order.id, {
        paymongoRef: order.payment?.paymongoRef || `sim_${Date.now()}`,
        user,
      });
      ctx.body = { data: paid };
    });
  },
};
