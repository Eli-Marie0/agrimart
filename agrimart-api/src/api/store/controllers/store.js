'use strict';

const A = require('../../../lib/agrimart');

module.exports = {
  async home(ctx) {
    const [home, categories, shelf, featured, best, recent, announcements, contact, settings] = await Promise.all([
      A.getHome(),
      A.listCategories(),
      A.listProducts({ sort: 'popular', pageSize: 6, inStock: true }),
      A.listProducts({ featured: true, pageSize: 5 }),
      A.listProducts({ sort: 'popular', pageSize: 5 }),
      A.listProducts({ sort: 'newest', pageSize: 8 }),
      A.listPublishedAnnouncements(3),
      A.getContact(),
      A.getSettings(),
    ]);

    ctx.body = {
      data: {
        home: {
          heroTitle: home.heroTitle,
          heroText: home.heroText,
          kicker: home.kicker || 'Agricultural supply store',
          heroImageUrl: home.heroImageUrl || null,
          promoTitle: home.promoTitle,
          promoText: home.promoText,
        },
        categories,
        shelf: shelf.products,
        featured: featured.products,
        bestSellers: best.products,
        recent: recent.products,
        announcements,
        contact: {
          address: contact.address,
          hours: contact.hours,
          phone: contact.phone,
          email: contact.email,
          latitude: A.num(contact.latitude),
          longitude: A.num(contact.longitude),
        },
        settings: {
          storeName: settings.storeName,
          tagline: settings.tagline,
          announcementBar: settings.announcementBar || '',
          freeDeliveryThreshold: settings.freeDeliveryThreshold,
          plusMonthly: settings.plusMonthly,
          plusYearly: settings.plusYearly,
          pickupNote: settings.pickupNote,
          maintenanceMode: Boolean(settings.maintenanceMode),
        },
        updatedAt: new Date().toISOString(),
      },
    };
  },

  async products(ctx) {
    const q = ctx.query || {};
    const result = await A.listProducts({
      q: q.q,
      category: q.category,
      brand: q.brand,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
      inStock: q.inStock,
      featured: q.featured,
    });
    ctx.body = { data: result.products, meta: { pagination: { page: result.page, pageSize: result.pageSize, pageCount: result.pages, total: result.total } } };
  },

  async product(ctx) {
    const { slug } = ctx.params;
    const product = await A.getProductBySlug(slug);
    if (!product) return A.fail(ctx, 404, 'That product was not found.');
    let related = [];
    if (product.category?.slug) {
      const result = await A.listProducts({ category: product.category.slug, pageSize: 5 });
      related = result.products.filter((p) => p.id !== product.id).slice(0, 4);
    }
    const { reviews, summary } = await A.productReviewData(product.id);
    product.ratingAvg = summary.average;
    product.ratingCount = summary.count;
    ctx.body = { data: { product, related, reviews, summary } };
  },

  async categories(ctx) {
    ctx.body = { data: await A.listCategories() };
  },

  async brands(ctx) {
    ctx.body = { data: await A.listBrands() };
  },

  async announcements(ctx) {
    const limit = A.num(ctx.query?.limit, 50);
    ctx.body = { data: await A.listPublishedAnnouncements(limit) };
  },

  async content(ctx) {
    const [home, about, contact] = await Promise.all([A.getHome(), A.getAbout(), A.getContact()]);
    ctx.body = {
      data: {
        home: {
          heroTitle: home.heroTitle,
          heroText: home.heroText,
          kicker: home.kicker || '',
          heroImageUrl: home.heroImageUrl || null,
          promoTitle: home.promoTitle,
          promoText: home.promoText,
        },
        about: {
          title: about.title,
          body: about.body,
          imageUrl: about.imageUrl || null,
        },
        contact: {
          address: contact.address,
          hours: contact.hours,
          phone: contact.phone,
          email: contact.email,
          latitude: A.num(contact.latitude),
          longitude: A.num(contact.longitude),
        },
      },
    };
  },

  async settings(ctx) {
    const settings = await A.getSettings();
    ctx.body = {
      data: {
        storeName: settings.storeName,
        tagline: settings.tagline,
        deliveryFees: settings.deliveryFees,
        defaultDeliveryFee: settings.defaultDeliveryFee,
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        plusMonthly: settings.plusMonthly,
        plusYearly: settings.plusYearly,
        pickupNote: settings.pickupNote,
        supportPhone: settings.supportPhone,
        supportEmail: settings.supportEmail,
        announcementBar: settings.announcementBar || '',
        maintenanceMode: Boolean(settings.maintenanceMode),
      },
    };
  },

  async contact(ctx) {
    const body = ctx.request.body || {};
    if (body.website) {
      ctx.body = { data: { received: true } };
      return;
    }
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const message = String(body.message || '').trim();
    if (!name || !email || !message) {
      return A.fail(ctx, 400, 'Add your name, email and message.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return A.fail(ctx, 400, 'Enter a valid email address.');
    }
    if (message.length < 10) {
      return A.fail(ctx, 400, 'Write a little more so we can help.');
    }
    if (message.length > 4000) {
      return A.fail(ctx, 400, 'Keep the message under 4,000 characters.');
    }

    const row = await strapi.db.query(A.UID.message).create({
      data: {
        name: name.slice(0, 120),
        email: email.slice(0, 160),
        phone: String(body.phone || '').slice(0, 40),
        subject: String(body.subject || 'Website message').slice(0, 160),
        message: message.slice(0, 4000),
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const settings = await A.getSettings();
    await A.sendMail({
      to: settings.supportEmail || 'hello@agrimart.ph',
      subject: `Website message: ${row.subject}`,
      text: [
        `From: ${row.name} <${row.email}>`,
        row.phone ? `Phone: ${row.phone}` : '',
        '',
        row.message,
      ].filter(Boolean).join('\n'),
    });

    ctx.body = { data: { id: row.id, received: true } };
  },
};
