'use strict';
/**
 * AgriMart seed: 7 categories, 12 products, 3 announcements, 3 single types.
 * Run from the agrimart-api folder with the Strapi server STOPPED:
 *   node scripts/seed.js
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const CATEGORIES = [
  ['Seeds', 'Sealed packs for field and garden.'],
  ['Fertilizer', 'Sacks for every stage of the crop.'],
  ['Pesticide', 'Crop protection. Always read the label.'],
  ['Feeds', 'Feed for hogs, poultry and cattle.'],
  ['Veterinary', 'Medicines and vitamins for livestock.'],
  ['Tools', 'Hand tools for daily farm work.'],
  ['Irrigation', 'Drip tape, sprayers and fittings.'],
];

// [category, name, brand, unit, price, stock, reorderLevel, featured, soldThisMonth, description]
const PRODUCTS = [
  ['Seeds', 'Hybrid Corn Seed', 'Pioneer', '1 kg', 420, 64, 20, true, 48, 'Sealed packs. Check the pack for sowing rate and date.'],
  ['Seeds', 'Ampalaya Seed Pack', 'East-West', '50 g', 95, 8, 15, false, 30, 'Sealed packs. Check the pack for sowing rate and date.'],
  ['Fertilizer', 'Complete 14-14-14', 'Atlas', '50 kg', 1850, 22, 10, true, 71, 'Sold by the sack. Store dry and off the ground.'],
  ['Fertilizer', 'Urea 46-0-0', 'Atlas', '50 kg', 1620, 5, 10, false, 90, 'Sold by the sack. Store dry and off the ground.'],
  ['Pesticide', 'Neem Bio-Spray', 'GreenShield', '1 L', 340, 30, 10, false, 22, 'Read the label before mixing or spraying.'],
  ['Feeds', 'Hog Grower Pellets', 'Pilmico', '25 kg', 1180, 40, 12, true, 64, 'Fresh stock by the sack. Keep sealed and dry.'],
  ['Feeds', 'Layer Mash', 'Vitarich', '50 kg', 1560, 14, 15, true, 80, 'Fresh stock by the sack. Keep sealed and dry.'],
  ['Veterinary', 'Dewormer Ivermectin', 'VetOne', '100 ml', 280, 0, 8, false, 41, 'Check dose and expiry on the label.'],
  ['Veterinary', 'Vitamin B-Complex', 'VetOne', '50 ml', 190, 26, 10, false, 35, 'Check dose and expiry on the label.'],
  ['Tools', 'Steel Bolo', 'Tramontina', '1 pc', 350, 18, 6, false, 19, 'Built for daily farm work.'],
  ['Irrigation', 'Drip Tape Roll', 'AquaLine', '500 m', 2400, 9, 4, false, 12, 'Cut to length at the store on request.'],
  ['Irrigation', 'Knapsack Sprayer', 'Solo', '16 L', 1450, 12, 5, true, 27, 'Cut to length at the store on request.'],
];

const ANNOUNCEMENTS = [
  ['Planting season: corn and rice', 'Wet-season sowing starts this month. Order seed early and reserve fertilizer for pickup.', true],
  ['Free delivery above ₱3,000', 'AgriMart Plus members get free delivery on orders over ₱3,000 inside Victoria.', true],
  ['Avian flu advisory', 'Disinfect coops weekly and limit visitors. Poultry vitamins are back in stock.', false],
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function seed(strapi) {
  const count = await strapi.documents('api::category.category').count({});
  if (count > 0) {
    console.log('Categories already exist. Skipping seed.');
    return;
  }

  const catId = {};
  for (const [name, description] of CATEGORIES) {
    const doc = await strapi.documents('api::category.category').create({ data: { name, slug: slugify(name), description } });
    catId[name] = doc.documentId;
  }
  console.log(`Created ${CATEGORIES.length} categories`);

  for (const [cat, name, brand, unit, price, stockQty, reorderLevel, isFeatured, soldCount, description] of PRODUCTS) {
    await strapi.documents('api::product.product').create({
      data: { name, slug: slugify(name), brand, unit, price, stockQty, reorderLevel, isFeatured, soldCount, description, isActive: true, category: catId[cat] },
    });
  }
  console.log(`Created ${PRODUCTS.length} products`);

  for (const [title, body, isPinned] of ANNOUNCEMENTS) {
    await strapi.documents('api::announcement.announcement').create({ data: { title, body, isPinned }, status: 'published' });
  }
  console.log(`Created ${ANNOUNCEMENTS.length} announcements`);

  await strapi.documents('api::home.home').create({
    data: {
      heroTitle: 'Check the shelf before you make the trip.',
      heroText: 'Seeds, feed, fertilizer and tools from our store in Victoria. See what is in stock and what it costs, then pick up or have it delivered.',
      promoTitle: 'Free delivery above ₱3,000 for AgriMart Plus members',
      promoText: 'Bulk-price discounts and early access to promos.',
    },
  });
  await strapi.documents('api::about.about').create({
    data: {
      title: 'About AgriMart',
      body: 'AgriMart is a farm supply shop in Victoria, Oriental Mindoro. We sell seeds, fertilizer, feed, veterinary supplies, tools and irrigation equipment to farmers, livestock raisers and home growers.',
    },
  });
  await strapi.documents('api::contact-info.contact-info').create({
    data: { address: 'Poblacion, Victoria, Oriental Mindoro', hours: 'Mon to Sat 7:00 am to 6:00 pm\nSun 7:00 am to 12:00 pm' },
  });
  console.log('Created Home, About and Contact info');
}

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';
  try {
    await seed(app);
    console.log('Seed finished.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  }
  await app.destroy();
  process.exit(process.exitCode || 0);
}

main();
