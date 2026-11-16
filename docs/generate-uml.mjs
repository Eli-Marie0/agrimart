import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  C, text, rect, line, poly, ell, svgDoc, titleBlock, actor, systemActor,
  useCase, footerNote, entityBox, drawEntity, edge,
} from "./lib.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
const write = (name, svg) => writeFileSync(join(OUT, name), svg, "utf8");

/* ------------------------------------------------------------------ *
 * 1. USE CASE DIAGRAM
 * ------------------------------------------------------------------ */
function useCaseDiagram() {
  // One column of use cases grouped by actor keeps every association short and
  // free of crossings: each line stops at the column edge it belongs to.
  const W = 1040, H = 1180;
  let body = titleBlock("AgriMart — Use Case Diagram", "Actors, system boundary and primary use cases", W);

  body += rect(380, 120, 340, 950, { fill: C.surf, stroke: C.ink });
  body += text(396, 146, "AgriMart System", { size: 14, weight: 700, fill: C.forest });

  const CX = 550, LEFT = CX - 104, RIGHT = CX + 104, STEP = 58, TOP = 190;
  const row = (i) => TOP + i * STEP;
  const cases = [
    [0, "Browse & search products"],
    [1, "Register / log in"],
    [2, "Manage profile"],
    [3, "Manage cart & checkout"],
    [4, "Pay online or cash on delivery"],
    [5, "Track orders"],
    [6, "Update stock"],
    [7, "Process orders"],
    [8, "Update order status"],
    [9, "View stock log"],
    [10, "Manage products & categories"],
    [11, "Manage content"],
    [12, "Post announcements"],
    [13, "Manage users"],
    [14, "Generate reports"],
  ];

  const link = (x, y, i) => line(x, y, LEFT, row(i), { stroke: C.line, sw: 1.1 });
  const group = (actorY, rows) => rows.map((i) => link(132, actorY, i)).join("");

  body += group(335, [0, 1, 2, 3, 4, 5]);
  body += group(625, [6, 7, 8, 9]);
  body += group(886, [10, 11, 12, 13, 14]);

  // Secondary actors: each one touches a single use case, ordered so the three
  // connectors never cross.
  const ext = (x, y, i) => line(x, y, RIGHT, row(i), { stroke: C.line, sw: 1.1 });
  body += ext(800, 250, 3);
  body += ext(800, 420, 4);
  body += ext(800, 620, 5);

  cases.forEach(([i, label]) => { body += useCase(CX, row(i), label); });

  body += actor(110, 297, "Customer");
  body += actor(110, 587, "Staff");
  body += actor(110, 848, "Administrator");
  body += systemActor(892, 250, "Google Maps");
  body += systemActor(892, 420, "PayMongo");
  body += systemActor(892, 620, "Email Server");

  body += line(60, 1092, 110, 1092, { stroke: C.line, sw: 1.1 });
  body += text(120, 1096, "Association", { size: 11, fill: C.mut });
  body += rect(270, 1082, 26, 18, { fill: C.surf, stroke: C.ink });
  body += text(306, 1096, "System boundary", { size: 11, fill: C.mut });
  body += text(470, 1096, "«system» = external service connected at run time", { size: 11, fill: C.mut });

  body += footerNote(W, H, "AgriMart · Web Systems and Technologies 2 / System Integration and Architecture 1");
  return svgDoc(W, H, body, "AgriMart use case diagram");
}
write("use-case-diagram.svg", useCaseDiagram());

/* ------------------------------------------------------------------ *
 * 2. ER DIAGRAM
 * ------------------------------------------------------------------ */
