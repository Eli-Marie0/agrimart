import { API_BASE } from "./format";

const TOKEN_KEY = "agrimart-token";
const USER_KEY = "agrimart-user";

export function getToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Fetch a Strapi custom endpoint.
 * Pass token explicitly for server components; the browser falls back to localStorage.
 */
export async function api(path, { method = "GET", body, token, signal, headers = {} } = {}) {
  const authToken = token ?? getToken();
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
  } catch {
    throw new ApiError("The store is offline. Check your connection and try again.", 0);
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || `Request failed (${response.status}).`,
      response.status,
      payload?.error?.details
    );
  }
  return payload;
}

export const publicApi = {
  home: () => api("/store/home"),
  products: (params = {}) => api(`/store/products?${new URLSearchParams(params).toString()}`),
  product: (slug) => api(`/store/products/${encodeURIComponent(slug)}`),
  categories: () => api("/store/categories"),
  brands: () => api("/store/brands"),
  announcements: (limit) => api(`/store/announcements${limit ? `?limit=${limit}` : ""}`),
  content: () => api("/store/content"),
  settings: () => api("/store/settings"),
  contact: (body) => api("/store/contact", { method: "POST", body }),
  methods: () => api("/payments/methods"),
};

export const accountApi = {
  login: (body) => api("/account/login", { method: "POST", body }),
  logout: () => api("/account/logout", { method: "POST", body: {} }),
  register: (body) => api("/account/register", { method: "POST", body }),
  me: (token) => api("/account/me", { token }),
  updateMe: (body) => api("/account/me", { method: "PATCH", body }),
  changePassword: (body) => api("/account/change-password", { method: "POST", body }),
  forgotPassword: (body) => api("/account/forgot-password", { method: "POST", body }),
  resetPassword: (body) => api("/account/reset-password", { method: "POST", body }),
  addresses: () => api("/account/addresses"),
  createAddress: (body) => api("/account/addresses", { method: "POST", body }),
  updateAddress: (id, body) => api(`/account/addresses/${id}`, { method: "PUT", body }),
  deleteAddress: (id) => api(`/account/addresses/${id}`, { method: "DELETE" }),
};

export const checkoutApi = {
  create: (body) => api("/checkout", { method: "POST", body }),
  mine: (status) => api(`/checkout/mine${status ? `?status=${status}` : ""}`),
  mineOne: (id) => api(`/checkout/mine/${id}`),
  cancel: (id) => api(`/checkout/${id}/cancel`, { method: "POST" }),
  syncPayment: (id) => api(`/checkout/${id}/sync-payment`, { method: "POST" }),
  simulatePay: (id) => api(`/checkout/${id}/simulate-pay`, { method: "POST" }),
};

export const reviewsApi = {
  create: (body) => api("/reviews", { method: "POST", body }),
  mine: (params = {}) => api(`/reviews/mine?${new URLSearchParams(params).toString()}`),
  eligibility: (productId) => api(`/reviews/eligibility/${productId}`),
};

export const opsApi = {
  dashboard: () => api("/ops/dashboard"),
  orders: (params = {}) => api(`/ops/orders?${new URLSearchParams(params).toString()}`),
  order: (id) => api(`/ops/orders/${id}`),
  setStatus: (id, status) => api(`/ops/orders/${id}/status`, { method: "PATCH", body: { status } }),
  updateTracking: (id, body) => api(`/ops/orders/${id}/tracking`, { method: "PATCH", body }),
  inventory: (params = {}) => api(`/ops/inventory?${new URLSearchParams(params).toString()}`),
  stockIn: (body) => api("/ops/inventory/stock-in", { method: "POST", body }),
  adjust: (body) => api("/ops/inventory/adjust", { method: "POST", body }),
};

export const adminApi = {
  uploadProductImage: async (file) => {
    const form = new FormData();
    form.append("files", file);
    const token = getToken();
    let response;
    try {
      response = await fetch(`${API_BASE}/api/admin/product-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        cache: "no-store",
      });
    } catch {
      throw new ApiError("The store is offline. Check your connection and try again.", 0);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(payload?.error?.message || "The image upload failed.", response.status);
    return payload;
  },
  products: (params = {}) => api(`/admin/products?${new URLSearchParams(params).toString()}`),
  product: (id) => api(`/admin/products/${id}`),
  createProduct: (body) => api("/admin/products", { method: "POST", body }),
  updateProduct: (id, body) => api(`/admin/products/${id}`, { method: "PUT", body }),
  deleteProduct: (id) => api(`/admin/products/${id}`, { method: "DELETE" }),
  categories: () => api("/admin/categories"),
  createCategory: (body) => api("/admin/categories", { method: "POST", body }),
  updateCategory: (id, body) => api(`/admin/categories/${id}`, { method: "PUT", body }),
  deleteCategory: (id) => api(`/admin/categories/${id}`, { method: "DELETE" }),
  users: (params = {}) => api(`/admin/users?${new URLSearchParams(params).toString()}`),
  createUser: (body) => api("/admin/users", { method: "POST", body }),
  updateUser: (id, body) => api(`/admin/users/${id}`, { method: "PATCH", body }),
  deleteUser: (id) => api(`/admin/users/${id}`, { method: "DELETE" }),
  announcements: () => api("/admin/announcements"),
  createAnnouncement: (body) => api("/admin/announcements", { method: "POST", body }),
  updateAnnouncement: (id, body) => api(`/admin/announcements/${id}`, { method: "PUT", body }),
  publishAnnouncement: (id) => api(`/admin/announcements/${id}/publish`, { method: "POST" }),
  unpublishAnnouncement: (id) => api(`/admin/announcements/${id}/unpublish`, { method: "POST" }),
  deleteAnnouncement: (id) => api(`/admin/announcements/${id}`, { method: "DELETE" }),
  content: () => api("/admin/content"),
  updateHome: (body) => api("/admin/content/home", { method: "PUT", body }),
  updateAbout: (body) => api("/admin/content/about", { method: "PUT", body }),
  updateContact: (body) => api("/admin/content/contact", { method: "PUT", body }),
  updateSettings: (body) => api("/admin/content/settings", { method: "PUT", body }),
  mail: () => api("/admin/mail"),
  testMail: (body) => api("/admin/mail/test", { method: "POST", body }),
  messages: () => api("/admin/messages"),
  updateMessage: (id, body) => api(`/admin/messages/${id}`, { method: "PATCH", body }),
  deleteMessage: (id) => api(`/admin/messages/${id}`, { method: "DELETE" }),
  reviews: (params = {}) => api(`/admin/reviews?${new URLSearchParams(params).toString()}`),
  updateReview: (id, body) => api(`/admin/reviews/${id}`, { method: "PATCH", body }),
  deleteReview: (id) => api(`/admin/reviews/${id}`, { method: "DELETE" }),
};

export const reportsApi = {
  summary: (params = {}) => api(`/reports/summary?${new URLSearchParams(params).toString()}`),
  sales: (params = {}) => api(`/reports/sales?${new URLSearchParams(params).toString()}`),
  inventory: () => api("/reports/inventory"),
  exportUrl: (type, params = {}) => `${API_BASE}/api/reports/export.csv?${new URLSearchParams({ type, ...params }).toString()}`,
  download: async (type, params = {}) => {
    const token = getToken();
    const response = await fetch(`${API_BASE}/api/reports/export.csv?${new URLSearchParams({ type, ...params }).toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!response.ok) throw new ApiError("The export could not be downloaded.", response.status);
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match ? match[1] : `agrimart_${type}.csv`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return filename;
  },
};
