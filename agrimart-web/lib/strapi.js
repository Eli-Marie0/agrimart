const BASE = process.env.NEXT_PUBLIC_STRAPI_URL || "http://127.0.0.1:1337";

export async function strapi(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}/api${path}${qs ? (path.includes("?") ? "&" : "?") + qs : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Strapi error ${res.status} on ${path}`);
  return res.json();
}

export function mediaUrl(media) {
  if (!media?.url) return null;
  return media.url.startsWith("http") ? media.url : `${BASE}${media.url}`;
}

export function peso(n) {
  return "₱" + Number(n).toLocaleString("en-PH");
}

export const TINTS = {
  seeds: "#E8F1D6",
  fertilizer: "#F4E9C4",
  pesticide: "#F4DDD2",
  feeds: "#F1E3BE",
  veterinary: "#DCEBEE",
  tools: "#E7E3DA",
  irrigation: "#D8E9F3",
};

export function stockInfo(p) {
  if (p.stockQty <= 0) return { cls: "out", text: "✕ Out of stock" };
  if (p.stockQty <= p.reorderLevel) return { cls: "low", text: `! Low stock: ${p.stockQty} left` };
  return { cls: "ok", text: `✓ In stock: ${p.stockQty}` };
}
