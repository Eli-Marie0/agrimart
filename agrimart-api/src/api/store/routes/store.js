'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/store/home', handler: 'store.home', config: { auth: false } },
    { method: 'GET', path: '/store/products', handler: 'store.products', config: { auth: false } },
    { method: 'GET', path: '/store/products/:slug', handler: 'store.product', config: { auth: false } },
    { method: 'GET', path: '/store/categories', handler: 'store.categories', config: { auth: false } },
    { method: 'GET', path: '/store/brands', handler: 'store.brands', config: { auth: false } },
    { method: 'GET', path: '/store/announcements', handler: 'store.announcements', config: { auth: false } },
    { method: 'GET', path: '/store/content', handler: 'store.content', config: { auth: false } },
    { method: 'GET', path: '/store/settings', handler: 'store.settings', config: { auth: false } },
    { method: 'POST', path: '/store/contact', handler: 'store.contact', config: { auth: false } },
  ],
};
