'use strict';

module.exports = {
  routes: [
    { method: 'POST', path: '/checkout', handler: 'checkout.create', config: { auth: false } },
    { method: 'GET', path: '/checkout/mine', handler: 'checkout.mine', config: { auth: false } },
    { method: 'GET', path: '/checkout/mine/:id', handler: 'checkout.mineOne', config: { auth: false } },
    { method: 'POST', path: '/checkout/:id/cancel', handler: 'checkout.cancel', config: { auth: false } },
    { method: 'POST', path: '/checkout/:id/sync-payment', handler: 'checkout.syncPayment', config: { auth: false } },
    { method: 'POST', path: '/checkout/:id/simulate-pay', handler: 'checkout.simulatePay', config: { auth: false } },
  ],
};
