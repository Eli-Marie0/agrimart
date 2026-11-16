export const API_BASE = (process.env.NEXT_PUBLIC_STRAPI_URL || "http://127.0.0.1:1337").replace(/\/$/, "");

export function peso(value, opts = {}) {
  const n = Number(value || 0);
  return "₱" + n.toLocaleString("en-PH", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 2,
  });
}

export function longDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function shortDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export function dateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function dayParts(value) {
  const d = value ? new Date(value) : new Date();
  return {
    day: d.toLocaleDateString("en-PH", { day: "2-digit" }),
    month: d.toLocaleDateString("en-PH", { month: "short" }).toUpperCase(),
    year: d.getFullYear(),
  };
}

export const ORDER_STATUSES = ["pending", "paid", "preparing", "out_for_delivery", "completed", "cancelled"];

export const STATUS_LABELS = {
  pending: "Pending",
  paid: "Paid",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const REASONS = {
  stock_in: "Stock in",
  sale: "Sale",
  adjustment: "Adjustment",
  spoilage: "Spoilage",
};

export function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function stockMeter(product) {
  if (!product) return { segs: 0, cls: "out" };
  const qty = Number(product.stockQty || 0);
  const reorder = Math.max(1, Number(product.reorderLevel || 10));
  if (qty <= 0) return { segs: 0, cls: "out" };
  return { segs: Math.max(1, Math.min(5, Math.ceil((qty / (reorder * 3)) * 5))), cls: qty <= reorder ? "low" : "ok" };
}