function erDiagram() {
  const W = 1520, H = 980;
  let body = titleBlock("AgriMart — Entity Relationship Diagram", "Relational schema: 10 core tables plus CMS support tables", W);

  const roles = entityBox(40, 120, "roles", ["role_id        PK", "role_name", "description"]);
  const users = entityBox(40, 265, "users", [
    "user_id        PK", "role_id        FK", "full_name", "email (unique)",
    "password_hash", "phone", "is_active", "role_name", "created_at",
  ]);
  const addresses = entityBox(40, 536, "addresses", [
    "address_id     PK", "user_id        FK", "label", "street", "barangay",
    "municipality", "province", "latitude", "longitude", "is_default", "created_at",
  ]);
  const categories = entityBox(430, 120, "categories", ["category_id    PK", "name", "slug", "description"]);
  const products = entityBox(430, 286, "products", [
    "product_id     PK", "category_id    FK", "name", "slug", "brand", "unit",
    "price", "stock_qty", "reorder_level", "image_url", "description",
    "is_active", "is_featured", "created_at",
  ]);
  const inventory = entityBox(430, 662, "inventory_logs", [
    "log_id         PK", "product_id     FK", "user_id        FK", "change_qty",
    "reason", "note", "created_at",
  ]);
  const orders = entityBox(820, 120, "orders", [
    "order_id       PK", "reference", "user_id        FK", "address_id     FK",
    "fulfillment_type", "subtotal", "delivery_fee", "total_amount", "status",
    "notes", "created_at", "updated_at",
  ]);
  const items = entityBox(820, 454, "order_items", [
    "order_item_id  PK", "order_id       FK", "product_id     FK", "quantity",
    "unit_price", "subtotal",
  ]);
  const payments = entityBox(820, 662, "payments", [
    "payment_id     PK", "order_id       FK", "method", "paymongo_ref",
    "amount", "status", "paid_at", "created_at",
  ]);
  const announcements = entityBox(1210, 120, "announcements", [
    "announcement_id PK", "author_id      FK", "title", "body", "is_pinned",
    "published_at", "created_at",
  ]);
  const messages = entityBox(1210, 349, "contact_messages", [
    "message_id     PK", "name", "email", "phone", "subject", "message",
    "status", "created_at",
  ]);
  const settings = entityBox(1210, 599, "settings", [
    "setting_id     PK", "store_name", "tagline", "announcement_bar",
    "default_delivery_fee", "free_delivery_threshold", "default_reorder_level",
    "low_stock_email", "maintenance_mode", "updated_at",
  ]);

  // Relationships (1 : M)
  body += edge([[180, roles.bottom], [180, users.y]], [{ x: 192, y: 248, t: "1" }, { x: 192, y: 263, t: "M" }]);
  body += edge([[180, users.bottom], [180, addresses.y]], [{ x: 192, y: 519, t: "1" }, { x: 192, y: 534, t: "M" }]);
  body += edge([[570, categories.bottom], [570, products.y]], [{ x: 582, y: 269, t: "1" }, { x: 582, y: 284, t: "M" }]);
  body += edge([[570, products.bottom], [570, inventory.y]], [{ x: 582, y: 645, t: "1" }, { x: 582, y: 660, t: "M" }]);
  body += edge([[960, orders.bottom], [960, items.y]], [{ x: 972, y: 437, t: "1" }, { x: 972, y: 452, t: "M" }]);
  // orders 1:M payments, routed around the right of order_items
  body += edge([[orders.right, 300], [1150, 300], [1150, 720], [payments.right, 720]], [{ x: 1138, y: 292, t: "1" }, { x: 1138, y: 712, t: "1" }]);
  // users 1:M orders
  body += edge([[users.right, 400], [350, 400], [350, 108], [960, 108], [960, orders.y]], [{ x: 338, y: 392, t: "1" }, { x: 948, y: 120, t: "M" }]);
  // users 1:M announcements
  body += edge([[users.right, 340], [335, 340], [335, 94], [1290, 94], [1290, announcements.y]], [{ x: 323, y: 332, t: "1" }, { x: 1278, y: 108, t: "M" }]);
  // products 1:M order_items
  body += edge([[products.right, 480], [770, 480], [770, 560], [items.x, 560]], [{ x: 718, y: 472, t: "1" }, { x: 806, y: 552, t: "M" }]);
  // users 1:M inventory_logs
  body += edge([[users.right, 460], [350, 460], [350, 760], [inventory.x, 760]], [{ x: 338, y: 452, t: "1" }, { x: 418, y: 752, t: "M" }]);

  [roles, users, addresses, categories, products, inventory, orders, items, payments, announcements, messages, settings]
    .forEach((e) => { body += drawEntity(e); });

  body += rect(40, 876, 280, 52, { fill: C.zone, stroke: C.bd });
  body += text(54, 898, "1 = one    M = many", { size: 12, weight: 600, fill: C.ink });
  body += text(54, 916, "PK = primary key    FK = foreign key", { size: 12, fill: C.mut });

  body += footerNote(W, H, "AgriMart · Web Systems and Technologies 2 / System Integration and Architecture 1");
  return svgDoc(W, H, body, "AgriMart entity relationship diagram");
}
write("er-diagram.svg", erDiagram());

