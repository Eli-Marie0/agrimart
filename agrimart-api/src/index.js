'use strict';

const A = require('./lib/agrimart');
const paymongo = require('./lib/paymongo');
const paypal = require('./lib/paypal');

const DEMO_USERS = [
  { email: 'admin@agrimart.ph', password: 'Admin123!', fullName: 'AgriMart Admin', roleName: 'admin', phone: '0917 000 0001' },
  { email: 'staff@agrimart.ph', password: 'Staff123!', fullName: 'Store Staff', roleName: 'staff', phone: '0917 000 0002' },
  { email: 'customer@agrimart.ph', password: 'Customer123!', fullName: 'Juan Dela Cruz', roleName: 'customer', phone: '0917 000 0003' },
];

async function ensureSingleTypes() {
  await A.getSettings();
  await A.getHome();
  await A.getAbout();
  await A.getContact();
}

async function normalizeUsers() {
  const authenticated = await strapi.db.query(A.UID.role).findOne({ where: { type: 'authenticated' } });
  const publicRole = await strapi.db.query(A.UID.role).findOne({ where: { type: 'public' } });

  await strapi.db.query(A.UID.user).updateMany({
    where: { roleName: null },
    data: { roleName: 'customer' },
  });

  if (authenticated) {
    if (publicRole) {
      const orphans = await strapi.db.query(A.UID.user).findMany({
        where: { role: publicRole.id },
        select: ['id'],
      });
      for (const user of orphans) {
        await strapi.db.query(A.UID.user).update({
          where: { id: user.id },
          data: { role: authenticated.id, roleName: 'customer' },
        });
      }
    }
    const noRole = await strapi.db.query(A.UID.user).findMany({
      where: { role: null },
      select: ['id'],
    });
    for (const user of noRole) {
      await strapi.db.query(A.UID.user).update({
        where: { id: user.id },
        data: { role: authenticated.id },
      });
    }
  }
}

async function seedDemoUsers() {
  if (String(process.env.SEED_DEMO || 'false').toLowerCase() !== 'true') return;
  for (const demo of DEMO_USERS) {
    const existing = await strapi.db.query(A.UID.user).findOne({ where: { email: demo.email } });
    if (existing) continue;
    try {
      await A.createUserRecord(demo);
      strapi.log.info(`[seed] created ${demo.roleName} ${demo.email}`);
    } catch (err) {
      strapi.log.warn(`[seed] could not create ${demo.email}: ${err.message}`);
    }
  }
}

async function ensureFeeDefaults() {
  const settings = await A.getSettings();
  if (!settings.deliveryFees || typeof settings.deliveryFees !== 'object' || Array.isArray(settings.deliveryFees)) {
    const row = await A.getRow(A.UID.settings);
    if (row) {
      await strapi.db.query(A.UID.settings).update({
        where: { id: row.id },
        data: { deliveryFees: A.DEFAULT_FEES, updatedAt: new Date() },
      });
    }
  }
}

module.exports = {
  register() {},

  async bootstrap() {
    try {
      await ensureSingleTypes();
      await ensureFeeDefaults();
      await normalizeUsers();
      await seedDemoUsers();
      const paymentMode = paymongo.configured()
        ? `PayMongo ${paymongo.keyMode()}`
        : paypal.configured() ? `PayPal ${paypal.mode()}` : 'local simulator';
      strapi.log.info(
        `[agrimart] ready — payments: ${paymentMode}, ` +
        `email: ${A.mailStatus().configured ? 'SMTP' : 'preview files (.tmp/mail)'}`
      );
    } catch (err) {
      strapi.log.error('[agrimart] bootstrap failed', err);
    }
  },
};
