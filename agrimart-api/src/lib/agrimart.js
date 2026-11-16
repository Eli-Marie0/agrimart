'use strict';

/**
 * AgriMart shared server helpers.
 * Plain CommonJS module required by the custom Strapi controllers.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const UID = {
  product: 'api::product.product',
  category: 'api::category.category',
  order: 'api::order.order',
  orderItem: 'api::order-item.order-item',
  payment: 'api::payment.payment',
  inventory: 'api::inventory-log.inventory-log',
  announcement: 'api::announcement.announcement',
  address: 'api::address.address',
  user: 'plugin::users-permissions.user',
  role: 'plugin::users-permissions.role',
  home: 'api::home.home',
  about: 'api::about.about',
  contact: 'api::contact-info.contact-info',
  settings: 'api::setting.setting',
  message: 'api::contact-message.contact-message',
  review: 'api::review.review',
};

const ORDER_STATUSES = ['pending', 'paid', 'preparing', 'out_for_delivery', 'completed', 'cancelled'];

const STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TRANSITIONS = {
  pending: ['paid', 'preparing', 'cancelled'],
  paid: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const DEFAULT_FEES = {
  Victoria: 50,
  Naujan: 90,
  Calapan: 130,
  Socorro: 110,
  Pinamalayan: 120,
  Bongabong: 140,
  Roxas: 150,
  Mansalay: 170,
  Bulalacao: 190,
  "Puerto Galera": 180,
};

const DEFAULT_SETTINGS = {
  storeName: 'AgriMart',
  tagline: 'Seeds, feed, fertilizer and tools from Victoria.',
  deliveryFees: DEFAULT_FEES,
  defaultDeliveryFee: 100,
  freeDeliveryThreshold: 3000,
  defaultReorderLevel: 10,
  lowStockEmail: 'owner@agrimart.ph',
  plusMonthly: 149,
  plusYearly: 1490,
  maintenanceMode: false,
  announcementBar: '',
  supportPhone: '',
  supportEmail: 'hello@agrimart.ph',
  pickupNote: 'Pick up at the counter. Bring your order number.',
};

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coordinates(input = {}) {
  const rawLatitude = input.latitude;
  const rawLongitude = input.longitude;
  const hasLatitude = rawLatitude !== undefined && rawLatitude !== null && String(rawLatitude).trim() !== '';
  const hasLongitude = rawLongitude !== undefined && rawLongitude !== null && String(rawLongitude).trim() !== '';
  if (hasLatitude !== hasLongitude) {
    throw Object.assign(new Error('Enter both latitude and longitude for the delivery pin.'), { status: 400, expose: true });
  }
  if (!hasLatitude) return { latitude: null, longitude: null };
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw Object.assign(new Error('Enter valid latitude and longitude coordinates.'), { status: 400, expose: true });
  }
  return { latitude, longitude };
}

function money(value) {
  return `PHP ${num(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function parseDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* response helpers                                                    */
/* ------------------------------------------------------------------ */

function fail(ctx, status, message, details) {
  ctx.status = status;
  ctx.body = { error: { status, message, details: details || null } };
  return null;
}

async function guard(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.expose) throw err;
    strapi.log.error('[agrimart]', err && err.stack ? err.stack : err);
    const error = new Error(err?.message || 'Something went wrong. Try again.');
    error.status = err?.status || 500;
    error.expose = true;
    error.details = err?.details;
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('JWT_SECRET must be configured before running AgriMart in production.');
  }
  return secret || 'agrimart-dev-secret';
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, roleName: user.roleName || 'customer', sessionVersion: num(user.sessionVersion) },
    jwtSecret(),
    { expiresIn: '7d' }
  );
}

function bearerToken(ctx) {
  const header = ctx.request.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function currentUser(ctx) {
  const token = bearerToken(ctx);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    if (!payload || !payload.id) return null;
    const user = await strapi.db.query(UID.user).findOne({
      where: { id: payload.id },
      populate: { role: true },
    });
    if (!user) return null;
    if (num(payload.sessionVersion) !== num(user.sessionVersion)) return null;
    if (user.blocked || user.isActive === false) return null;
    return user;
  } catch {
    return null;
  }
}

