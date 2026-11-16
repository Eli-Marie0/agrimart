'use strict';

const A = require('../../../lib/agrimart');

async function dailySales(date) {
  const rows = await strapi.db.query(A.UID.order).findMany({
    where: {
      createdAt: { $gte: A.startOfDay(date), $lte: A.endOfDay(date) },
      status: { $in: ['paid', 'preparing', 'out_for_delivery', 'completed'] },
    },
    select: ['totalAmount', 'status'],
  });
  return rows.reduce((sum, row) => sum + A.num(row.totalAmount), 0);
}

async function orderCountForDay(date) {
  return strapi.db.query(A.UID.order).count({
    where: { createdAt: { $gte: A.startOfDay(date), $lte: A.endOfDay(date) } },
  });
}

module.exports = {
  /** GET /api/ops/dashboard */
  async dashboard(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const now = new Date();
      const [todayOrders, todaySales, lowStock, orders, logs, pending] = await Promise.all([
        orderCountForDay(now),
        dailySales(now),
        A.listLowStock(),
        A.listOrders({ limit: 8 }),
        A.listInventoryLogs({ limit: 8 }),
        strapi.db.query(A.UID.order).count({ where: { status: 'pending' } }),
      ]);
      ctx.body = {
        data: {
          todayOrders,
          todaySales,
          pendingOrders: pending,
          lowStockCount: lowStock.length,
          lowStock: lowStock.slice(0, 6),
          recentOrders: orders,
          recentLogs: logs,
          user: A.sanitizeUser(user),
        },
      };
    });
  },

  /** GET /api/ops/orders */
  async orders(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const query = ctx.query || {};
      const orders = await A.listOrders({
        status: A.ORDER_STATUSES.includes(query.status) ? query.status : undefined,
        from: query.from,
        to: query.to,
        limit: A.num(query.limit, 100),
      });
      const q = String(query.q || '').trim().toLowerCase();
      const filtered = q
        ? orders.filter((order) => [
          order.reference,
          String(order.orderNumber || ''),
          order.customer?.fullName,
          order.customer?.email,
          order.municipality,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)))
        : orders;
      ctx.body = { data: filtered };
    });
  },

  /** GET /api/ops/orders/:id */
  async order(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const order = await A.getOrderById(ctx.params.id);
      if (!order) return A.fail(ctx, 404, 'Order not found.');
      ctx.body = { data: A.serializeOrder(order) };
    });
  },

  /** PATCH /api/ops/orders/:id/status */
  async updateOrderStatus(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const body = ctx.request.body || {};
      const status = String(body.status || '');
      if (!A.ORDER_STATUSES.includes(status)) return A.fail(ctx, 400, 'Choose a valid order status.');
      const updated = await A.setOrderStatus(ctx.params.id, status, user);
      ctx.body = { data: updated };
    });
  },

  /** PATCH /api/ops/orders/:id/tracking — staff shares a GPS location update. */
  async updateOrderTracking(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const order = await A.getOrderById(ctx.params.id);
      if (!order) return A.fail(ctx, 404, 'Order not found.');
      if (order.fulfillmentType !== 'delivery') return A.fail(ctx, 400, 'Only delivery orders can have a tracking location.');
      if (order.status !== 'out_for_delivery') return A.fail(ctx, 400, 'Set the order to out for delivery before sharing its location.');

      const point = A.coordinates(ctx.request.body || {});
      if (point.latitude === null || point.longitude === null) {
        return A.fail(ctx, 400, 'Share the device location before saving a tracking update.');
      }
      const now = new Date();
      await strapi.db.query(A.UID.order).update({
        where: { id: order.id },
        data: {
          trackingLatitude: point.latitude,
          trackingLongitude: point.longitude,
          trackingNote: String(ctx.request.body?.note || '').trim().slice(0, 160),
          trackingUpdatedAt: now,
          trackingUpdatedBy: user.fullName || user.username || 'Store staff',
          updatedAt: now,
        },
      });
      ctx.body = { data: A.serializeOrder(await A.getOrderById(order.id)) };
    });
  },

  /** GET /api/ops/inventory — products, low stock and the stock log. */
  async inventory(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const products = await A.adminListProducts({ sort: 'name', pageSize: 100 });
      const [lowStock, logs] = await Promise.all([
        A.listLowStock(),
        A.listInventoryLogs({ limit: A.num(ctx.query?.limit, 50), productId: ctx.query?.productId }),
      ]);
      ctx.body = {
        data: {
          products: products.products,
          lowStock,
          logs,
          reorderDefault: A.num((await A.getSettings()).defaultReorderLevel, 10),
        },
      };
    });
  },

  /** POST /api/ops/inventory/stock-in */
  async stockIn(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const body = ctx.request.body || {};
      const result = await A.recordStockChange({
        productId: body.productId,
        changeQty: A.num(body.changeQty),
        reason: ['stock_in', 'adjustment', 'spoilage'].includes(body.reason) ? body.reason : 'stock_in',
        user,
        note: body.note,
      });
      ctx.body = { data: result };
    });
  },

  /** POST /api/ops/inventory/adjust */
  async adjust(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const body = ctx.request.body || {};
      const reason = ['adjustment', 'spoilage'].includes(body.reason) ? body.reason : 'adjustment';
      const result = await A.recordStockChange({
        productId: body.productId,
        changeQty: A.num(body.changeQty),
        reason,
        user,
        note: body.note,
      });
      ctx.body = { data: result };
    });
  },

  /** GET /api/ops/customers — quick lookup of customers. */
  async customers(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['staff', 'admin']);
      if (!user) return;
      const rows = await strapi.db.query(A.UID.user).findMany({
        where: { roleName: 'customer' },
        orderBy: [{ createdAt: 'desc' }],
        limit: 100,
      });
      ctx.body = { data: rows.map(A.sanitizeUser) };
    });
  },
};
