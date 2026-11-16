'use strict';

module.exports = {
  routes: [
    { method: 'POST', path: '/reviews', handler: 'review.create', config: { auth: false } },
    { method: 'GET', path: '/reviews/mine', handler: 'review.mine', config: { auth: false } },
    { method: 'GET', path: '/reviews/eligibility/:productId', handler: 'review.eligibility', config: { auth: false } },
  ],
};
