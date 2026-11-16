'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/admin/products', handler: 'admin.products', config: { auth: false } },
    { method: 'POST', path: '/admin/products', handler: 'admin.createProduct', config: { auth: false } },
    { method: 'GET', path: '/admin/products/:id', handler: 'admin.product', config: { auth: false } },
    { method: 'PUT', path: '/admin/products/:id', handler: 'admin.updateProduct', config: { auth: false } },
    { method: 'DELETE', path: '/admin/products/:id', handler: 'admin.deleteProduct', config: { auth: false } },
    { method: 'POST', path: '/admin/product-image', handler: 'admin.uploadProductImage', config: { auth: false } },

    { method: 'GET', path: '/admin/categories', handler: 'admin.categories', config: { auth: false } },
    { method: 'POST', path: '/admin/categories', handler: 'admin.createCategory', config: { auth: false } },
    { method: 'PUT', path: '/admin/categories/:id', handler: 'admin.updateCategory', config: { auth: false } },
    { method: 'DELETE', path: '/admin/categories/:id', handler: 'admin.deleteCategory', config: { auth: false } },

    { method: 'GET', path: '/admin/users', handler: 'admin.users', config: { auth: false } },
    { method: 'POST', path: '/admin/users', handler: 'admin.createUser', config: { auth: false } },
    { method: 'PATCH', path: '/admin/users/:id', handler: 'admin.updateUser', config: { auth: false } },
    { method: 'DELETE', path: '/admin/users/:id', handler: 'admin.deleteUser', config: { auth: false } },

    { method: 'GET', path: '/admin/announcements', handler: 'admin.announcements', config: { auth: false } },
    { method: 'POST', path: '/admin/announcements', handler: 'admin.createAnnouncement', config: { auth: false } },
    { method: 'PUT', path: '/admin/announcements/:id', handler: 'admin.updateAnnouncement', config: { auth: false } },
    { method: 'POST', path: '/admin/announcements/:id/publish', handler: 'admin.publishAnnouncement', config: { auth: false } },
    { method: 'POST', path: '/admin/announcements/:id/unpublish', handler: 'admin.unpublishAnnouncement', config: { auth: false } },
    { method: 'DELETE', path: '/admin/announcements/:id', handler: 'admin.deleteAnnouncement', config: { auth: false } },

    { method: 'GET', path: '/admin/content', handler: 'admin.content', config: { auth: false } },
    { method: 'PUT', path: '/admin/content/home', handler: 'admin.updateHome', config: { auth: false } },
    { method: 'PUT', path: '/admin/content/about', handler: 'admin.updateAbout', config: { auth: false } },
    { method: 'PUT', path: '/admin/content/contact', handler: 'admin.updateContact', config: { auth: false } },
    { method: 'PUT', path: '/admin/content/settings', handler: 'admin.updateSettings', config: { auth: false } },

    { method: 'GET', path: '/admin/mail', handler: 'admin.mailStatus', config: { auth: false } },
    { method: 'POST', path: '/admin/mail/test', handler: 'admin.sendTestMail', config: { auth: false } },

    { method: 'GET', path: '/admin/messages', handler: 'admin.messages', config: { auth: false } },
    { method: 'PATCH', path: '/admin/messages/:id', handler: 'admin.updateMessage', config: { auth: false } },
    { method: 'DELETE', path: '/admin/messages/:id', handler: 'admin.deleteMessage', config: { auth: false } },

    { method: 'GET', path: '/admin/reviews', handler: 'admin.reviews', config: { auth: false } },
    { method: 'PATCH', path: '/admin/reviews/:id', handler: 'admin.updateReview', config: { auth: false } },
    { method: 'DELETE', path: '/admin/reviews/:id', handler: 'admin.deleteReview', config: { auth: false } },
  ],
};
