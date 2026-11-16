'use strict';

// Payments are managed through the custom /api/payments and /api/checkout
// routes. The content-type router is disabled so its GET /payments/:id route
// cannot shadow custom paths such as /payments/methods.
module.exports = {
  routes: [],
};
