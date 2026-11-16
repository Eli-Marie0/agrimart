"use client";

import { useMemo, useSyncExternalStore } from "react";

const KEY = "agrimart-cart";
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) || "[]";
  } catch {
    return "[]";
  }
}

function parse(raw) {
  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribe(callback) {
  listeners.add(callback);
  const onStorage = (event) => {
    if (event.key === KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function cartSnapshot(item) {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    brand: item.brand || "",
    unit: item.unit || "piece",
    price: Number(item.price || 0),
    stockQty: Number(item.stockQty || 0),
    reorderLevel: Number(item.reorderLevel || 10),
    imageUrl: item.imageUrl || null,
    category: item.category || null,
  };
}

export function useCart() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const items = useMemo(() => parse(raw), [raw]);
  const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);

  return {
    items,
    count,
    subtotal,
    add(item, qty = 1) {
      const current = parse(read());
      const found = current.find((entry) => entry.id === item.id);
      const available = Math.max(0, Number(item.stockQty || 0));
      if (available <= 0) return false;
      if (found) found.qty = Math.min(available, Number(found.qty) + qty);
      else current.push({ ...cartSnapshot(item), qty: Math.min(available, Math.max(1, Number(qty) || 1)) });
      write(current);
      return true;
    },
    setQty(id, qty) {
      const current = parse(read()).map((item) => (
        item.id === id
          ? { ...item, qty: Math.max(1, Math.min(Math.max(1, Number(item.stockQty || 1)), Number(qty) || 1)) }
          : item
      ));
      write(current);
    },
    remove(id) {
      write(parse(read()).filter((item) => item.id !== id));
    },
    clear() {
      write([]);
    },
    removeOrdered(items) {
      const quantities = new Map();
      for (const line of items || []) {
        const id = Number(line?.product?.id || line?.productId || 0);
        const qty = Math.max(0, Number(line?.quantity || 0));
        if (id && qty) quantities.set(id, (quantities.get(id) || 0) + qty);
      }
      const next = parse(read()).flatMap((item) => {
        const ordered = quantities.get(Number(item.id)) || 0;
        if (!ordered) return [item];
        const remaining = Number(item.qty || 0) - ordered;
        quantities.delete(Number(item.id));
        return remaining > 0 ? [{ ...item, qty: remaining }] : [];
      });
      write(next);
    },
    refreshFromProducts(products) {
      const byId = new Map((products || []).map((product) => [product.id, product]));
      const next = parse(read())
        .map((item) => {
          const fresh = byId.get(item.id);
          if (!fresh) return item;
          return {
            ...item,
            price: Number(fresh.price),
            stockQty: Number(fresh.stockQty),
            reorderLevel: Number(fresh.reorderLevel || 10),
            name: fresh.name,
            slug: fresh.slug,
            imageUrl: fresh.imageUrl || item.imageUrl,
          };
        })
        .map((item) => ({ ...item, qty: Math.max(1, Math.min(item.qty, Math.max(1, item.stockQty))) }));
      write(next);
    },
  };
}

export function clearCart() {
  write([]);
}
