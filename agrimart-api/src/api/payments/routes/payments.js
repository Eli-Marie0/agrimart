'use strict';

module.exports = {
  routes: [
    { method: 'POST', path: '/payments/paymongo/webhook', handler: 'payments.webhook', config: { auth: false } },
    { method: 'GET', path: '/payments/methods', handler: 'payments.methods', config: { auth: false } },
    { method: 'GET', path: '/payments/paymongo/verify/:sessionId', handler: 'payments.verify', config: { auth: false } },
  ],
};
