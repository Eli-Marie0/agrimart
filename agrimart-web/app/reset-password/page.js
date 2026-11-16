"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/api";

function ResetForm() {
  const params = useSearchParams();
  const code = params.get("code") || params.get("token") || "";
  const [form, setForm] = useState({ password: "", passwordConfirmation: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!code) return setError("That reset link is incomplete. Request a new one.");
    if (form.password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (form.password !== form.passwordConfirmation) return setError("The passwords do not match.");
    setBusy(true);
    try {
      await accountApi.resetPassword({ code, password: form.password, passwordConfirmation: form.passwordConfirmation });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <p className="eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      <p>{code ? "The link is valid for one hour." : "This reset link is missing its code."}</p>
      <div className="auth-card">
        {done ? (
          <div className="notice ok">
            <p style={{ margin: 0 }}>Your password has been changed.</p>
            <Link href="/login" className="btn p" style={{ marginTop: 16 }}>Sign in</Link>
          </div>
        ) : (
          <form className="form" onSubmit={submit} noValidate>
            <div className="frow">
              <label htmlFor="password">New password</label>
              <input id="password" className="fld" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </div>
            <div className="frow">
              <label htmlFor="passwordConfirmation">Confirm new password</label>
              <input id="passwordConfirmation" className="fld" type="password" autoComplete="new-password" value={form.passwordConfirmation} onChange={(event) => setForm({ ...form, passwordConfirmation: event.target.value })} required />
            </div>
            {error ? <p className="err" role="alert">{error}</p> : null}
            <button type="submit" className="btn p" disabled={busy}>{busy ? "Saving..." : "Save new password"}</button>
          </form>
        )}
        <div className="auth-foot">
          <Link href="/forgot-password"><u>Request a new link</u></Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="wrap pad"><p className="load-note">Loading reset form...</p></div>}>
      <ResetForm />
    </Suspense>
  );
}
