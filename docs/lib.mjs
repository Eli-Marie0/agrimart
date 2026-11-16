// Shared SVG helpers for the AgriMart documentation diagrams.
export const C = {
  canvas: "#F3F7EC", surf: "#FFFFFF", zone: "#E4EDD6", ink: "#10281A", mut: "#647568",
  forest: "#16402A", lime: "#9BD84A", bd: "#DCE5D5", line: "#A9B8A3", deep: "#0F2E1C", wheat: "#E6B43A",
};

export const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const MONO = "'Consolas', 'Courier New', monospace";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function text(x, y, s, o = {}) {
  const { size = 13, weight = 400, fill = C.ink, anchor = "start", opacity = 1, family = FONT } = o;
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(s)}</text>`;
}

export function rect(x, y, w, h, o = {}) {
  const { fill = "none", stroke = C.bd, sw = 1, dash = "" } = o;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}

export function line(x1, y1, x2, y2, o = {}) {
  const { stroke = C.line, sw = 1, dash = "", marker = "", opacity = 1 } = o;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}${marker ? ` marker-end="url(#${marker})"` : ""} opacity="${opacity}"/>`;
}

export function poly(points, o = {}) {
  const { stroke = C.line, sw = 1, fill = "none", marker = "", opacity = 1 } = o;
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${marker ? ` marker-end="url(#${marker})"` : ""} opacity="${opacity}"/>`;
}

export function ell(cx, cy, rx, ry, o = {}) {
  const { fill = C.surf, stroke = C.line, sw = 1 } = o;
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

export function circle(cx, cy, r, o = {}) {
  const { fill = C.surf, stroke = C.ink, sw = 1.5 } = o;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function defs() {
  return `<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker>
  <marker id="arrowMut" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.mut}"/></marker>
</defs>`;
}

export function svgDoc(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
${defs()}
<rect width="${w}" height="${h}" fill="${C.canvas}"/>
${body}
</svg>`;
}

export function wrapWords(s, max) {
  const words = String(s).split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > max && cur) { lines.push(cur); cur = word; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function titleBlock(title, subtitle, w) {
  return text(40, 46, title, { size: 25, weight: 700 }) +
    text(40, 72, subtitle, { size: 13, fill: C.mut }) +
    line(40, 86, w - 40, 86, { stroke: C.bd });
}

export function actor(cx, top, label) {
  return circle(cx, top + 14, 12) +
    line(cx, top + 26, cx, top + 62, { stroke: C.ink, sw: 1.5 }) +
    line(cx - 20, top + 38, cx + 20, top + 38, { stroke: C.ink, sw: 1.5 }) +
    line(cx, top + 62, cx - 15, top + 92, { stroke: C.ink, sw: 1.5 }) +
    line(cx, top + 62, cx + 15, top + 92, { stroke: C.ink, sw: 1.5 }) +
    text(cx, top + 112, label, { anchor: "middle", size: 13, weight: 600 });
}

export function systemActor(cx, cy, label) {
  return rect(cx - 92, cy - 36, 184, 72, { fill: C.surf, stroke: C.ink }) +
    text(cx, cy - 12, "«system»", { anchor: "middle", size: 11, fill: C.mut }) +
    text(cx, cy + 14, label, { anchor: "middle", size: 13, weight: 600 });
}

export function useCase(cx, cy, label, rx = 104) {
  return ell(cx, cy, rx, 23) + text(cx, cy + 4, label, { anchor: "middle", size: 12, weight: 500 });
}

export function footerNote(w, h, note) {
  return line(40, h - 34, w - 40, h - 34, { stroke: C.bd }) +
    text(40, h - 14, note, { size: 11, fill: C.mut });
}

export function entityBox(x, y, name, fields, width = 280) {
  const rowH = 21, headH = 34, pad = 8;
  const h = headH + fields.length * rowH + pad;
  return { x, y, w: width, h, name, fields, right: x + width, bottom: y + h, cx: x + width / 2 };
}

export function drawEntity(e) {
  let s = rect(e.x, e.y, e.w, e.h, { fill: C.surf, stroke: C.ink });
  s += rect(e.x, e.y, e.w, 34, { fill: C.forest, stroke: C.forest });
  s += text(e.x + 12, e.y + 23, e.name, { size: 14, weight: 700, fill: "#E7F0DA", family: MONO });
  e.fields.forEach((field, i) => {
    const yy = e.y + 34 + 15 + i * 21;
    s += text(e.x + 12, yy, field, { size: 11, fill: C.ink, family: MONO });
  });
  return s;
}

export function edge(points, labels = []) {
  return poly(points, { stroke: C.line, sw: 1.4 }) +
    labels.map((l) => text(l.x, l.y, l.t, { size: 11, weight: 700, fill: C.mut, anchor: l.a || "middle" })).join("");
}
