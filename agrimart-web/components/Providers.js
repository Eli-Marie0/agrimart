"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountApi, getStoredUser, getToken, publicApi, setStoredUser, setToken } from "@/lib/api";
import { clearCart } from "@/lib/cart";

const AuthContext = createContext(null);
const ToastContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastViewport({ toasts, dismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone === "error" ? "err" : ""}`} role="status">
          <p>{toast.message}</p>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss message">Close</button>
        </div>
      ))}
    </div>
  );
}

const EXEMPT_PATHS = ["/maintenance", "/login", "/register", "/admin", "/staff", "/forbidden", "/offline", "/session-expired", "/contact"];

function MaintenanceGate({ children }) {
  const { user } = useAuth();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let alive = true;
    publicApi
      .settings()
      .then((payload) => { if (alive) setSettings(payload?.data || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const privileged = Boolean(user && (user.roleName === "admin" || user.roleName === "staff"));
  const exempt = EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const closed = Boolean(settings?.maintenanceMode) && !privileged && !exempt;

  useEffect(() => {
    if (closed) router.replace("/maintenance");
  }, [closed, router]);

  if (closed) {
    return (
      <div className="wrap">
        <div className="sys">
          <p className="eyebrow">Maintenance</p>
          <h1>We are restocking.</h1>
          <p>The store is briefly closed. Taking you to the notice.</p>
        </div>
      </div>
    );
  }

  return children;
}

export default function Providers({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const activityUser = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback((message, tone = "ok") => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      timers.current.delete(id);
    }, 3200);
    timers.current.set(id, timer);
  }, []);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setStoredUser(null);
      clearCart();
      setReady(true);
      return null;
    }
    try {
      const payload = await accountApi.me(token);
      // Ignore a response for an older token if a sign-in/sign-out happened
      // while the request was in flight.
      if (getToken() !== token) return null;
      const me = payload?.data?.user || null;
      if (me?.roleName !== "customer") clearCart();
      setUser(me);
      setStoredUser(me);
      return me;
    } catch (error) {
      // Only a rejected token means the session is gone. A network error or an
      // aborted request (for example while navigating away) must not sign the
      // person out and wipe their saved session.
      if (getToken() === token && (error.status === 401 || error.status === 403)) {
        setToken(null);
        setStoredUser(null);
        setUser(null);
        clearCart();
      }
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    refresh();
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    };
  }, [refresh]);

  const finishAuth = useCallback((payload) => {
    const token = payload?.data?.token;
    const me = payload?.data?.user;
    if (!token || !me) throw new Error("Sign in did not return an account session. Restart the API and try again.");
    setToken(token);
    setStoredUser(me);
    if (me.roleName !== "customer") clearCart();
    try { window.localStorage.setItem("agrimart-last-activity", String(Date.now())); } catch {}
    setUser(me);
    setReady(true);
    return me;
  }, []);

  const login = useCallback(async (email, password) => {
    const payload = await accountApi.login({ email, password });
    return finishAuth(payload);
  }, [finishAuth]);

  const register = useCallback(async (body) => {
    const payload = await accountApi.register(body);
    return finishAuth(payload);
  }, [finishAuth]);

  const logout = useCallback(() => {
    if (getToken()) accountApi.logout().catch(() => {});
    setToken(null);
    setStoredUser(null);
    setUser(null);
    clearCart();
  }, []);

  useEffect(() => {
    if (!user) {
      activityUser.current = null;
      return undefined;
    }
    const idleLimit = 30 * 60 * 1000;
    const userKey = String(user.id || user.email || "signed-in");
    // A previous session's timestamp must never expire a newly authenticated
    // session. The same user's background refresh keeps the existing timer.
    if (activityUser.current !== userKey) {
      activityUser.current = userKey;
      try { window.localStorage.setItem("agrimart-last-activity", String(Date.now())); } catch {}
    }
    let timer;
    const expireIfIdle = () => {
      if (Date.now() - Number(window.localStorage.getItem("agrimart-last-activity") || 0) >= idleLimit) {
        logout();
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(expireIfIdle, idleLimit);
    };
    const recordActivity = () => {
      try { window.localStorage.setItem("agrimart-last-activity", String(Date.now())); } catch {}
      window.clearTimeout(timer);
      timer = window.setTimeout(expireIfIdle, idleLimit);
    };
    const onStorage = (event) => {
      if (event.key === "agrimart-token" && !event.newValue) {
        setUser(null);
        setStoredUser(null);
      }
      if (event.key === "agrimart-last-activity") {
        window.clearTimeout(timer);
        timer = window.setTimeout(expireIfIdle, idleLimit);
      }
    };
    const lastActivity = Number(window.localStorage.getItem("agrimart-last-activity") || 0);
    if (!lastActivity) recordActivity();
    else expireIfIdle();
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((name) => window.addEventListener(name, recordActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearTimeout(timer);
      ["pointerdown", "keydown", "scroll", "touchstart"].forEach((name) => window.removeEventListener(name, recordActivity));
      window.removeEventListener("storage", onStorage);
    };
  }, [user, logout]);

  const authValue = useMemo(() => ({
    user,
    ready,
    login,
    register,
    logout,
    refresh,
    setUser,
    isCustomer: user?.roleName === "customer",
    isStaff: user?.roleName === "staff" || user?.roleName === "admin",
    isAdmin: user?.roleName === "admin",
  }), [user, ready, login, register, logout, refresh]);

  const toastValue = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <AuthContext.Provider value={authValue}>
      <ToastContext.Provider value={toastValue}>
        <MaintenanceGate>{children}</MaintenanceGate>
        <ToastViewport toasts={toasts} dismiss={dismiss} />
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
