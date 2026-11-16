"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useToast } from "@/components/Providers";

export default function RegisterPage() {
  const { register } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", passwordConfirmation: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.fullName.trim().length < 2) return setError("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Enter a valid email address.");
    if (form.password.length < 8) return setError("Use at least 8 characters for your password.");
    if (form.password !== form.passwordConfirmation) return setError("The passwords do not match.");
    setBusy(true);
    try {
      await register(form);
      push("Account created. Welcome to AgriMart.");
      router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <p className="eyebrow">Account</p>
      <h1>Create an account</h1>
      <p>Save addresses, keep your order history in one place and pay online.</p>
      <div className="auth-card">
        <form className="form" onSubmit={submit} noValidate>
          <div className="frow">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" className="fld" autoComplete="name" value={form.fullName} onChange={set("fullName")} required />
          </div>
          <div className="f2">
            <div className="frow">
              <label htmlFor="email">Email address</label>
              <input id="email" className="fld" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
            </div>
            <div className="frow">
              <label htmlFor="phone">Phone (optional)</label>
              <input id="phone" className="fld" autoComplete="tel" value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="f2">
            <div className="frow">
              <label htmlFor="password">Password</label>
              <input id="password" className="fld" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
            </div>
            <div className="frow">
              <label htmlFor="passwordConfirmation">Confirm password</label>
              <input id="passwordConfirmation" className="fld" type="password" autoComplete="new-password" value={form.passwordConfirmation} onChange={set("passwordConfirmation")} required />
            </div>
          </div>
          <p className="form-note">Use at least 8 characters. We only use your phone number for delivery questions.</p>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <button type="submit" className="btn p" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
        </form>
        <div className="auth-foot">
          <span>Already have an account?</span><Link href="/login"><u>Sign in</u></Link>
        </div>
      </div>
    </div>
  );
}
