"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useToast } from "@/components/Providers";

function destinationFor(user, next) {
  const safeNext = typeof next === "string"
    && next.startsWith("/")
    && !next.startsWith("//")
    && !next.includes("\\")
    ? next
    : "";
  if (user?.roleName === "admin") return safeNext || "/admin";
  if (user?.roleName === "staff") return safeNext.startsWith("/staff") ? safeNext : "/staff";
  // Customers always start at the storefront, even if a stale or forbidden
  // staff/admin destination was included in the login URL.
  return "/";
}

function LoginForm() {
  const { user, ready, login } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "";
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace(destinationFor(user, next));
    }
  }, [ready, user, next, router]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const me = await login(form.email.trim(), form.password);
      push(`Welcome back, ${me.fullName?.split(" ")[0] || "friend"}.`);
      router.replace(destinationFor(me, next));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <p className="eyebrow">Account</p>
      <h1>Sign in</h1>
      <p>Track orders, save delivery addresses and check out faster.</p>
      <div className="auth-card">
        <form className="form" onSubmit={submit} noValidate>
          <div className="frow">
            <label htmlFor="email">Email address</label>
            <input id="email" className="fld" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </div>
          <div className="frow">
            <label htmlFor="password">Password</label>
            <input id="password" className="fld" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </div>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <button type="submit" className="btn p" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
        </form>
        <div className="auth-foot">
          <span>New here?</span><Link href="/register"><u>Create an account</u></Link>
          <span style={{ marginLeft: "auto" }}><Link href="/forgot-password"><u>Forgot password</u></Link></span>
        </div>
      </div>

      <div className="notice" style={{ marginTop: 32 }}>
        <p style={{ margin: 0 }}><b>Demo accounts</b></p>
        <p style={{ margin: "6px 0 0" }}>Customer: customer@agrimart.ph / Customer123!</p>
        <p style={{ margin: 0 }}>Staff: staff@agrimart.ph / Staff123!</p>
        <p style={{ margin: 0 }}>Admin: admin@agrimart.ph / Admin123!</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="wrap pad"><p className="load-note">Loading sign in...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
