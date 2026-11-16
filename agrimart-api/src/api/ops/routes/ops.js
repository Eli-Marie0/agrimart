'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/ops/dashboard', handler: 'ops.dashboard', config: { auth: false } },
    { method: 'GET', path: '/ops/orders', handler: 'ops.orders', config: { auth: false } },
    { method: 'GET', path: '/ops/orders/:id', handler: 'ops.order', config: { auth: false } },
    { method: 'PATCH', path: '/ops/orders/:id/status', handler: 'ops.updateOrderStatus', config: { auth: false } },
    { method: 'PATCH', path: '/ops/orders/:id/tracking', handler: 'ops.updateOrderTracking', config: { auth: false } },
    { method: 'GET', path: '/ops/inventory', handler: 'ops.inventory', config: { auth: false } },
    { method: 'POST', path: '/ops/inventory/stock-in', handler: 'ops.stockIn', config: { auth: false } },
    { method: 'POST', path: '/ops/inventory/adjust', handler: 'ops.adjust', config: { auth: false } },
    { method: 'GET', path: '/ops/customers', handler: 'ops.customers', config: { auth: false } },
  ],
};
