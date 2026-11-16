'use strict';

const A = require('../../../lib/agrimart');

function rangeFromQuery(query) {
  const to = A.parseDate(query?.to, new Date());
  const from = A.parseDate(query?.from, new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));
  return { from: A.startOfDay(from), to: A.endOfDay(to) };
}

async function findAllOrders(where, orderBy) {
  const rows = [];
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const page = await strapi.db.query(A.UID.order).findMany({
      where,
      populate: A.orderPopulate(),
      orderBy,
      limit: pageSize,
      offset,
    });
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += page.length;
  }
}

async function ordersInRange(from, to) {
  return findAllOrders({ createdAt: { $gte: from, $lte: to } }, [{ createdAt: 'desc' }]);
}

async function paidOrdersInRange(from, to) {
  return findAllOrders({
    payment: { status: 'paid', paidAt: { $gte: from, $lte: to } },
  }, [{ createdAt: 'desc' }]);
}

function totalsFor(orders, paidOrders = orders) {
  const sold = paidOrders.filter((order) => order.payment?.status === 'paid');
  const sales = sold.reduce((sum, order) => sum + A.num(order.totalAmount), 0);
  const itemsSold = sold.reduce((sum, order) => sum + (order.items || [])
    .reduce((itemSum, item) => itemSum + A.num(item.quantity), 0), 0);
  return {
    sales,
    paidOrders: sold.length,
    orders: orders.length,
    itemsSold,
    averageOrder: sold.length ? sales / sold.length : 0,
    pending: orders.filter((order) => order.status === 'pending').length,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
  };
}