/* ------------------------------------------------------------------ *
 * 3. CONTEXT DIAGRAM
 * ------------------------------------------------------------------ */
function contextDiagram() {
  const W = 1360, H = 690;
  let body = titleBlock("AgriMart — Context Diagram", "The system as a single process and the external entities it exchanges data with", W);

  const entity = (x, y, w, h, label) => rect(x, y, w, h, { fill: C.surf, stroke: C.ink }) +
    text(x + w / 2, y + h / 2 - 4, label, { anchor: "middle", size: 14, weight: 600 }) +
    text(x + w / 2, y + h / 2 + 18, "external entity", { anchor: "middle", size: 11, fill: C.mut });

  body += rect(520, 240, 330, 340, { fill: C.forest, stroke: C.forest });
  body += text(685, 400, "AgriMart System", { anchor: "middle", size: 22, weight: 700, fill: "#E7F0DA" });
  body += text(685, 428, "Next.js · Strapi · MySQL", { anchor: "middle", size: 12, fill: "#C9DDC0" });
  body += text(685, 452, "web store + CMS back office", { anchor: "middle", size: 11, fill: "#A9C9A0" });

  body += entity(60, 244, 230, 92, "Customer");
  body += entity(60, 474, 230, 92, "Administrator / Staff");
  body += entity(1050, 244, 250, 92, "PayMongo");
  body += entity(1050, 354, 250, 92, "Email Server");
  body += entity(1050, 474, 250, 92, "Google Maps");

  const flow = (x1, y1, x2, y2, label, anchor = "middle") =>
    poly([[x1, y1], [x2, y2]], { stroke: C.mut, sw: 1.3, marker: "arrow" }) +
    text((x1 + x2) / 2, Math.min(y1, y2) - 8, label, { size: 11, fill: C.mut, anchor });

  // Left side: users of the public site and the back office
  body += flow(290, 270, 520, 270, "browse, order, track");
  body += flow(520, 302, 290, 302, "stock, prices, status");
  body += flow(290, 506, 520, 506, "content, stock, order status");
  body += flow(520, 538, 290, 538, "reports, low-stock alerts");

  // Right side: third-party services
  body += flow(850, 270, 1050, 270, "payment request");
  body += flow(1050, 302, 850, 302, "payment result (webhook)");
  body += flow(850, 380, 1050, 380, "notification email");
  body += flow(1050, 412, 850, 412, "delivery / bounce status");
  body += flow(850, 506, 1050, 506, "map & pin request");
  body += flow(1050, 538, 850, 538, "map tiles, coordinates");

  body += footerNote(W, H, "AgriMart · Web Systems and Technologies 2 / System Integration and Architecture 1");
  return svgDoc(W, H, body, "AgriMart context diagram");
}
write("context-diagram.svg", contextDiagram());

/* ------------------------------------------------------------------ *
 * 4. ARCHITECTURE DIAGRAM
 * ------------------------------------------------------------------ */
