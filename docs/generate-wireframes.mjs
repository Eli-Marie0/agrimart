import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { C, text, rect, line, svgDoc } from "./lib.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
const DIR = join(OUT, "wireframes");
mkdirSync(DIR, { recursive: true });

const W = 560, H = 400;

const ln = (x, y, w, h = 5) => rect(x, y, w, h, { fill: C.bd, stroke: "none" });

function ph(x, y, w, h, label = "") {
  let s = rect(x, y, w, h, { fill: C.zone, stroke: C.line });
  s += line(x, y, x + w, y + h, { stroke: C.line, sw: 0.7 });
  s += line(x + w, y, x, y + h, { stroke: C.line, sw: 0.7 });
  if (label) s += text(x + 7, y + h - 7, label, { size: 10, fill: C.mut });
  return s;
}

function field(x, y, w, label) {
  return rect(x, y, w, 26, { fill: C.surf, stroke: C.line }) + text(x + 8, y + 17, label, { size: 10, fill: C.mut });
}

function btn(x, y, w, label, primary = false) {
  return rect(x, y, w, 26, { fill: primary ? C.lime : "transparent", stroke: primary ? C.lime : C.ink }) +
    text(x + w / 2, y + 17, label, { anchor: "middle", size: 10, weight: 600 });
}

function chrome() {
  let s = rect(18, 34, 524, 34, { fill: C.zone, stroke: C.bd });
  s += rect(30, 43, 62, 16, { fill: C.ink });
  s += text(61, 55, "AgriMart", { anchor: "middle", size: 9, weight: 700, fill: "#E7F0DA" });
  [140, 184, 228, 272].forEach((x) => { s += ln(x, 49, 34, 5); });
  s += ln(430, 49, 38, 5);
  s += rect(478, 44, 50, 14, { stroke: C.line });
  return s;
}

function chromeFoot() {
  let s = rect(18, 330, 524, 54, { fill: C.forest, stroke: C.forest });
  [34, 160, 286, 412].forEach((x) => {
    s += rect(x, 344, 60, 6, { fill: "#4F6F5A", stroke: "none" });
    s += rect(x, 356, 90, 4, { fill: "#4F6F5A", stroke: "none" });
    s += rect(x, 366, 74, 4, { fill: "#4F6F5A", stroke: "none" });
  });
  return s;
}

function wf(title, body) {
  let s = text(18, 22, title, { size: 13, weight: 700 });
  s += rect(18, 34, 524, 350, { fill: C.surf, stroke: C.ink });
  s += chrome();
  s += body;
  s += chromeFoot();
  return svgDoc(W, H, s, `${title} wireframe`);
}

