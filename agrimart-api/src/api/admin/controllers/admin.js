'use strict';

const A = require('../../../lib/agrimart');

async function adminOnly(ctx) {
  return A.requireRole(ctx, ['admin']);
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function updateSingle(uid, patch) {
  const row = await A.ensureRow(uid, {});
  return strapi.db.query(uid).update({
    where: { id: row.id },
    data: { ...patch, updatedAt: new Date() },
  });
}

function categoryView(row) {
  return {
    id: row.id,
    documentId: row.documentId,
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    productCount: row.productCount || 0,
    createdAt: row.createdAt,
  };
}

module.exports = {
  async uploadProductImage(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const input = ctx.request.files?.files || ctx.request.files?.file;
      const file = Array.isArray(input) ? input[0] : input;
      if (!file) return A.fail(ctx, 400, 'Choose an image to upload.');
      if (!String(file.mimetype || '').startsWith('image/') || /svg/i.test(file.mimetype || '')) {
        return A.fail(ctx, 400, 'Upload a PNG, JPEG, WebP or GIF image.');
      }
      if (Number(file.size || 0) > 8 * 1024 * 1024) {
        return A.fail(ctx, 413, 'Product images must be 8 MB or smaller.');
      }
      const uploaded = await strapi.plugin('upload').service('upload').upload({
        data: { fileInfo: { alternativeText: String(ctx.request.body?.alternativeText || 'AgriMart product photo').slice(0, 125) } },
        files: file,
      });
      const asset = uploaded?.[0];
      if (!asset?.url) return A.fail(ctx, 500, 'The image could not be saved.');
      ctx.body = { data: { id: asset.id, url: asset.url, name: asset.name } };
    });
  },

  /* ------------------------------------------------------------------ */
  /* products                                                            */
  /* ------------------------------------------------------------------ */

  async products(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const q = ctx.query || {};
      const result = await A.adminListProducts({
        q: q.q,
        category: q.category,
        brand: q.brand,
        sort: q.sort || 'name',
        page: q.page,
        pageSize: q.pageSize || 100,
      });
      ctx.body = {
        data: result.products,
        meta: { pagination: { page: result.page, pageSize: result.pageSize, pageCount: result.pages, total: result.total } },
      };
    });
  },

  async product(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const row = await strapi.db.query(A.UID.product).findOne({
        where: { id: A.num(ctx.params.id) },
        populate: { category: true, image: true, gallery: true },
      });
      if (!row) return A.fail(ctx, 404, 'Product not found.');
      ctx.body = { data: A.serializeProduct(row, { includeAdmin: true }) };
    });
  },

  async createProduct(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const created = await A.createProduct(body);
      if (A.num(body.stockQty) > 0) {
        await strapi.db.query(A.UID.inventory).create({
          data: {
            product: created.id,
            user: (await A.currentUser(ctx)).id,
            changeQty: A.num(body.stockQty),
            reason: 'stock_in',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      const row = await strapi.db.query(A.UID.product).findOne({
        where: { id: created.id },
        populate: { category: true },
      });
      ctx.body = { data: A.serializeProduct(row) };
    });
  },

  async updateProduct(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const updated = await A.updateProduct(ctx.params.id, body);
      ctx.body = { data: A.serializeProduct(updated) };
    });
  },

  /** Soft delete: orders keep their historical product references. */
  async deleteProduct(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.product).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Product not found.');
      await strapi.db.query(A.UID.product).update({
        where: { id },
        data: { isActive: false, isFeatured: false, updatedAt: new Date() },
      });
      ctx.body = { data: { id, deactivated: true } };
    });
  },

  /* ------------------------------------------------------------------ */
  /* categories                                                          */
  /* ------------------------------------------------------------------ */

  async categories(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const rows = await A.listCategories();
      ctx.body = { data: rows.map(categoryView) };
    });
  },

  async createCategory(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const name = text(body.name, 120);
      if (!name) return A.fail(ctx, 400, 'Enter a category name.');
      let slug = A.slugify(body.slug || name);
      if (await strapi.db.query(A.UID.category).findOne({ where: { slug } })) {
        return A.fail(ctx, 409, 'That category slug is already used.');
      }
      const row = await strapi.db.query(A.UID.category).create({
        data: {
          name,
          slug,
          description: text(body.description, 500),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      ctx.body = { data: categoryView(row) };
    });
  },

  async updateCategory(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.category).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Category not found.');
      const body = ctx.request.body || {};
      const patch = { updatedAt: new Date() };
      if (body.name !== undefined) {
        const name = text(body.name, 120);
        if (!name) return A.fail(ctx, 400, 'Enter a category name.');
        patch.name = name;
      }
      if (body.description !== undefined) patch.description = text(body.description, 500);
      if (body.slug !== undefined && body.slug !== row.slug) {
        const slug = A.slugify(body.slug);
        const clash = await strapi.db.query(A.UID.category).findOne({ where: { slug } });
        if (clash && clash.id !== id) return A.fail(ctx, 409, 'That category slug is already used.');
        patch.slug = slug;
      }
      const updated = await strapi.db.query(A.UID.category).update({ where: { id }, data: patch });
      ctx.body = { data: categoryView(updated) };
    });
  },

  async deleteCategory(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.category).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Category not found.');
      const productCount = await strapi.db.query(A.UID.product).count({ where: { category: id } });
      if (productCount > 0) {
        return A.fail(ctx, 400, `Move the ${productCount} product${productCount === 1 ? '' : 's'} in this category first.`);
      }
      await strapi.db.query(A.UID.category).delete({ where: { id } });
      ctx.body = { data: { id, deleted: true } };
    });
  },

  /* ------------------------------------------------------------------ */
  /* users                                                               */
  /* ------------------------------------------------------------------ */

  async users(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const q = String(ctx.query?.q || '').trim().toLowerCase();
      const role = ctx.query?.role;
      const where = {};
      if (['customer', 'staff', 'admin'].includes(role)) where.roleName = role;
      const rows = await strapi.db.query(A.UID.user).findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        limit: 200,
      });
      const filtered = q
        ? rows.filter((row) => [row.email, row.fullName, row.username, row.phone]
          .filter(Boolean).some((value) => String(value).toLowerCase().includes(q)))
        : rows;
      ctx.body = { data: filtered.map(A.sanitizeUser) };
    });
  },

  async createUser(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const roleName = ['customer', 'staff', 'admin'].includes(body.roleName) ? body.roleName : 'staff';
      const row = await A.createUserRecord({
        email: body.email,
        password: body.password,
        fullName: text(body.fullName, 120),
        phone: text(body.phone, 40),
        roleName,
      });
      ctx.body = { data: A.sanitizeUser(row) };
    });
  },

  async updateUser(ctx) {
    return A.guard(async () => {
      const admin = await adminOnly(ctx);
      if (!admin) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.user).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'User not found.');
      const body = ctx.request.body || {};
      const patch = { updatedAt: new Date() };

      if (body.roleName !== undefined) {
        if (!['customer', 'staff', 'admin'].includes(body.roleName)) {
          return A.fail(ctx, 400, 'Choose a valid role.');
        }
        if (row.id === admin.id && body.roleName !== 'admin') {
          return A.fail(ctx, 400, 'You cannot remove your own admin role.');
        }
        patch.roleName = body.roleName;
        const authenticated = await strapi.db.query(A.UID.role).findOne({ where: { type: 'authenticated' } });
        if (authenticated) patch.role = authenticated.id;
      }
      if (body.isActive !== undefined) {
        if (row.id === admin.id && !bool(body.isActive, true)) {
          return A.fail(ctx, 400, 'You cannot deactivate your own account.');
        }
        patch.isActive = bool(body.isActive, true);
        patch.blocked = !patch.isActive;
      }
      if (body.fullName !== undefined) patch.fullName = text(body.fullName, 120);
      if (body.phone !== undefined) patch.phone = text(body.phone, 40);

      const updated = await strapi.db.query(A.UID.user).update({ where: { id }, data: patch });
      ctx.body = { data: A.sanitizeUser(updated) };
    });
  },

  async deleteUser(ctx) {
    return A.guard(async () => {
      const admin = await adminOnly(ctx);
      if (!admin) return;
      const id = A.num(ctx.params.id);
      if (id === admin.id) return A.fail(ctx, 400, 'You cannot deactivate your own account.');
      const row = await strapi.db.query(A.UID.user).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'User not found.');
      await strapi.db.query(A.UID.user).update({
        where: { id },
        data: { isActive: false, blocked: true, updatedAt: new Date() },
      });
      ctx.body = { data: { id, deactivated: true } };
    });
  },

  /* ------------------------------------------------------------------ */
  /* announcements                                                       */
  /* ------------------------------------------------------------------ */

  async announcements(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const rows = await strapi.db.query(A.UID.announcement).findMany({
        populate: { author: true },
        orderBy: [{ createdAt: 'desc' }],
        limit: 200,
      });
      const seen = new Map();
      for (const row of A.dedupeAnnouncements(rows)) seen.set(row.documentId || row.id, row);
      const data = [...seen.values()].map((row) => ({
        ...A.serializeAnnouncement(row),
        published: Boolean(row.publishedAt),
        status: row.publishedAt ? 'published' : 'draft',
      }));
      ctx.body = { data };
    });
  },

  async createAnnouncement(ctx) {
    return A.guard(async () => {
      const user = await adminOnly(ctx);
      if (!user) return;
      const body = ctx.request.body || {};
      const title = text(body.title, 160);
      const bodyText = text(body.body, 8000);
      if (!title || !bodyText) return A.fail(ctx, 400, 'Add a title and message.');
      const publish = body.publish === undefined ? true : bool(body.publish, true);
      const row = await strapi.db.query(A.UID.announcement).create({
        data: {
          title,
          body: bodyText,
          isPinned: bool(body.isPinned, false),
          author: user.id,
          publishedAt: publish ? new Date() : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      ctx.body = { data: A.serializeAnnouncement(row) };
    });
  },

  async updateAnnouncement(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.announcement).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Announcement not found.');
      const body = ctx.request.body || {};
      const patch = { updatedAt: new Date() };
      if (body.title !== undefined) {
        const title = text(body.title, 160);
        if (!title) return A.fail(ctx, 400, 'Add a title.');
        patch.title = title;
      }
      if (body.body !== undefined) {
        const bodyText = text(body.body, 8000);
        if (!bodyText) return A.fail(ctx, 400, 'Add a message.');
        patch.body = bodyText;
      }
      if (body.isPinned !== undefined) patch.isPinned = bool(body.isPinned, false);
      if (body.published !== undefined) patch.publishedAt = bool(body.published, false) ? (row.publishedAt || new Date()) : null;
      const updated = await strapi.db.query(A.UID.announcement).update({ where: { id }, data: patch });
      ctx.body = { data: { ...A.serializeAnnouncement(updated), published: Boolean(updated.publishedAt) } };
    });
  },

  async publishAnnouncement(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.announcement).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Announcement not found.');
      const updated = await strapi.db.query(A.UID.announcement).update({
        where: { id },
        data: { publishedAt: new Date(), updatedAt: new Date() },
      });
      ctx.body = { data: { ...A.serializeAnnouncement(updated), published: true } };
    });
  },

  async unpublishAnnouncement(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.announcement).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Announcement not found.');
      const updated = await strapi.db.query(A.UID.announcement).update({
        where: { id },
        data: { publishedAt: null, updatedAt: new Date() },
      });
      ctx.body = { data: { ...A.serializeAnnouncement(updated), published: false } };
    });
  },

  async deleteAnnouncement(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.announcement).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'Announcement not found.');
      if (row.documentId) {
        const siblings = await strapi.db.query(A.UID.announcement).findMany({ where: { documentId: row.documentId } });
        for (const sibling of siblings) {
          await strapi.db.query(A.UID.announcement).delete({ where: { id: sibling.id } });
        }
      } else {
        await strapi.db.query(A.UID.announcement).delete({ where: { id } });
      }
      ctx.body = { data: { id, deleted: true } };
    });
  },

  /* ------------------------------------------------------------------ */
  /* content                                                             */
  /* ------------------------------------------------------------------ */

  async content(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const [home, about, contact, settings] = await Promise.all([
        A.getHome(),
        A.getAbout(),
        A.getContact(),
        A.getSettings(),
      ]);
      ctx.body = {
        data: {
          home: {
            heroTitle: home.heroTitle || '',
            heroText: home.heroText || '',
            kicker: home.kicker || '',
            heroImageUrl: home.heroImageUrl || '',
            promoTitle: home.promoTitle || '',
            promoText: home.promoText || '',
          },
          about: {
            title: about.title || '',
            body: about.body || '',
            imageUrl: about.imageUrl || '',
          },
          contact: {
            address: contact.address || '',
            hours: contact.hours || '',
            phone: contact.phone || '',
            email: contact.email || '',
            latitude: A.num(contact.latitude),
            longitude: A.num(contact.longitude),
          },
          settings: {
            storeName: settings.storeName || '',
            tagline: settings.tagline || '',
            deliveryFees: settings.deliveryFees,
            defaultDeliveryFee: settings.defaultDeliveryFee,
            freeDeliveryThreshold: settings.freeDeliveryThreshold,
            defaultReorderLevel: settings.defaultReorderLevel,
            lowStockEmail: settings.lowStockEmail || '',
            plusMonthly: settings.plusMonthly,
            plusYearly: settings.plusYearly,
            maintenanceMode: Boolean(settings.maintenanceMode),
            announcementBar: settings.announcementBar || '',
            supportPhone: settings.supportPhone || '',
            supportEmail: settings.supportEmail || '',
            pickupNote: settings.pickupNote || '',
          },
        },
      };
    });
  },

  async updateHome(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const row = await updateSingle(A.UID.home, {
        heroTitle: text(body.heroTitle, 160),
        heroText: text(body.heroText, 1000),
        kicker: text(body.kicker, 120),
        heroImageUrl: text(body.heroImageUrl, 500) || null,
        promoTitle: text(body.promoTitle, 160),
        promoText: text(body.promoText, 500),
      });
      ctx.body = { data: row };
    });
  },

  async updateAbout(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const row = await updateSingle(A.UID.about, {
        title: text(body.title, 160),
        body: text(body.body, 12000),
        imageUrl: text(body.imageUrl, 500) || null,
      });
      ctx.body = { data: row };
    });
  },

  async updateContact(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const row = await updateSingle(A.UID.contact, {
        address: text(body.address, 300),
        hours: text(body.hours, 500),
        phone: text(body.phone, 60),
        email: text(body.email, 160),
        latitude: A.num(body.latitude, 13.177),
        longitude: A.num(body.longitude, 121.279),
      });
      ctx.body = { data: row };
    });
  },

  async updateSettings(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const body = ctx.request.body || {};
      const patch = {};
      for (const key of ['storeName', 'tagline', 'announcementBar', 'supportPhone', 'supportEmail', 'pickupNote']) {
        if (body[key] !== undefined) patch[key] = text(body[key], key === 'pickupNote' ? 500 : 200);
      }
      for (const key of ['defaultDeliveryFee', 'freeDeliveryThreshold', 'plusMonthly', 'plusYearly']) {
        if (body[key] !== undefined) patch[key] = A.num(body[key]);
      }
      if (body.defaultReorderLevel !== undefined) patch.defaultReorderLevel = Math.max(0, A.num(body.defaultReorderLevel, 10));
      if (body.lowStockEmail !== undefined) patch.lowStockEmail = text(body.lowStockEmail, 160);
      if (body.maintenanceMode !== undefined) patch.maintenanceMode = bool(body.maintenanceMode, false);
      if (body.deliveryFees !== undefined && typeof body.deliveryFees === 'object') {
        const fees = {};
        for (const [municipality, fee] of Object.entries(body.deliveryFees)) {
          const name = text(municipality, 80);
          if (name) fees[name] = Math.max(0, A.num(fee));
        }
        patch.deliveryFees = fees;
      }
      const row = await updateSingle(A.UID.settings, patch);
      ctx.body = { data: row };
    });
  },

  /* ------------------------------------------------------------------ */
  /* contact messages                                                    */
  /* ------------------------------------------------------------------ */

  async mailStatus(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['admin']);
      if (!user) return;
      ctx.body = { data: A.mailStatus() };
    });
  },

  async sendTestMail(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['admin']);
      if (!user) return;
      const body = ctx.request.body || {};
      const to = String(body.to || user.email || '').trim();
      if (!to) return A.fail(ctx, 400, 'Enter an email address.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return A.fail(ctx, 400, 'That email address looks wrong.');
      if (body.to && String(body.to).length > 160) return A.fail(ctx, 400, 'That email address is too long.');
      const result = await A.sendTestMail(to);
      ctx.body = { data: { to, ...result } };
    });
  },

  async messages(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const where = {};
      if (['new', 'read', 'archived'].includes(ctx.query?.status)) where.status = ctx.query.status;
      const rows = await strapi.db.query(A.UID.message).findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        limit: 200,
      });
      ctx.body = { data: rows };
    });
  },

  async updateMessage(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const body = ctx.request.body || {};
      if (!['new', 'read', 'archived'].includes(body.status)) return A.fail(ctx, 400, 'Choose a valid message status.');
      const row = await strapi.db.query(A.UID.message).update({
        where: { id },
        data: { status: body.status, updatedAt: new Date() },
      });
      ctx.body = { data: row };
    });
  },

  async deleteMessage(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      await strapi.db.query(A.UID.message).delete({ where: { id } });
      ctx.body = { data: { id, deleted: true } };
    });
  },

  /* ------------------------------------------------------------------ */
  /* reviews                                                             */
  /* ------------------------------------------------------------------ */

  async reviews(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const query = ctx.query || {};
      const ratingFilter = query.rating ? A.num(query.rating) : null;
      const productFilter = query.productId ? A.num(query.productId) : null;

      const rows = await strapi.db.query(A.UID.review).findMany({
        populate: { user: true, product: true, order: true },
        orderBy: [{ createdAt: 'desc' }],
        limit: 500,
      });
      const all = rows.map((row) => A.serializeReview(row, { includePrivate: true }));
      const data = all.filter((row) => {
        if (query.visible === 'true' && !row.isVisible) return false;
        if (query.visible === 'false' && row.isVisible) return false;
        if (ratingFilter && row.rating !== ratingFilter) return false;
        if (productFilter && row.product?.id !== productFilter) return false;
        return true;
      });
      const count = all.length;
      const average = count
        ? Math.round((all.reduce((sum, row) => sum + A.num(row.rating), 0) / count) * 10) / 10
        : 0;

      ctx.body = {
        data,
        meta: {
          total: count,
          average,
          visible: all.filter((row) => row.isVisible).length,
          hidden: all.filter((row) => !row.isVisible).length,
        },
      };
    });
  },

  async updateReview(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const body = ctx.request.body || {};
      if (body.isVisible === undefined) return A.fail(ctx, 400, 'Choose whether the review is visible.');
      const existing = await strapi.db.query(A.UID.review).findOne({ where: { id } });
      if (!existing) return A.fail(ctx, 404, 'That review was not found.');
      const row = await strapi.db.query(A.UID.review).update({
        where: { id },
        data: {
          isVisible: body.isVisible === true || body.isVisible === 'true',
          updatedAt: new Date(),
        },
        populate: { user: true, product: true, order: true },
      });
      ctx.body = { data: A.serializeReview(row, { includePrivate: true }) };
    });
  },

  async deleteReview(ctx) {
    return A.guard(async () => {
      if (!await adminOnly(ctx)) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.review).findOne({ where: { id } });
      if (!row) return A.fail(ctx, 404, 'That review was not found.');
      await strapi.db.query(A.UID.review).delete({ where: { id } });
      ctx.body = { data: { id, deleted: true } };
    });
  },
};