function seriesFor(orders, from, to) {
  const first = A.startOfDay(from);
  const last = A.startOfDay(to);
  const daySpan = Math.max(1, Math.ceil((last - first) / 86400000) + 1);
  const period = daySpan <= 90 ? 'day' : daySpan <= 1825 ? 'month' : 'year';
  const cursor = period === 'day'
    ? first
    : period === 'month'
      ? new Date(first.getFullYear(), first.getMonth(), 1)
      : new Date(first.getFullYear(), 0, 1);
  const byPeriod = new Map();
  while (cursor <= last) {
    const date = A.dateKey(cursor);
    const key = period === 'day' ? date : period === 'month' ? date.slice(0, 7) : date.slice(0, 4);
    byPeriod.set(key, { date: key, period, sales: 0, orders: 0 });
    if (period === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (period === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setFullYear(cursor.getFullYear() + 1);
  }
  for (const order of orders) {
    if (order.payment?.status !== 'paid' || !order.payment.paidAt) continue;
    const paidDate = A.dateKey(order.payment.paidAt);
    const key = period === 'day' ? paidDate : period === 'month' ? paidDate.slice(0, 7) : paidDate.slice(0, 4);
    const entry = byPeriod.get(key);
    if (!entry) continue;
    entry.sales += A.num(order.totalAmount);
    entry.orders += 1;
  }
  return [...byPeriod.values()];
}

function topProductsFor(orders, limit = 10) {
  const map = new Map();
  for (const order of orders) {
    if (order.payment?.status !== 'paid') continue;
    for (const item of order.items || []) {
      const product = item.product;
      if (!product) continue;
      const entry = map.get(product.id) || {
        id: product.id,
        name: product.name,
        slug: product.slug,
        unit: product.unit || '',
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += A.num(item.quantity);
      entry.revenue += A.num(item.subtotal);
      map.set(product.id, entry);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, Math.min(50, Math.max(1, limit)));
}

async function inventorySummary() {
  const products = await strapi.db.query(A.UID.product).findMany({
    where: { isActive: true },
    orderBy: [{ stockQty: 'asc' }],
    limit: 500,
  });
  let units = 0;
  let retailValue = 0;
  let lowStock = 0;
  let outOfStock = 0;
  const rows = products.map((product) => {
    const qty = A.num(product.stockQty);
    const value = qty * A.num(product.price);
    units += qty;
    retailValue += value;
    const low = qty <= A.num(product.reorderLevel, 10);
    if (low) lowStock += 1;
    if (qty <= 0) outOfStock += 1;
    return {
      ...A.serializeProduct(product),
      value,
      low,
    };
  });
  return { rows, units, retailValue, lowStock, outOfStock, products: products.length };
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  const header = columns.map((column) => csvEscape(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => csvEscape(
    typeof column.value === 'function' ? column.value(row) : row[column.value]
  )).join(','));
  return [header, ...body].join('\r\n');
}

function sendCsv(ctx, filename, csv) {
  ctx.set('Content-Type', 'text/csv; charset=utf-8');
  ctx.set('Content-Disposition', `attachment; filename="${filename}"`);
  ctx.body = `\uFEFF${csv}`;
}

async function requireAdmin(ctx) {
  return A.requireRole(ctx, ['admin']);
}

module.exports = {
  /** GET /api/reports/summary */
  async summary(ctx) {
    return A.guard(async () => {
      if (!await requireAdmin(ctx)) return;
      const { from, to } = rangeFromQuery(ctx.query);
      const [orders, paidOrders] = await Promise.all([
        ordersInRange(from, to),
        paidOrdersInRange(from, to),
      ]);
      const totals = totalsFor(orders, paidOrders);
      const now = new Date();
      const dayStart = A.startOfDay(now);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const [todaySales, monthSales, yearSales] = await Promise.all([
        paidOrdersInRange(dayStart, A.endOfDay(now)),
        paidOrdersInRange(monthStart, A.endOfDay(now)),
        paidOrdersInRange(yearStart, A.endOfDay(now)),
      ]);
      const inventory = await inventorySummary();
      const topProducts = topProductsFor(paidOrders, 5);

      const paymentMap = new Map();
      for (const order of paidOrders) {
        if (!order.payment) continue;
        const method = order.payment.method || 'unknown';
        const entry = paymentMap.get(method) || { method, count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += A.num(order.totalAmount);
        paymentMap.set(method, entry);
      }

      const lowStock = inventory.rows.filter((row) => row.low).slice(0, 8);
      const recentOrders = orders.slice(0, 6).map((order) => A.serializeOrder(order));

      ctx.body = {
        data: {
          range: { from: from.toISOString(), to: to.toISOString() },
          totals,
          periods: {
            today: totalsFor([], todaySales),
            month: totalsFor([], monthSales),
            year: totalsFor([], yearSales),
          },
          series: seriesFor(paidOrders, from, to),
          statusCounts: orders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
          }, {}),
          paymentBreakdown: [...paymentMap.values()],
          inventory: {
            products: inventory.products,
            units: inventory.units,
            retailValue: inventory.retailValue,
            lowStock: inventory.lowStock,
            outOfStock: inventory.outOfStock,
          },
          lowStock,
          topProducts,
          recentOrders,
        },
      };
    });
  },

  /** GET /api/reports/sales */
  async sales(ctx) {
    return A.guard(async () => {
      if (!await requireAdmin(ctx)) return;
      const { from, to } = rangeFromQuery(ctx.query);
      const [orders, paidOrders] = await Promise.all([
        ordersInRange(from, to),
        paidOrdersInRange(from, to),
      ]);
      ctx.body = {
        data: {
          range: { from: from.toISOString(), to: to.toISOString() },
          totals: totalsFor(orders, paidOrders),
          series: seriesFor(paidOrders, from, to),
          topProducts: topProductsFor(paidOrders, 10),
          orders: orders.map((order) => A.serializeOrder(order)),
        },
      };
    });
  },

  /** GET /api/reports/inventory */
  async inventory(ctx) {
    return A.guard(async () => {
      if (!await requireAdmin(ctx)) return;
      const inventory = await inventorySummary();
      ctx.body = {
        data: {
          rows: inventory.rows,
          totals: {
            products: inventory.products,
            units: inventory.units,
            retailValue: inventory.retailValue,
            lowStock: inventory.lowStock,
            outOfStock: inventory.outOfStock,
          },
          logs: await A.listInventoryLogs({ limit: 50 }),
        },
      };
    });
  },

  /** GET /api/reports/export.csv?type=sales|inventory|orders|top-products */
  async exportCsv(ctx) {
    return A.guard(async () => {
      if (!await requireAdmin(ctx)) return;
      const type = String(ctx.query?.type || 'sales');
      const { from, to } = rangeFromQuery(ctx.query);
      const stamp = `${A.dateKey(from)}_${A.dateKey(to)}`;

      if (type === 'inventory') {
        const inventory = await inventorySummary();
        const csv = toCsv(inventory.rows, [
          { label: 'Product', value: 'name' },
          { label: 'Brand', value: 'brand' },
          { label: 'Category', value: (row) => row.category?.name || '' },
          { label: 'Unit', value: 'unit' },
          { label: 'Price', value: (row) => A.num(row.price).toFixed(2) },
          { label: 'On hand', value: 'stockQty' },
          { label: 'Reorder level', value: 'reorderLevel' },
          { label: 'Stock status', value: (row) => row.stock.label },
          { label: 'Retail value', value: (row) => A.num(row.value).toFixed(2) },
          { label: 'Active', value: (row) => row.isActive ? 'yes' : 'no' },
        ]);
        return sendCsv(ctx, `agrimart_inventory_${A.dateKey(new Date())}.csv`, csv);
      }

      const orders = await ordersInRange(from, to);
      const paidOrders = await paidOrdersInRange(from, to);

      if (type === 'top-products') {
        const rows = topProductsFor(paidOrders, 100);
        const csv = toCsv(rows, [
          { label: 'Product', value: 'name' },
          { label: 'Unit', value: 'unit' },
          { label: 'Units sold', value: 'quantity' },
          { label: 'Revenue', value: (row) => A.num(row.revenue).toFixed(2) },
        ]);
        return sendCsv(ctx, `agrimart_top_products_${stamp}.csv`, csv);
      }

      if (type === 'orders') {
        const rows = orders.map((order) => A.serializeOrder(order));
        const csv = toCsv(rows, [
          { label: 'Reference', value: 'reference' },
          { label: 'Date', value: (row) => new Date(row.createdAt).toISOString() },
          { label: 'Customer', value: (row) => row.customer?.fullName || '' },
          { label: 'Email', value: (row) => row.customer?.email || '' },
          { label: 'Fulfillment', value: 'fulfillmentType' },
          { label: 'Municipality', value: 'municipality' },
          { label: 'Status', value: 'status' },
          { label: 'Payment', value: (row) => row.payment?.method || '' },
          { label: 'Payment status', value: (row) => row.payment?.status || '' },
          { label: 'Subtotal', value: (row) => A.num(row.subtotal).toFixed(2) },
          { label: 'Delivery fee', value: (row) => A.num(row.deliveryFee).toFixed(2) },
          { label: 'Total', value: (row) => A.num(row.totalAmount).toFixed(2) },
        ]);
        return sendCsv(ctx, `agrimart_orders_${stamp}.csv`, csv);
      }

      const rows = paidOrders.map((order) => A.serializeOrder(order));
      const csv = toCsv(rows, [
        { label: 'Paid at', value: (row) => row.payment?.paidAt ? new Date(row.payment.paidAt).toISOString() : '' },
        { label: 'Reference', value: 'reference' },
        { label: 'Status', value: 'status' },
        { label: 'Customer', value: (row) => row.customer?.fullName || '' },
        { label: 'Payment method', value: (row) => row.payment?.method || '' },
        { label: 'Sales', value: (row) => row.payment?.status === 'paid' ? A.num(row.totalAmount).toFixed(2) : '0.00' },
        { label: 'Delivery fee', value: (row) => A.num(row.deliveryFee).toFixed(2) },
        { label: 'Municipality', value: 'municipality' },
      ]);
      return sendCsv(ctx, `agrimart_sales_${stamp}.csv`, csv);
    });
  },
};
