'use strict';

module.exports = {
  routes: [
    { method: 'POST', path: '/account/register', handler: 'account.register', config: { auth: false } },
    { method: 'POST', path: '/account/login', handler: 'account.login', config: { auth: false } },
    { method: 'POST', path: '/account/logout', handler: 'account.logout', config: { auth: false } },
    { method: 'GET', path: '/account/me', handler: 'account.me', config: { auth: false } },
    { method: 'PATCH', path: '/account/me', handler: 'account.updateMe', config: { auth: false } },
    { method: 'POST', path: '/account/change-password', handler: 'account.changePassword', config: { auth: false } },
    { method: 'POST', path: '/account/forgot-password', handler: 'account.forgotPassword', config: { auth: false } },
    { method: 'POST', path: '/account/reset-password', handler: 'account.resetPassword', config: { auth: false } },
    { method: 'GET', path: '/account/addresses', handler: 'account.addresses', config: { auth: false } },
    { method: 'POST', path: '/account/addresses', handler: 'account.createAddress', config: { auth: false } },
    { method: 'PUT', path: '/account/addresses/:id', handler: 'account.updateAddress', config: { auth: false } },
    { method: 'DELETE', path: '/account/addresses/:id', handler: 'account.deleteAddress', config: { auth: false } },
  ],
};
