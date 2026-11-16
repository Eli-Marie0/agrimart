'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/reports/summary', handler: 'reports.summary', config: { auth: false } },
    { method: 'GET', path: '/reports/sales', handler: 'reports.sales', config: { auth: false } },
    { method: 'GET', path: '/reports/inventory', handler: 'reports.inventory', config: { auth: false } },
    { method: 'GET', path: '/reports/export.csv', handler: 'reports.exportCsv', config: { auth: false } },
  ],
};