async function requireRole(ctx, roles) {
  const user = await currentUser(ctx);
  if (!user) {
    fail(ctx, 401, 'Sign in to continue.');
    return null;
  }
  if (roles && roles.length && !roles.includes(user.roleName || 'customer')) {
    fail(ctx, 403, 'You do not have access to this page.');
    return null;
  }
  return user;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    documentId: user.documentId,
    username: user.username,
    email: user.email,
    fullName: user.fullName || user.username || '',
    phone: user.phone || '',
    roleName: user.roleName || 'customer',
    isActive: user.isActive !== false,
    blocked: Boolean(user.blocked),
    createdAt: user.createdAt,
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function findAuthenticatedRoleId() {
  const role = await strapi.db.query(UID.role).findOne({ where: { type: 'authenticated' } });
  return role ? role.id : null;
}

async function createUserRecord({ email, password, fullName, phone, roleName = 'customer' }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw Object.assign(new Error('Enter an email address.'), { status: 400, expose: true });
  if (!password || String(password).length < 8) {
    throw Object.assign(new Error('Use at least 8 characters for your password.'), { status: 400, expose: true });
  }
  const existing = await strapi.db.query(UID.user).findOne({ where: { email: normalized } });
  if (existing) throw Object.assign(new Error('That email is already registered. Sign in instead.'), { status: 409, expose: true });

  const roleId = await findAuthenticatedRoleId();
  if (!roleId) throw Object.assign(new Error('The authenticated role is missing. Restart Strapi.'), { status: 500, expose: true });

  const username = normalized.split('@')[0].replace(/[^a-z0-9._-]/g, '') || `user${Date.now()}`;
  let finalUsername = username;
  let n = 1;
  while (await strapi.db.query(UID.user).findOne({ where: { username: finalUsername } })) {
    finalUsername = `${username}${n += 1}`;
  }

  return strapi.db.query(UID.user).create({
    data: {
      username: finalUsername,
      email: normalized,
      password: await hashPassword(String(password)),
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: roleId,
      fullName: fullName || '',
      phone: phone || '',
      roleName,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/* ------------------------------------------------------------------ */
/* settings, content                                                   */
/* ------------------------------------------------------------------ */

async function getRow(uid) {
  try {
    return await strapi.db.query(uid).findOne({ where: { id: 1 } });
  } catch {
    return null;
  }
}

async function ensureRow(uid, data) {
  let row = await getRow(uid);
  if (!row) {
    try {
      row = await strapi.db.query(uid).create({
        data: {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      strapi.log.warn(`[agrimart] could not create ${uid}`, err.message);
      row = await getRow(uid);
    }
  }
  return row;
}

function normalizeSettings(row) {
  const fees = row?.deliveryFees && typeof row.deliveryFees === 'object'
    ? row.deliveryFees
    : DEFAULT_FEES;
  return {
    ...DEFAULT_SETTINGS,
    ...(row || {}),
    deliveryFees: fees,
    defaultDeliveryFee: num(row?.defaultDeliveryFee, DEFAULT_SETTINGS.defaultDeliveryFee),
    freeDeliveryThreshold: num(row?.freeDeliveryThreshold, DEFAULT_SETTINGS.freeDeliveryThreshold),
    defaultReorderLevel: num(row?.defaultReorderLevel, DEFAULT_SETTINGS.defaultReorderLevel),
    plusMonthly: num(row?.plusMonthly, DEFAULT_SETTINGS.plusMonthly),
    plusYearly: num(row?.plusYearly, DEFAULT_SETTINGS.plusYearly),
  };
}

async function getSettings() {
  const row = await ensureRow(UID.settings, DEFAULT_SETTINGS);
  return normalizeSettings(row);
}

async function getHome() {
  return ensureRow(UID.home, {
    heroTitle: 'Check the shelf before you make the trip.',
    heroText: 'Seeds, feed, fertilizer and tools from our store in Victoria. See what is in stock and what it costs, then pick up or have it delivered.',
    kicker: 'Agricultural supply store',
    promoTitle: 'Free delivery above PHP 3,000',
    promoText: 'Bulk-price discounts and early access to promos.',
  });
}

async function getAbout() {
  return ensureRow(UID.about, {
    title: 'About AgriMart',
    body: 'AgriMart is a farm supply shop in Victoria, Oriental Mindoro. We sell seeds, fertilizer, feed, veterinary supplies, tools and irrigation equipment to farmers, livestock raisers and home growers.',
  });
}

async function getContact() {
  return ensureRow(UID.contact, {
    address: 'Poblacion, Victoria, Oriental Mindoro',
    hours: 'Mon to Sat 7:00 am to 6:00 pm\nSun 7:00 am to 12:00 pm',
    phone: '',
    email: '',
    latitude: 13.177,
    longitude: 121.279,
  });
}

/* ------------------------------------------------------------------ */
/* product / category serialization                                    */
/* ------------------------------------------------------------------ */

function mediaUrl(media) {
  if (!media) return null;
  if (typeof media === 'string') return media;
  return media.url || null;
}

function stockState(product) {
  const qty = num(product.stockQty);
  const reorder = num(product.reorderLevel, 10);
  if (qty <= 0) return { key: 'out', label: 'Out of stock' };
  if (qty <= reorder) return { key: 'low', label: `Low stock: ${qty} left` };
  return { key: 'ok', label: `In stock: ${qty}` };
}

function productPopulate() {
  return { category: true, image: true, gallery: true };
}

function serializeProduct(product, opts = {}) {
  if (!product) return null;
  const stock = stockState(product);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  const galleryUrls = Array.isArray(product.galleryUrls)
    ? product.galleryUrls
    : (typeof product.galleryUrls === 'string' ? safeJson(product.galleryUrls, []) : []);
  return {
    id: product.id,
    documentId: product.documentId,
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    brand: product.brand || '',
    unit: product.unit || 'piece',
    price: num(product.price),
    stockQty: num(product.stockQty),
    reorderLevel: num(product.reorderLevel, 10),
    imageUrl: mediaUrl(product.image) || product.imageUrl || null,
    galleryUrls: [
      ...galleryUrls,
      ...gallery.map(mediaUrl).filter(Boolean),
    ].filter(Boolean),
    isActive: product.isActive !== false,
    isFeatured: Boolean(product.isFeatured),
    soldCount: num(product.soldCount),
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
      description: product.category.description || '',
    } : null,
    stock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    ...(opts.includeAdmin ? {
      imageUrlRaw: product.imageUrl || '',
    } : {}),
  };
}

function safeJson(value, fallback) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function categoryIdForSlug(slug) {
  if (!slug) return null;
  const category = await strapi.db.query(UID.category).findOne({ where: { slug: String(slug) } });
  return category ? category.id : null;
}

async function listProducts(query = {}) {
  const {
    q, category, brand, minPrice, maxPrice,
    sort = 'relevance', page = 1, pageSize = 24,
    featured, inStock, activeOnly = true, includeInactive = false,
  } = query;

  const where = {};
  if (activeOnly && !includeInactive) where.isActive = true;
  if (q) {
    where.$or = [
      { name: { $containsi: q } },
      { brand: { $containsi: q } },
      { description: { $containsi: q } },
    ];
  }
  if (category) {
    const categoryId = await categoryIdForSlug(category);
    if (!categoryId) return { products: [], total: 0, page: 1, pageSize: num(pageSize, 24) };
    where.category = categoryId;
  }
  if (brand) where.brand = { $containsi: brand };
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined && minPrice !== '') where.price.$gte = num(minPrice);
    if (maxPrice !== undefined && maxPrice !== '') where.price.$lte = num(maxPrice);
  }
  if (featured === true || featured === 'true') where.isFeatured = true;
  if (inStock === true || inStock === 'true') where.stockQty = { $gt: 0 };

  const orderBy = {
    relevance: [{ isFeatured: 'desc' }, { soldCount: 'desc' }],
    priceAsc: [{ price: 'asc' }],
    priceDesc: [{ price: 'desc' }],
    newest: [{ createdAt: 'desc' }],
    name: [{ name: 'asc' }],
    popular: [{ soldCount: 'desc' }],
  }[sort] || [{ soldCount: 'desc' }];

  const size = Math.min(100, Math.max(1, num(pageSize, 24)));
  const current = Math.max(1, num(page, 1));
  const offset = (current - 1) * size;

  const [rows, total] = await Promise.all([
    strapi.db.query(UID.product).findMany({
      where,
      populate: productPopulate(),
      orderBy,
      limit: size,
      offset,
    }),
    strapi.db.query(UID.product).count({ where }),
  ]);

  const products = rows.map((p) => serializeProduct(p));
  const ratings = await productRatingSummaries(products.map((p) => p.id));
  for (const product of products) {
    const rating = ratings[product.id];
    product.ratingAvg = rating?.average || 0;
    product.ratingCount = rating?.count || 0;
  }

  return {
    products,
    total,
    page: current,
    pageSize: size,
    pages: Math.max(1, Math.ceil(total / size)),
  };
}

async function listCategories() {
  const [categories, products] = await Promise.all([
    strapi.db.query(UID.category).findMany({ orderBy: [{ name: 'asc' }] }),
    strapi.db.query(UID.product).findMany({
      where: { isActive: true },
      populate: { category: true },
    }),
  ]);
  const counts = new Map();
  for (const product of products) {
    if (!product.category) continue;
    counts.set(product.category.id, (counts.get(product.category.id) || 0) + 1);
  }
  return categories.map((c) => ({
    id: c.id,
    documentId: c.documentId,
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    productCount: counts.get(c.id) || 0,
  }));
}

async function listBrands() {
  const rows = await strapi.db.query(UID.product).findMany({
    where: { isActive: true },
    select: ['brand'],
    orderBy: [{ brand: 'asc' }],
  });
  return [...new Set(rows.map((r) => r.brand).filter(Boolean))];
}

async function getProductBySlug(slug) {
  const product = await strapi.db.query(UID.product).findOne({
    where: { slug: String(slug) },
    populate: productPopulate(),
  });
  return product ? serializeProduct(product) : null;
}

/* ------------------------------------------------------------------ */
/* reviews                                                             */
/* ------------------------------------------------------------------ */

function reviewPopulate() {
  return { user: true, product: true, order: true };
}

function reviewAuthorName(user) {
  const full = String(user?.fullName || user?.username || 'Customer').trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Customer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function serializeReview(row, opts = {}) {
  if (!row) return null;
  return {
    id: row.id,
    rating: num(row.rating),
    comment: row.comment || '',
    isVisible: row.isVisible !== false,
    createdAt: row.createdAt,
    author: reviewAuthorName(row.user),
    product: row.product ? {
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      imageUrl: mediaUrl(row.product.image) || row.product.imageUrl || null,
    } : null,
    orderReference: row.order?.orderNumber || row.order?.id
      ? `AGM-${String(row.order.orderNumber || row.order.id).padStart(5, '0')}`
      : '',
    ...(opts.includePrivate && row.user ? {
      email: row.user.email || '',
      userId: row.user.id,
    } : {}),
  };
}

function summarizeRatings(rows) {
  const count = rows.length;
  const sum = rows.reduce((total, row) => total + num(row.rating), 0);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) {
    const stars = num(row.rating);
    if (distribution[stars] !== undefined) distribution[stars] += 1;
  }
  return {
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution,
  };
}

/**
 * Visible reviews plus an aggregate for one product. Reviews are written only
 * against a delivered (completed) order, so every row is a verified purchase.
 */
async function productReviewData(productId, { limit = 30 } = {}) {
  const rows = await strapi.db.query(UID.review).findMany({
    where: { product: num(productId), isVisible: true },
    populate: reviewPopulate(),
    orderBy: [{ createdAt: 'desc' }],
    limit: 100,
  });
  return {
    reviews: rows.slice(0, Math.max(1, num(limit, 30))).map((row) => serializeReview(row)),
    summary: summarizeRatings(rows),
  };
}

/** Batched star aggregates so product cards can show a rating without extra requests. */
async function productRatingSummaries(productIds) {
  const ids = [...new Set((productIds || []).map((id) => num(id)).filter(Boolean))];
  const out = {};
  if (!ids.length) return out;
  const rows = await strapi.db.query(UID.review).findMany({
    where: { product: { id: { $in: ids } }, isVisible: true },
    select: ['rating'],
    populate: { product: { select: ['id'] } },
  });
  const grouped = {};
  for (const row of rows) {
    const productId = row.product?.id;
    if (!productId) continue;
    if (!grouped[productId]) grouped[productId] = [];
    grouped[productId].push(row);
  }
  for (const productId of ids) {
    const summary = summarizeRatings(grouped[productId] || []);
    out[productId] = { average: summary.average, count: summary.count };
  }
  return out;
}

/**
 * Which delivered order, if any, lets this customer review the product, and
 * whether they already reviewed it. Used by both the form and the POST guard.
 */
async function reviewEligibility(userId, productId) {
  const pid = num(productId);
  const existing = await strapi.db.query(UID.review).findOne({
    where: { user: num(userId), product: pid },
    populate: reviewPopulate(),
  });
  const orders = await strapi.db.query(UID.order).findMany({
    where: { user: num(userId), status: 'completed' },
    populate: { items: { populate: { product: true } } },
    orderBy: [{ createdAt: 'desc' }],
    limit: 50,
  });
  let order = null;
  let orderItemId = null;
  for (const candidate of orders) {
    const item = (candidate.items || []).find((line) => line.product && line.product.id === pid);
    if (item) {
      order = candidate;
      orderItemId = item.id;
      break;
    }
  }
  return {
    order,
    orderItemId,
    existing: existing ? serializeReview(existing) : null,
  };
}


/* ------------------------------------------------------------------ */
/* announcements                                                       */
/* ------------------------------------------------------------------ */

function serializeAnnouncement(a) {
  return {
    id: a.id,
    documentId: a.documentId,
    title: a.title,
    body: a.body,
    excerpt: String(a.body || '').replace(/\s+/g, ' ').slice(0, 180),
    isPinned: Boolean(a.isPinned),
    publishedAt: a.publishedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    author: a.author ? {
      id: a.author.id,
      fullName: a.author.fullName || a.author.username || '',
    } : null,
  };
}

async function listPublishedAnnouncements(limit = 50) {
  const rows = await strapi.db.query(UID.announcement).findMany({
    where: { publishedAt: { $notNull: true } },
    populate: { author: true },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    limit,
  });
  return dedupeAnnouncements(rows).map(serializeAnnouncement);
}

function dedupeAnnouncements(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = row.documentId || `id-${row.id}`;
    const previous = seen.get(key);
    if (!previous) {
      seen.set(key, row);
      continue;
    }
    const previousTime = new Date(previous.updatedAt || previous.publishedAt || 0).getTime();
    const currentTime = new Date(row.updatedAt || row.publishedAt || 0).getTime();
    if (currentTime >= previousTime) seen.set(key, row);
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ */
/* orders                                                              */
/* ------------------------------------------------------------------ */

function orderPopulate() {
  return {
    user: true,
    address: true,
    items: { populate: { product: { populate: { category: true } } } },
    payment: true,
  };
}

function serializeOrder(order, opts = {}) {
  if (!order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const customer = order.user ? {
    id: order.user.id,
    fullName: order.user.fullName || order.user.username || 'Customer',
    email: order.user.email || '',
    phone: order.user.phone || '',
  } : null;
  return {
    id: order.id,
    documentId: order.documentId,
    orderNumber: order.orderNumber,
    reference: `AGM-${String(order.orderNumber || order.id).padStart(5, '0')}`,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] || order.status,
    fulfillmentType: order.fulfillmentType,
    municipality: order.municipality || order.address?.municipality || '',
    deliveryFee: num(order.deliveryFee),
    totalAmount: num(order.totalAmount),
    subtotal: items.reduce((sum, item) => sum + num(item.subtotal), 0),
    notes: order.notes || '',
    stockDeducted: Boolean(order.stockDeducted),
    statusHistory: safeJson(order.statusHistory, []),
    tracking: order.trackingLatitude !== null && order.trackingLatitude !== undefined
      && order.trackingLongitude !== null && order.trackingLongitude !== undefined
      ? {
        latitude: num(order.trackingLatitude),
        longitude: num(order.trackingLongitude),
        note: order.trackingNote || '',
        updatedAt: order.trackingUpdatedAt || null,
        updatedBy: order.trackingUpdatedBy || '',
      }
      : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: (opts.includeCustomer === false ? null : customer),
    address: order.address ? {
      id: order.address.id,
      label: order.address.label || '',
      street: order.address.street || '',
      barangay: order.address.barangay || '',
      municipality: order.address.municipality || '',
      province: order.address.province || '',
      latitude: order.address.latitude ? num(order.address.latitude) : null,
      longitude: order.address.longitude ? num(order.address.longitude) : null,
    } : null,
    payment: order.payment ? {
      id: order.payment.id,
      method: order.payment.method,
      status: order.payment.status,
      amount: num(order.payment.amount),
      paymongoRef: order.payment.paymongoRef || '',
      paidAt: order.payment.paidAt || null,
    } : null,
    items: items.map((item) => ({
      id: item.id,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      subtotal: num(item.subtotal),
      product: item.product ? {
        id: item.product.id,
        documentId: item.product.documentId,
        name: item.product.name,
        slug: item.product.slug,
        brand: item.product.brand || '',
        unit: item.product.unit || '',
        imageUrl: mediaUrl(item.product.image) || item.product.imageUrl || null,
        stockQty: num(item.product.stockQty),
      } : null,
    })),
  };
}

async function getOrderById(id, populate = orderPopulate()) {
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return null;
  const order = await strapi.db.query(UID.order).findOne({
    where: { id: orderId },
    populate,
  });
  return order || null;
}

async function nextOrderNumber() {
  const last = await strapi.db.query(UID.order).findMany({
    orderBy: [{ orderNumber: 'desc' }],
    limit: 1,
    select: ['orderNumber'],
  });
  return num(last[0]?.orderNumber, 0) + 1;
}

function deliveryFeeFor(municipality, subtotal, settings, fulfillmentType) {
  if (fulfillmentType !== 'delivery') return 0;
  const threshold = num(settings.freeDeliveryThreshold, 3000);
  if (threshold > 0 && subtotal >= threshold) return 0;
  const fees = settings.deliveryFees || DEFAULT_FEES;
  if (municipality && Object.prototype.hasOwnProperty.call(fees, municipality)) {
    return num(fees[municipality]);
  }
  return num(settings.defaultDeliveryFee, 100);
}

async function deductStockForOrder(order, user) {
  if (order.stockDeducted) return false;
  const items = await strapi.db.query(UID.orderItem).findMany({
    where: { order: order.id },
    populate: { product: true },
  });
  // Recheck the shelf at the moment stock is committed. Another order or a
  // staff adjustment may have changed it since checkout was created.
  for (const item of items) {
    if (!item.product || num(item.product.stockQty) < num(item.quantity)) {
      throw Object.assign(
        new Error(`${item.product?.name || 'An item'} no longer has enough stock to fulfill this order.`),
        { status: 409, expose: true }
      );
    }
  }
  for (const item of items) {
    const product = item.product;
    if (!product) continue;
    const before = num(product.stockQty);
    const qty = num(item.quantity);
    const after = before - qty;
    await strapi.db.query(UID.product).update({
      where: { id: product.id },
      data: {
        stockQty: after,
        soldCount: num(product.soldCount) + qty,
        updatedAt: new Date(),
      },
    });
    await strapi.db.query(UID.inventory).create({
      data: {
        product: product.id,
        user: user ? user.id : null,
        changeQty: -qty,
        reason: 'sale',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    if (after <= num(product.reorderLevel, 10) && before > num(product.reorderLevel, 10)) {
      await sendLowStockAlert({ ...product, stockQty: after });
    }
  }
  await strapi.db.query(UID.order).update({
    where: { id: order.id },
    data: { stockDeducted: true, updatedAt: new Date() },
  });
  return true;
}

async function restoreStockForOrder(order, user, reason = 'adjustment') {
  if (!order.stockDeducted) return false;
  const items = await strapi.db.query(UID.orderItem).findMany({
    where: { order: order.id },
    populate: { product: true },
  });
  for (const item of items) {
    if (!item.product) continue;
    await strapi.db.query(UID.product).update({
      where: { id: item.product.id },
      data: {
        stockQty: num(item.product.stockQty) + num(item.quantity),
        soldCount: Math.max(0, num(item.product.soldCount) - num(item.quantity)),
        updatedAt: new Date(),
      },
    });
    await strapi.db.query(UID.inventory).create({
      data: {
        product: item.product.id,
        user: user ? user.id : null,
        changeQty: num(item.quantity),
        reason,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  await strapi.db.query(UID.order).update({
    where: { id: order.id },
    data: { stockDeducted: false, updatedAt: new Date() },
  });
  return true;
}

async function appendStatusHistory(order, status, user) {
  const history = safeJson(order.statusHistory, []);
  history.push({
    status,
    at: new Date().toISOString(),
    by: user ? (user.fullName || user.username || 'Staff') : 'System',
  });
  return history;
}

/* ------------------------------------------------------------------ */
/* email                                                               */
/* ------------------------------------------------------------------ */

let mailer = null;

const SMTP_PLACEHOLDER = /your-|changeme|example\.(com|org)|smtp\.example/i;

function smtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const port = num(process.env.SMTP_PORT, 587);
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? 'true' : 'false')) === 'true';
  const from = (() => {
    const configuredFrom = String(process.env.MAIL_FROM || '').trim();
    if (configuredFrom && !SMTP_PLACEHOLDER.test(configuredFrom)) return configuredFrom;
    if (user && !SMTP_PLACEHOLDER.test(user)) return `${DEFAULT_SETTINGS.storeName} <${user}>`;
    return `${DEFAULT_SETTINGS.storeName} <no-reply@agrimart.ph>`;
  })();
  // A host with no auth is a valid local relay (MailHog, Mailpit). A host with
  // the sample credentials from .env.example is not configured yet.
  const usableAuth = !user || (user && pass && !SMTP_PLACEHOLDER.test(user) && !SMTP_PLACEHOLDER.test(pass));
  const configured = Boolean(host) && usableAuth;
  return { host, port, secure, user, pass, from, configured };
}

function mailPreviewDir() {
  return path.join(process.cwd(), '.tmp', 'mail');
}

function mailStatus() {
  const cfg = smtpConfig();
  return {
    configured: cfg.configured,
    mode: cfg.configured ? 'smtp' : 'preview',
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    from: cfg.from,
    user: cfg.user ? cfg.user.replace(/^(.).*?(@.*)$/, '$1***$2') : '',
    previewDir: mailPreviewDir(),
  };
}

/**
 * Branded HTML shell used for every transactional email. Kept inline so it
 * renders in Gmail, Outlook and Apple Mail without a stylesheet.
 */
function mailHtml({ heading, intro = '', body = '', rows = [], actionLabel = '', actionUrl = '', footer = '' }) {
  const rowHtml = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
        ${rows.map(([label, value]) => `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #DCE5D5;color:#647568;width:38%">${escapeHtml(label)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #DCE5D5;color:#10281A">${escapeHtml(value)}</td>
        </tr>`).join('')}
      </table>`
    : '';
  const button = actionLabel && actionUrl
    ? `<p style="margin:26px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#9BD84A;color:#10281A;text-decoration:none;font-weight:700;padding:12px 20px">${escapeHtml(actionLabel)}</a></p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F3F7EC">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F3F7EC">
<tr><td style="padding:28px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;width:100%;background:#FFFFFF;border:1px solid #DCE5D5">
  <tr><td style="background:#16402A;padding:18px 24px;color:#E7F0DA;font:700 15px/1.4 'Segoe UI',Arial,sans-serif">
    ${escapeHtml(DEFAULT_SETTINGS.storeName)}
    <span style="float:right;font-weight:400;font-size:12px;color:#A9C9A0">Seeds, feed, fertilizer and tools</span>
  </td></tr>
  <tr><td style="padding:24px;font:400 14px/1.6 'Segoe UI',Arial,sans-serif;color:#10281A">
    <h1 style="margin:0 0 10px;font-size:20px;line-height:1.3">${escapeHtml(heading)}</h1>
    ${intro ? `<p style="margin:0 0 8px;color:#647568">${escapeHtml(intro)}</p>` : ''}
    ${rowHtml}
    ${body}
    ${button}
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #DCE5D5;color:#647568;font:400 12px/1.5 'Segoe UI',Arial,sans-serif">
    ${footer ? `${escapeHtml(footer)}<br>` : ''}
    AgriMart, Poblacion, Victoria, Oriental Mindoro
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function plainTextToHtml(text) {
  return `<p style="margin:0 0 12px">${escapeHtml(text).replace(/\n{2,}/g, '</p><p style="margin:0 0 12px">').replace(/\n/g, '<br>')}</p>`;
}

/** Write an email to .tmp/mail so it can be inspected without an SMTP server. */
function recordPreview({ to, subject, text, html, error }) {
  try {
    const dir = mailPreviewDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `${stamp}-${slugify(subject).slice(0, 40) || 'mail'}.html`;
    const file = path.join(dir, name);
    const note = error
      ? `<p style="margin:0 0 12px;color:#A33B2A;font:600 13px 'Segoe UI',Arial,sans-serif">Delivery failed: ${escapeHtml(error)}</p>`
      : '';
    fs.writeFileSync(
      file,
      `<!-- to: ${escapeHtml(to)} -->
${note}${html || mailHtml({ heading: subject, body: plainTextToHtml(text) })}`,
      'utf8'
    );
    return file;
  } catch {
    return '';
  }
}

function latestPreview() {
  try {
    const dir = mailPreviewDir();
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.html')).sort();
    return files.length ? path.join(dir, files[files.length - 1]) : '';
  } catch {
    return '';
  }
}

function logInfo(message) {
  if (typeof strapi !== 'undefined' && strapi.log) strapi.log.info(message);
  else console.log(message);
}

function logWarn(message) {
  if (typeof strapi !== 'undefined' && strapi.log) strapi.log.warn(message);
  else console.warn(message);
}

function mailTransport() {
  if (mailer) return mailer;
  const cfg = smtpConfig();
  if (!cfg.configured) return null;
  mailer = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: !cfg.secure && cfg.port === 587,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return mailer;
}

function transientMailError(err) {
  const code = String(err.code || '').toUpperCase();
  if (code === 'EAUTH' || code === 'EENVELOPE') return false;
  return ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET', 'EAI_AGAIN', 'EPIPE']
    .includes(code) || num(err.responseCode) >= 500;
}

async function sendMail({ to, subject, text, html }) {
  if (!to) return false;
  const cfg = smtpConfig();
  const content = html || mailHtml({ heading: subject, body: plainTextToHtml(text) });

  if (!cfg.configured) {
    const file = recordPreview({ to, subject, text, html: content });
    logInfo(`[email:preview] to=${to} subject="${subject}"${file ? ` saved=${file}` : ''}`);
    return false;
  }

  const attempt = async () => mailTransport().sendMail({ from: cfg.from, to, subject, text, html: content });
  try {
    await attempt();
    logInfo(`[email] sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    if (transientMailError(err)) {
      try {
        await new Promise((resolve) => { setTimeout(resolve, 1200); });
        await attempt();
        logInfo(`[email] sent to ${to} after retry: ${subject}`);
        return true;
      } catch (retryErr) {
        return failedMail({ to, subject, text, html: content, err: retryErr });
      }
    }
    return failedMail({ to, subject, text, html: content, err });
  }
}

function failedMail({ to, subject, text, html, err }) {
  const file = recordPreview({ to, subject, text, html, error: err.message });
  logWarn(`[email] failed to ${to}: ${err.message}${file ? ` (saved ${file})` : ''}`);
  return false;
}

/** Verify the SMTP connection and send one message. Used by the admin screen. */
async function sendTestMail(to) {
  const status = mailStatus();
  let verified = null;
  let verifyError = '';
  if (status.configured) {
    try {
      await mailTransport().verify();
      verified = true;
    } catch (err) {
      verified = false;
      verifyError = err.message;
    }
  }
  const sent = await sendMail({
    to,
    subject: 'AgriMart email test',
    text: [
      'This is a test message from the AgriMart store.',
      '',
      `SMTP mode: ${status.mode}`,
      status.configured ? `Host: ${status.host}:${status.port}` : 'Add SMTP_HOST, SMTP_USER and SMTP_PASS to send real email.',
    ].join('\n'),
  });
  return {
    configured: status.configured,
    mode: status.mode,
    host: status.host,
    from: status.from,
    verified,
    verifyError,
    sent,
    preview: sent ? '' : latestPreview(),
  };
}

async function sendOrderMail(order, subject, intro) {
  const customerEmail = order?.customer?.email || order?.user?.email;
  if (!customerEmail) return false;
  const address = order.fulfillmentType === 'delivery' && order.address
    ? [order.address.street, order.address.barangay, order.address.municipality, order.address.province].filter(Boolean).join(', ')
    : '';
  const lines = [
    `Order ${order.reference || order.id}`,
    '',
    intro,
    '',
    `Status: ${STATUS_LABELS[order.status] || order.status}`,
    `Fulfillment: ${order.fulfillmentType === 'pickup' ? 'Store pickup' : 'Delivery'}`,
    address ? `Address: ${address}` : '',
    '',
    'Items',
    ...(order.items || []).map((item) => `- ${item.product?.name || 'Item'} x${item.quantity}: ${money(item.subtotal)}`),
    '',
    `Subtotal: ${money((order.items || []).reduce((s, i) => s + num(i.subtotal), 0))}`,
    `Delivery fee: ${money(order.deliveryFee)}`,
    `Total: ${money(order.totalAmount)}`,
    '',
    'AgriMart, Poblacion, Victoria, Oriental Mindoro',
  ].filter((line) => line !== '');

  const itemRows = (order.items || []).map((item) => `<tr>
    <td style="padding:6px 0;border-bottom:1px solid #DCE5D5">${escapeHtml(item.product?.name || 'Item')}</td>
    <td style="padding:6px 0;border-bottom:1px solid #DCE5D5;text-align:center;color:#647568">${num(item.quantity)}</td>
    <td style="padding:6px 0;border-bottom:1px solid #DCE5D5;text-align:right">${money(item.subtotal)}</td>
  </tr>`).join('');
  const body = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <tr>
        <th style="text-align:left;padding:6px 0;border-bottom:1px solid #10281A;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#647568">Item</th>
        <th style="text-align:center;padding:6px 0;border-bottom:1px solid #10281A;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#647568">Qty</th>
        <th style="text-align:right;padding:6px 0;border-bottom:1px solid #10281A;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#647568">Amount</th>
      </tr>
      ${itemRows}
      <tr><td colspan="2" style="padding:8px 0;text-align:right;color:#647568">Delivery fee</td><td style="padding:8px 0;text-align:right">${money(order.deliveryFee)}</td></tr>
      <tr><td colspan="2" style="padding:8px 0;text-align:right;font-weight:700">Total</td><td style="padding:8px 0;text-align:right;font-weight:700">${money(order.totalAmount)}</td></tr>
    </table>`;

  return sendMail({
    to: customerEmail,
    subject,
    text: lines.join('\n'),
    html: mailHtml({
      heading: subject,
      intro,
      rows: [
        ['Order', order.reference || String(order.id)],
        ['Status', STATUS_LABELS[order.status] || order.status],
        ['Fulfillment', order.fulfillmentType === 'pickup' ? 'Store pickup' : 'Delivery'],
        ...(address ? [['Address', address]] : []),
      ],
      body,
    }),
  });
}

async function sendLowStockAlert(product) {
  const settings = await getSettings();
  const to = settings.lowStockEmail || settings.supportEmail;
  if (!to) return false;
  const remaining = num(product.stockQty);
  return sendMail({
    to,
    subject: `Low stock: ${product.name} (${remaining} left)`,
    text: [
      `${product.name} is at or below its reorder level.`,
      '',
      `On hand: ${remaining} ${product.unit || ''}`,
      `Reorder level: ${num(product.reorderLevel, 10)}`,
      `Price: ${money(product.price)}`,
      '',
      'Record a stock-in in the admin inventory page to clear this alert.',
    ].join('\n'),
  });
}

/* ------------------------------------------------------------------ */
/* admin helpers                                                       */
/* ------------------------------------------------------------------ */

async function adminListProducts(query = {}) {
  const result = await listProducts({ ...query, activeOnly: false, includeInactive: true });
  return result;
}

async function createProduct(data) {
  const name = String(data.name || '').trim();
  if (!name) throw Object.assign(new Error('Enter a product name.'), { status: 400, expose: true });
  let slug = slugify(data.slug || name);
  let n = 1;
  while (await strapi.db.query(UID.product).findOne({ where: { slug } })) {
    slug = `${slugify(data.slug || name)}-${n += 1}`;
  }
  const categoryId = data.categoryId ? num(data.categoryId) : null;
  const product = await strapi.db.query(UID.product).create({
    data: {
      name,
      slug,
      description: data.description || '',
      brand: data.brand || '',
      unit: data.unit || 'piece',
      price: num(data.price),
      stockQty: num(data.stockQty),
      reorderLevel: num(data.reorderLevel, 10),
      imageUrl: data.imageUrl || null,
      galleryUrls: Array.isArray(data.galleryUrls) ? data.galleryUrls : [],
      isActive: data.isActive !== false,
      isFeatured: Boolean(data.isFeatured),
      soldCount: 0,
      category: categoryId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return product;
}

async function updateProduct(id, data) {
  const product = await strapi.db.query(UID.product).findOne({ where: { id: num(id) } });
  if (!product) throw Object.assign(new Error('Product not found.'), { status: 404, expose: true });
  const patch = { updatedAt: new Date() };
  for (const key of ['name', 'description', 'brand', 'unit', 'imageUrl']) {
    if (data[key] !== undefined) patch[key] = data[key];
  }
  for (const key of ['price', 'stockQty', 'reorderLevel']) {
    if (data[key] !== undefined) patch[key] = num(data[key]);
  }
  if (data.isActive !== undefined) patch.isActive = Boolean(data.isActive);
  if (data.isFeatured !== undefined) patch.isFeatured = Boolean(data.isFeatured);
  if (data.slug) {
    const slug = slugify(data.slug);
    if (slug !== product.slug) {
      const clash = await strapi.db.query(UID.product).findOne({ where: { slug } });
      if (clash && clash.id !== product.id) {
        throw Object.assign(new Error('That slug is already used.'), { status: 409, expose: true });
      }
      patch.slug = slug;
    }
  }
  if (data.galleryUrls !== undefined) {
    patch.galleryUrls = Array.isArray(data.galleryUrls) ? data.galleryUrls : [];
  }
  if (data.categoryId !== undefined) patch.category = data.categoryId ? num(data.categoryId) : null;
  await strapi.db.query(UID.product).update({ where: { id: product.id }, data: patch });
  return strapi.db.query(UID.product).findOne({
    where: { id: product.id },
    populate: productPopulate(),
  });
}

async function recordStockChange({ productId, changeQty, reason, user, note }) {
  const delta = Number(changeQty);
  if (!Number.isFinite(delta) || delta === 0) {
    throw Object.assign(new Error('Enter a quantity other than zero.'), { status: 400, expose: true });
  }
  if (!['stock_in', 'adjustment', 'spoilage', 'sale'].includes(reason)) {
    throw Object.assign(new Error('Choose a valid stock reason.'), { status: 400, expose: true });
  }
  const product = await strapi.db.query(UID.product).findOne({ where: { id: num(productId) } });
  if (!product) throw Object.assign(new Error('Product not found.'), { status: 404, expose: true });
  const before = num(product.stockQty);
  const after = Math.max(0, before + delta);
  await strapi.db.query(UID.product).update({
    where: { id: product.id },
    data: { stockQty: after, updatedAt: new Date() },
  });
  const log = await strapi.db.query(UID.inventory).create({
    data: {
      product: product.id,
      user: user ? user.id : null,
      changeQty: delta,
      reason,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  if (after <= num(product.reorderLevel, 10) && before > num(product.reorderLevel, 10)) {
    await sendLowStockAlert({ ...product, stockQty: after });
  }
  return {
    log: serializeLog({ ...log, product, user }),
    product: serializeProduct({ ...product, stockQty: after }),
    note: note || '',
  };
}

function serializeLog(log) {
  return {
    id: log.id,
    changeQty: num(log.changeQty),
    reason: log.reason,
    createdAt: log.createdAt,
    product: log.product ? {
      id: log.product.id,
      name: log.product.name,
      slug: log.product.slug,
      unit: log.product.unit || '',
      stockQty: num(log.product.stockQty),
    } : null,
    user: log.user ? {
      id: log.user.id,
      fullName: log.user.fullName || log.user.username || '',
      roleName: log.user.roleName || '',
    } : null,
  };
}

async function listInventoryLogs({ limit = 50, productId } = {}) {
  const where = {};
  if (productId) where.product = num(productId);
  const rows = await strapi.db.query(UID.inventory).findMany({
    where,
    populate: { product: true, user: true },
    orderBy: [{ createdAt: 'desc' }],
    limit: Math.min(200, Math.max(1, num(limit, 50))),
  });
  return rows.map(serializeLog);
}

async function listLowStock() {
  const rows = await strapi.db.query(UID.product).findMany({
    where: { isActive: true },
    populate: productPopulate(),
    orderBy: [{ stockQty: 'asc' }],
    limit: 100,
  });
  return rows
    .filter((p) => num(p.stockQty) <= num(p.reorderLevel, 10))
    .map((p) => serializeProduct(p));
}

async function listOrders({ status, from, to, limit = 50, userId } = {}) {
  const where = {};
  if (status && ORDER_STATUSES.includes(status)) where.status = status;
  if (userId) where.user = num(userId);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.$gte = startOfDay(parseDate(from, new Date()));
    if (to) where.createdAt.$lte = endOfDay(parseDate(to, new Date()));
  }
  const rows = await strapi.db.query(UID.order).findMany({
    where,
    populate: orderPopulate(),
    orderBy: [{ createdAt: 'desc' }],
    limit: Math.min(200, Math.max(1, num(limit, 50))),
  });
  return rows.map((o) => serializeOrder(o));
}

/**
 * Move an order through the allowed status graph, keeping stock and email in sync.
 * Cancelling restores any stock already deducted. Any forward status past pending
 * deducts stock exactly once.
 */
async function setOrderStatus(orderId, nextStatus, user) {
  if (!ORDER_STATUSES.includes(nextStatus)) {
    throw Object.assign(new Error('Choose a valid order status.'), { status: 400, expose: true });
  }
  let order = await getOrderById(orderId);
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404, expose: true });
  if (order.status === nextStatus) return serializeOrder(order);
  if (order.payment && order.payment.method !== 'cod' && order.payment.status !== 'paid' && nextStatus !== 'cancelled') {
    throw Object.assign(new Error('Online payment must be confirmed before this order can be processed.'), {
      status: 400,
      expose: true,
    });
  }

  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    const label = (status) => STATUS_LABELS[status] || status;
    throw Object.assign(
      new Error(`An order that is ${label(order.status)} cannot become ${label(nextStatus)}.`),
      { status: 400, expose: true }
    );
  }

  if (nextStatus === 'cancelled') {
    await restoreStockForOrder(order, user, 'adjustment');
    if (order.payment && order.payment.status !== 'paid') {
      await strapi.db.query(UID.payment).update({
        where: { id: order.payment.id },
        data: { status: 'failed', updatedAt: new Date() },
      });
    }
  } else if (['paid', 'preparing', 'out_for_delivery', 'completed'].includes(nextStatus)) {
    await deductStockForOrder(order, user);
    const cashCollected = nextStatus === 'paid'
      || (nextStatus === 'completed' && order.payment && order.payment.method === 'cod');
    if (order.payment && cashCollected && order.payment.status !== 'paid') {
      await strapi.db.query(UID.payment).update({
        where: { id: order.payment.id },
        data: { status: 'paid', paidAt: order.payment.paidAt || new Date(), updatedAt: new Date() },
      });
    }
  }

  order = await getOrderById(orderId);
  const history = await appendStatusHistory(order, nextStatus, user);
  await strapi.db.query(UID.order).update({
    where: { id: order.id },
    data: { status: nextStatus, statusHistory: history, updatedAt: new Date() },
  });

  const fresh = await getOrderById(order.id);
  const serialized = serializeOrder(fresh);
  await sendOrderMail(
    serialized,
    `Order ${serialized.reference} is ${STATUS_LABELS[nextStatus] || nextStatus}`,
    `Your order status changed to ${STATUS_LABELS[nextStatus] || nextStatus}.`
  );
  return serialized;
}

/**
 * Mark an order paid from a PayMongo webhook or the local simulator.
 * Safe to call more than once.
 */
async function markOrderPaid(orderId, { paymongoRef, method, user } = {}) {
  let order = await getOrderById(orderId);
  if (!order) return null;

  // Keep the checkout session id (`cs_...`) in the payment record: the return
  // page and staff tools use it to re-check the session after a webhook miss.
  const mergeRef = (current, incoming) => {
    const now = String(current || '');
    const next = String(incoming || '');
    if (!next) return now || undefined;
    if (!now) return next;
    if (now.startsWith('cs_') && !next.startsWith('cs_')) return now;
    return next;
  };

  // A successful PayMongo event can arrive after the customer cancelled or
  // the provider return URL was delayed. Record the money received, but never
  // revive the cancelled order or deduct shelf stock automatically.
  if (order.status === 'cancelled') {
    if (order.payment && order.payment.status !== 'paid') {
      const nextRef = mergeRef(order.payment.paymongoRef, paymongoRef);
      await strapi.db.query(UID.payment).update({
        where: { id: order.payment.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          ...(nextRef ? { paymongoRef: nextRef } : {}),
          ...(method ? { method } : {}),
          updatedAt: new Date(),
        },
      });
    }
    strapi.log.error(`[payments] payment received for cancelled order ${order.orderNumber}; review for refund`);
    return serializeOrder(await getOrderById(order.id));
  }

  if (order.payment && order.payment.status !== 'paid') {
    const nextRef = mergeRef(order.payment.paymongoRef, paymongoRef);
    await strapi.db.query(UID.payment).update({
      where: { id: order.payment.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        ...(nextRef ? { paymongoRef: nextRef } : {}),
        ...(method ? { method } : {}),
        updatedAt: new Date(),
      },
    });
  }
  if (!order.stockDeducted) await deductStockForOrder(order, user);
  if (order.status === 'pending') {
    const history = await appendStatusHistory(order, 'paid', user);
    await strapi.db.query(UID.order).update({
      where: { id: order.id },
      data: { status: 'paid', statusHistory: history, updatedAt: new Date() },
    });
  }
  const fresh = await getOrderById(order.id);
  const serialized = serializeOrder(fresh);
  await sendOrderMail(
    serialized,
    `Payment received for order ${serialized.reference}`,
    'We received your payment. Your order is now marked paid and the stock is reserved.'
  );
  return serialized;
}

module.exports = {
  UID,
  ORDER_STATUSES,
  STATUS_LABELS,
  TRANSITIONS,
  DEFAULT_FEES,
  DEFAULT_SETTINGS,
  num,
  coordinates,
  money,
  slugify,
  escapeHtml,
  parseDate,
  startOfDay,
  endOfDay,
  dateKey,
  fail,
  guard,
  signToken,
  currentUser,
  requireRole,
  sanitizeUser,
  hashPassword,
  createUserRecord,
  getSettings,
  getHome,
  getAbout,
  getContact,
  ensureRow,
  getRow,
  mediaUrl,
  stockState,
  serializeProduct,
  productPopulate,
  serializeReview,
  productReviewData,
  productRatingSummaries,
  reviewEligibility,
  listProducts,
  listCategories,
  listBrands,
  getProductBySlug,
  serializeAnnouncement,
  listPublishedAnnouncements,
  dedupeAnnouncements,
  orderPopulate,
  serializeOrder,
  getOrderById,
  nextOrderNumber,
  deliveryFeeFor,
  deductStockForOrder,
  restoreStockForOrder,
  appendStatusHistory,
  sendMail,
  sendOrderMail,
  sendLowStockAlert,
  sendTestMail,
  mailStatus,
  mailHtml,
  adminListProducts,
  createProduct,
  updateProduct,
  recordStockChange,
  serializeLog,
  listInventoryLogs,
  listLowStock,
  listOrders,
  setOrderStatus,
  markOrderPaid,
  safeJson,
};
