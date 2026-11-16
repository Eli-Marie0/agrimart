'use strict';

const A = require('../../../lib/agrimart');

const MAX_COMMENT = 1200;

function cleanComment(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_COMMENT);
}

function reference(order) {
  if (!order) return '';
  return `AGM-${String(order.orderNumber || order.id).padStart(5, '0')}`;
}

module.exports = {
  async create(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx, ['customer']);
      if (!user) return;

      const body = ctx.request.body || {};
      const productId = A.num(body.productId);
      const rating = A.num(body.rating);
      const comment = cleanComment(body.comment);

      if (!productId) return A.fail(ctx, 400, 'Choose a product to review.');
      if (!(rating >= 1 && rating <= 5)) return A.fail(ctx, 400, 'Choose a rating from 1 to 5 stars.');

      const product = await strapi.db.query(A.UID.product).findOne({ where: { id: productId } });
      if (!product) return A.fail(ctx, 404, 'That product was not found.');

      const eligibility = await A.reviewEligibility(user.id, productId);
      if (eligibility.existing) return A.fail(ctx, 409, 'You already reviewed this product.');
      if (!eligibility.order) {
        return A.fail(ctx, 403, 'Reviews open once an order containing this product is delivered.');
      }

      const now = new Date();
      const row = await strapi.db.query(A.UID.review).create({
        data: {
          rating,
          comment: comment || null,
          isVisible: true,
          product: productId,
          user: user.id,
          order: eligibility.order.id,
          orderItem: eligibility.orderItemId || null,
          createdAt: now,
          updatedAt: now,
        },
      });

      const saved = await strapi.db.query(A.UID.review).findOne({
        where: { id: row.id },
        populate: { user: true, product: true, order: true },
      });
      const { reviews, summary } = await A.productReviewData(productId);

      ctx.body = {
        data: {
          review: A.serializeReview(saved),
          reviews,
          summary,
          orderReference: reference(eligibility.order),
        },
      };
    });
  },

  async eligibility(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;

      const productId = A.num(ctx.params.productId);
      if (!productId) return A.fail(ctx, 400, 'Choose a product to review.');

      const result = await A.reviewEligibility(user.id, productId);
      ctx.body = {
        data: {
          canReview: Boolean(result.order && !result.existing),
          orderId: result.order?.id || null,
          orderReference: reference(result.order),
          review: result.existing,
        },
      };
    });
  },

  async mine(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;

      const where = { user: user.id };
      const productId = A.num(ctx.query?.productId);
      if (productId) where.product = productId;

      const rows = await strapi.db.query(A.UID.review).findMany({
        where,
        populate: { user: true, product: true, order: true },
        orderBy: [{ createdAt: 'desc' }],
        limit: 100,
      });

      ctx.body = { data: rows.map((row) => A.serializeReview(row)) };
    });
  },
};