function architectureDiagram() {
  const W = 1440, H = 920;
  let body = titleBlock("AgriMart — System Architecture", "Three-tier architecture with a CMS back office and external integrations", W);

  body += rect(60, 110, 1320, 130, { fill: C.zone, stroke: C.bd });
  body += rect(60, 260, 1320, 420, { fill: "none", stroke: C.bd });
  body += rect(60, 700, 1320, 130, { fill: C.zone, stroke: C.bd });
  body += text(76, 136, "Presentation", { size: 12, weight: 700, fill: C.forest });
  body += text(76, 286, "Application", { size: 12, weight: 700, fill: C.forest });
  body += text(76, 726, "Data", { size: 12, weight: 700, fill: C.forest });

  const box = (x, y, w, h, label, sub) => rect(x, y, w, h, { fill: C.surf, stroke: C.ink }) +
    text(x + w / 2, y + (sub ? h / 2 - 4 : h / 2 + 5), label, { anchor: "middle", size: 14, weight: 600 }) +
    (sub ? text(x + w / 2, y + h / 2 + 16, sub, { anchor: "middle", size: 11, fill: C.mut }) : "");

  body += box(200, 150, 400, 64, "Browser / Mobile Browser", "responsive HTML, CSS and JS");
  body += box(200, 310, 400, 70, "Next.js Front-end", "server-rendered React UI");
  body += box(200, 420, 400, 70, "REST API + JWT", "custom Node.js controllers");
  body += box(200, 530, 400, 70, "Strapi CMS", "content types · users & roles · admin panel");
  body += box(200, 740, 400, 60, "MySQL", "relational database (agrimart_db)");

  body += text(412, 268, "HTTPS", { size: 11, fill: C.mut });
  body += text(412, 404, "REST / JSON", { size: 11, fill: C.mut });
  body += text(412, 514, "queries", { size: 11, fill: C.mut });
  body += text(412, 678, "SQL", { size: 11, fill: C.mut });

  const vArrow = (x, y1, y2) => poly([[x, y1], [x, y2]], { stroke: C.ink, sw: 1.4, marker: "arrow" });
  body += vArrow(400, 214, 308);
  body += vArrow(400, 380, 418);
  body += vArrow(400, 490, 528);
  body += vArrow(400, 600, 738);

  // External services zone with a single bus so no connectors cross.
  body += rect(700, 290, 680, 330, { fill: C.surf, stroke: C.line, dash: "6 5" });
  body += text(716, 312, "External services", { size: 12, weight: 700, fill: C.forest });

  body += box(920, 330, 320, 56, "PayMongo", "payment gateway (sandbox)");
  body += box(920, 460, 320, 56, "SMTP / Gmail", "transactional email");
  body += box(920, 590, 320, 56, "Google Maps", "store locator + delivery map");

  const busY = 455, busX = 740;
  body += poly([[600, busY], [busX, busY]], { stroke: C.ink, sw: 1.4 });
  body += line(busX, 358, busX, 618, { stroke: C.ink, sw: 1.4 });
  const branch = (y, label) =>
    poly([[busX, y], [920, y]], { stroke: C.ink, sw: 1.4, marker: "arrow" }) +
    text(830, y - 8, label, { size: 11, fill: C.mut, anchor: "middle" });
  body += branch(358, "payment request");
  body += branch(488, "SMTP send");
  body += branch(618, "map embed");

  body += text(76, 856, "Third-party calls are made server-side; credentials are read from environment variables (.env).", { size: 11, fill: C.mut });

  body += footerNote(W, H, "AgriMart · Web Systems and Technologies 2 / System Integration and Architecture 1");
  return svgDoc(W, H, body, "AgriMart system architecture diagram");
}
write("architecture-diagram.svg", architectureDiagram());

console.log("Wrote use-case-diagram.svg, er-diagram.svg, context-diagram.svg, architecture-diagram.svg");