const defs = [
  ["01-home.svg", "1. Home", () => {
    let s = ln(34, 90, 70, 6);
    s += ln(34, 104, 230, 14) + ln(34, 126, 210, 8) + ln(34, 140, 170, 8);
    s += btn(34, 160, 74, "Shop supplies", true) + btn(116, 160, 74, "Find the store");
    s += ph(300, 84, 214, 110, "Hero photo 4:5");
    s += ln(34, 208, 130, 10);
    [34, 134, 234, 334].forEach((x) => {
      s += ph(x, 226, 90, 54, "");
      s += ln(x, 288, 68, 5) + ln(x, 298, 48, 5) + ln(x, 312, 40, 7);
    });
    return s;
  }],
  ["02-products.svg", "2. Products / Shop", () => {
    let s = ln(34, 86, 160, 12) + ln(34, 104, 200, 6);
    s += rect(34, 118, 118, 198, { fill: "none", stroke: C.bd });
    s += ln(44, 130, 60, 7) + field(44, 144, 98, "Search");
    for (let i = 0; i < 4; i += 1) s += rect(44, 182 + i * 22, 10, 10, { fill: C.surf, stroke: C.line }) + ln(60, 185 + i * 22, 72, 5);
    s += rect(44, 274, 98, 24, { fill: C.lime, stroke: C.lime }) + text(93, 290, "Apply filters", { anchor: "middle", size: 9, weight: 600 });
    [170, 290, 410].forEach((x) => {
      [120, 218].forEach((y) => {
        s += ph(x, y, 110, 56, "");
        s += ln(x, y + 64, 88, 5) + ln(x, y + 74, 60, 5) + ln(x, y + 86, 44, 6);
      });
    });
    s += ln(240, 322, 60, 6);
    return s;
  }],
  ["03-product-detail.svg", "3. Product detail", () => {
    let s = ln(34, 84, 180, 5);
    s += ph(34, 96, 230, 150, "Main photo");
    [34, 114, 194].forEach((x) => { s += ph(x, 254, 70, 44, ""); });
    s += ln(286, 98, 70, 5) + ln(286, 112, 190, 12) + ln(286, 132, 80, 10);
    s += rect(286, 150, 150, 7, { fill: C.bd, stroke: "none" });
    [0, 1, 2].forEach((i) => { s += rect(286 + i * 31, 150, 27, 7, { fill: C.forest, stroke: "none" }); });
    s += ln(286, 164, 120, 5);
    s += rect(286, 180, 40, 24, { stroke: C.line }) + rect(340, 180, 40, 24, { stroke: C.line });
    s += btn(286, 214, 120, "Add to cart", true);
    for (let i = 0; i < 4; i += 1) s += ln(286, 252 + i * 16, 210, 4);
    return s;
  }],
  ["04-cart-checkout.svg", "4. Cart and checkout", () => {
    let s = ln(34, 86, 120, 10);
    [96, 150, 204].forEach((y) => {
      s += ph(34, y, 56, 42, "");
      s += ln(102, y + 4, 120, 6) + ln(102, y + 16, 80, 5) + ln(102, y + 30, 50, 5);
      s += ln(270, y + 12, 40, 8);
    });
    s += ln(34, 262, 140, 8) + field(34, 278, 290, "Delivery address");
    s += rect(350, 86, 176, 234, { fill: C.surf, stroke: C.line });
    s += ln(364, 100, 90, 9);
    for (let i = 0; i < 4; i += 1) { s += ln(364, 124 + i * 18, 60, 5) + ln(500, 124 + i * 18, 12, 5); }
    s += line(364, 206, 512, 206, { stroke: C.ink, sw: 1 });
    s += ln(364, 216, 50, 7) + ln(490, 216, 22, 7);
    s += btn(364, 240, 148, "Place order", true);
    return s;
  }],
  ["05-auth.svg", "5. Sign up / Login", () => {
    let s = rect(150, 84, 260, 218, { fill: C.surf, stroke: C.bd });
    s += ln(184, 104, 120, 10) + ln(184, 120, 170, 5);
    s += field(184, 140, 192, "Email") + field(184, 176, 192, "Password");
    s += btn(184, 216, 192, "Sign in", true);
    s += ln(214, 256, 132, 5);
    return s;
  }],
  ["06-account.svg", "6. My account", () => {
    let s = rect(34, 84, 120, 220, { fill: C.zone, stroke: C.bd });
    s += ln(44, 96, 76, 6) + ln(44, 108, 60, 5);
    [128, 150, 172, 194].forEach((y) => { s += ln(44, y, 82, 5); });
    s += ln(174, 90, 150, 12);
    s += field(174, 112, 150, "Full name") + field(174, 148, 150, "Email");
    s += btn(174, 184, 100, "Save details", true);
    s += ln(174, 226, 90, 8);
    for (let i = 0; i < 3; i += 1) { s += ln(174, 244 + i * 18, 240, 4) + ln(430, 244 + i * 18, 26, 4); }
    return s;
  }],
  ["07-announcements.svg", "7. Announcements", () => {
    let s = ln(34, 86, 180, 12) + ln(34, 104, 220, 6);
    [118, 172, 226, 280].forEach((y) => {
      s += rect(34, y, 42, 42, { fill: C.zone, stroke: C.line });
      s += text(55, y + 20, "12", { anchor: "middle", size: 14, weight: 700, fill: C.ink });
      s += text(55, y + 34, "NOV", { anchor: "middle", size: 8, fill: C.mut });
      s += ln(88, y + 2, 180, 8) + ln(88, y + 16, 300, 5) + ln(88, y + 28, 260, 5);
      s += line(34, y + 48, 526, y + 48, { stroke: C.bd, sw: 1 });
    });
    return s;
  }],
  ["08-contact.svg", "8. Contact / Store locator", () => {
    let s = ln(34, 86, 140, 12);
    s += ln(34, 108, 160, 5) + ln(34, 120, 140, 5) + ln(34, 132, 150, 5);
    s += ln(34, 156, 80, 8) + ln(34, 170, 130, 5) + ln(34, 182, 120, 5);
    s += ph(34, 204, 220, 108, "Google Maps");
    s += ln(280, 86, 120, 12);
    s += field(280, 108, 246, "Name") + field(280, 144, 246, "Email");
    s += rect(280, 180, 246, 80, { fill: C.surf, stroke: C.line }) + text(288, 196, "Message", { size: 10, fill: C.mut });
    s += btn(280, 272, 110, "Send message", true);
    return s;
  }],
  ["09-admin-dashboard.svg", "9. Admin dashboard (CMS panel)", () => {
    // Back-office shell: no storefront header or footer, just the dashboard rail.
    let s = rect(34, 48, 128, 322, { fill: C.zone, stroke: C.bd });
    s += ln(46, 62, 70, 6) + ln(46, 74, 52, 4);
    ["Overview", "Products", "Inventory", "Orders", "Announcements", "Site content", "Users", "Reports", "Settings"]
      .forEach((_, i) => { s += ln(46, 98 + i * 20, 76, 5); });
    s += line(46, 282, 150, 282, { stroke: C.bd, sw: 1 });
    s += ln(46, 292, 66, 5) + ln(46, 312, 44, 5);

    s += ln(180, 56, 150, 10) + ln(180, 72, 190, 5);
    [180, 270, 360, 450].forEach((x) => {
      s += rect(x, 90, 84, 48, { stroke: C.bd, fill: C.surf });
      s += ln(x + 8, 102, 40, 4) + rect(x + 8, 114, 34, 9, { fill: C.ink, stroke: "none" });
    });
    s += rect(180, 152, 354, 86, { fill: C.surf, stroke: C.bd });
    [0, 1, 2, 3, 4, 5].forEach((i) => {
      const h = 14 + i * 8;
      s += rect(200 + i * 58, 226 - h, 36, h, { fill: C.forest, stroke: "none" });
    });
    s += line(192, 226, 522, 226, { stroke: C.bd, sw: 1 });
    s += rect(180, 250, 354, 102, { fill: C.surf, stroke: C.bd });
    for (let i = 0; i < 4; i += 1) {
      s += ln(192, 266 + i * 20, 110, 5) + ln(320, 266 + i * 20, 60, 5) + ln(410, 266 + i * 20, 40, 5) + ln(470, 266 + i * 20, 52, 5);
    }
    return s;
  }],
];

const isConsole = (file) => file.startsWith("09");

defs.forEach(([file, title, build]) => {
  const body = build();
  const svg = isConsole(file)
    ? svgDoc(W, H, text(18, 22, title, { size: 13, weight: 700 }) +
        rect(18, 34, 524, 350, { fill: C.surf, stroke: C.ink }) + body, `${title} wireframe`)
    : wf(title, body);
  writeFileSync(join(DIR, file), svg, "utf8");
});

console.log(`Wrote ${defs.length} wireframes to docs/wireframes/`);
