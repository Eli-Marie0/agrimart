'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const A = require('../../../lib/agrimart');

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateKey(ctx, email) {
  const ip = ctx.request.ip || ctx.ip || 'unknown';
  return `${ip}|${String(email || '').toLowerCase()}`;
}

function isLocked(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function noteAttempt(key, success) {
  if (success) {
    attempts.delete(key);
    return;
  }
  const entry = attempts.get(key) || { count: 0, first: Date.now() };
  if (Date.now() - entry.first > WINDOW_MS) {
    entry.count = 0;
    entry.first = Date.now();
  }
  entry.count += 1;
  attempts.set(key, entry);
}

function addressOf(row) {
  return {
    id: row.id,
    label: row.label || '',
    street: row.street || '',
    barangay: row.barangay || '',
    municipality: row.municipality || '',
    province: row.province || 'Oriental Mindoro',
    latitude: row.latitude ? A.num(row.latitude) : null,
    longitude: row.longitude ? A.num(row.longitude) : null,
    isDefault: Boolean(row.isDefault),
  };
}

async function addressesFor(userId) {
  const rows = await strapi.db.query(A.UID.address).findMany({
    where: { user: userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(addressOf);
}

async function readAddress(body) {
  const street = String(body.street || '').trim();
  const barangay = String(body.barangay || '').trim();
  const municipality = String(body.municipality || '').trim();
  if (!barangay || !municipality) {
    throw Object.assign(new Error('Add a barangay and municipality.'), { status: 400, expose: true });
  }
  return {
    label: String(body.label || 'Home').slice(0, 60),
    street: street.slice(0, 200),
    barangay: barangay.slice(0, 120),
    municipality: municipality.slice(0, 120),
    province: String(body.province || 'Oriental Mindoro').slice(0, 120),
    ...A.coordinates(body),
    isDefault: Boolean(body.isDefault),
  };
}

module.exports = {
  async logout(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      await strapi.db.query(A.UID.user).update({
        where: { id: user.id },
        data: { sessionVersion: A.num(user.sessionVersion) + 1, updatedAt: new Date() },
      });
      ctx.body = { data: { loggedOut: true } };
    });
  },

  async register(ctx) {
    return A.guard(async () => {
      const body = ctx.request.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      const fullName = String(body.fullName || '').trim();
      if (fullName.length < 2) return A.fail(ctx, 400, 'Enter your full name.');
      if (!email) return A.fail(ctx, 400, 'Enter your email address.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return A.fail(ctx, 400, 'Enter a valid email address.');
      if (String(body.password || '').length < 8) return A.fail(ctx, 400, 'Use at least 8 characters for your password.');
      if (body.password !== body.passwordConfirmation && body.passwordConfirmation !== undefined) {
        return A.fail(ctx, 400, 'The passwords do not match.');
      }
      const user = await A.createUserRecord({
        email,
        password: body.password,
        fullName,
        phone: String(body.phone || '').trim(),
        roleName: 'customer',
      });
      const token = A.signToken(user);
      ctx.body = { data: { token, user: A.sanitizeUser(user) } };
    });
  },

  async login(ctx) {
    return A.guard(async () => {
      const body = ctx.request.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const key = rateKey(ctx, email);
      if (isLocked(key)) {
        return A.fail(ctx, 429, 'Too many attempts. Wait 10 minutes and try again.');
      }
      if (!email || !password) return A.fail(ctx, 400, 'Enter your email and password.');

      const user = await strapi.db.query(A.UID.user).findOne({ where: { email }, populate: { role: true } });
      if (!user || !user.password) {
        noteAttempt(key, false);
        return A.fail(ctx, 401, 'That email and password do not match.');
      }
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        noteAttempt(key, false);
        return A.fail(ctx, 401, 'That email and password do not match.');
      }
      if (user.blocked || user.isActive === false) {
        return A.fail(ctx, 403, 'This account is deactivated. Contact the store owner.');
      }
      if (!user.role || (user.role && user.role.type === 'public')) {
        const authenticated = await strapi.db.query(A.UID.role).findOne({ where: { type: 'authenticated' } });
        if (authenticated) {
          await strapi.db.query(A.UID.user).update({ where: { id: user.id }, data: { role: authenticated.id } });
        }
      }
      noteAttempt(key, true);
      const token = A.signToken(user);
      ctx.body = { data: { token, user: A.sanitizeUser(user) } };
    });
  },

  async me(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      ctx.body = {
        data: {
          user: A.sanitizeUser(user),
          addresses: await addressesFor(user.id),
        },
      };
    });
  },

  async updateMe(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const body = ctx.request.body || {};
      const patch = { updatedAt: new Date() };
      if (body.fullName !== undefined) {
        const fullName = String(body.fullName).trim();
        if (fullName.length < 2) return A.fail(ctx, 400, 'Enter your full name.');
        patch.fullName = fullName.slice(0, 120);
      }
      if (body.phone !== undefined) patch.phone = String(body.phone).trim().slice(0, 40);
      if (body.email !== undefined) {
        const email = String(body.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return A.fail(ctx, 400, 'Enter a valid email address.');
        if (email !== user.email) {
          const exists = await strapi.db.query(A.UID.user).findOne({ where: { email } });
          if (exists) return A.fail(ctx, 409, 'That email is already used by another account.');
          patch.email = email;
        }
      }
      const updated = await strapi.db.query(A.UID.user).update({ where: { id: user.id }, data: patch });
      ctx.body = { data: { user: A.sanitizeUser({ ...user, ...updated }), addresses: await addressesFor(user.id) } };
    });
  },

  async changePassword(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const body = ctx.request.body || {};
      const current = String(body.currentPassword || '');
      const next = String(body.newPassword || '');
      if (next.length < 8) return A.fail(ctx, 400, 'Use at least 8 characters for the new password.');
      const ok = await bcrypt.compare(current, user.password || '');
      if (!ok) return A.fail(ctx, 400, 'The current password is not correct.');
      const nextVersion = A.num(user.sessionVersion) + 1;
      await strapi.db.query(A.UID.user).update({
        where: { id: user.id },
        data: { password: await A.hashPassword(next), sessionVersion: nextVersion, updatedAt: new Date() },
      });
      ctx.body = { data: { updated: true, token: A.signToken({ ...user, sessionVersion: nextVersion }) } };
    });
  },

  async forgotPassword(ctx) {
    return A.guard(async () => {
      const email = String(ctx.request.body?.email || '').trim().toLowerCase();
      if (!email) return A.fail(ctx, 400, 'Enter your email address.');
      const user = await strapi.db.query(A.UID.user).findOne({ where: { email } });
      const generic = { data: { sent: true, message: 'If that email is registered, a reset link is on its way.' } };
      if (!user) {
        ctx.body = generic;
        return;
      }
      const token = crypto.randomBytes(24).toString('hex');
      const expires = Date.now() + 60 * 60 * 1000;
      await strapi.db.query(A.UID.user).update({
        where: { id: user.id },
        data: { resetPasswordToken: `${token}|${expires}`, updatedAt: new Date() },
      });
      const base = process.env.FRONTEND_URL || 'http://localhost:3001';
      const link = `${base}/reset-password?code=${token}`;
      await A.sendMail({
        to: user.email,
        subject: 'Reset your AgriMart password',
        text: [
          `Hello ${user.fullName || user.username},`,
          '',
          'Use the link below to choose a new password. It expires in one hour.',
          link,
          '',
          'If you did not ask for this, ignore the email.',
        ].join('\n'),
      });
      ctx.body = {
        ...generic,
        ...(process.env.NODE_ENV !== 'production' ? { debug: { resetUrl: link } } : {}),
      };
    });
  },

  async resetPassword(ctx) {
    return A.guard(async () => {
      const body = ctx.request.body || {};
      const code = String(body.code || '').trim();
      const password = String(body.password || '');
      if (!code) return A.fail(ctx, 400, 'That reset link is incomplete. Request a new one.');
      if (password.length < 8) return A.fail(ctx, 400, 'Use at least 8 characters for your new password.');
      if (body.passwordConfirmation !== undefined && body.passwordConfirmation !== password) {
        return A.fail(ctx, 400, 'The passwords do not match.');
      }
      const user = await strapi.db.query(A.UID.user).findOne({
        where: { resetPasswordToken: { $containsi: code } },
      });
      if (!user || !user.resetPasswordToken) return A.fail(ctx, 400, 'That reset link is invalid or already used.');
      const [, expiry] = String(user.resetPasswordToken).split('|');
      if (!expiry || Number(expiry) < Date.now()) return A.fail(ctx, 400, 'That reset link has expired. Request a new one.');
      await strapi.db.query(A.UID.user).update({
        where: { id: user.id },
        data: {
          password: await A.hashPassword(password),
          sessionVersion: A.num(user.sessionVersion) + 1,
          resetPasswordToken: null,
          updatedAt: new Date(),
        },
      });
      ctx.body = { data: { reset: true } };
    });
  },

  async addresses(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      ctx.body = { data: await addressesFor(user.id) };
    });
  },

  async createAddress(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const data = await readAddress(ctx.request.body || {});
      const existing = await strapi.db.query(A.UID.address).findMany({
        where: { user: user.id },
        limit: 20,
      });
      if (existing.length >= 20) return A.fail(ctx, 400, 'You can save up to 20 addresses.');
      const makeDefault = data.isDefault || existing.length === 0;
      if (makeDefault) {
        await strapi.db.query(A.UID.address).updateMany({
          where: { user: user.id },
          data: { isDefault: false },
        });
      }
      const row = await strapi.db.query(A.UID.address).create({
        data: {
          user: user.id,
          label: data.label,
          street: data.street,
          barangay: data.barangay,
          municipality: data.municipality,
          province: data.province,
          latitude: data.latitude,
          longitude: data.longitude,
          isDefault: makeDefault,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      ctx.body = { data: addressOf(row) };
    });
  },

  async updateAddress(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.address).findOne({
        where: { id },
        populate: { user: true },
      });
      if (!row || A.num(row.user?.id) !== A.num(user.id)) return A.fail(ctx, 404, 'Address not found.');
      const data = await readAddress(ctx.request.body || {});
      if (data.isDefault) {
        await strapi.db.query(A.UID.address).updateMany({
          where: { user: user.id },
          data: { isDefault: false },
        });
      }
      const updated = await strapi.db.query(A.UID.address).update({
        where: { id },
        data: { ...data, updatedAt: new Date() },
      });
      ctx.body = { data: addressOf(updated) };
    });
  },

  async deleteAddress(ctx) {
    return A.guard(async () => {
      const user = await A.requireRole(ctx);
      if (!user) return;
      const id = A.num(ctx.params.id);
      const row = await strapi.db.query(A.UID.address).findOne({
        where: { id },
        populate: { user: true },
      });
      if (!row || A.num(row.user?.id) !== A.num(user.id)) return A.fail(ctx, 404, 'Address not found.');
      await strapi.db.query(A.UID.address).delete({ where: { id } });
      ctx.body = { data: { deleted: true } };
    });
  },
};
