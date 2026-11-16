"use client";

import { useState } from "react";
import Link from "next/link";
import { accountApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = await accountApi.forgotPassword({ email: email.trim() });
      setResult(payload?.data || { sent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <p className="eyebrow">Account recovery</p>
      <h1>Forgot password</h1>
      <p>Enter the email on your account and we will send a reset link that lasts one hour.</p>
      <div className="auth-card">
        {result ? (
          <div className="notice ok">
            <p style={{ margin: 0 }}>{result.message || "If that email is registered, a reset link is on its way."}</p>
            {result.debug?.resetUrl ? (
              <p style={{ margin: "12px 0 0", wordBreak: "break-all" }}>
                Development link: <Link href={result.debug.resetUrl}><u>{result.debug.resetUrl}</u></Link>
              </p>
            ) : null}
          </div>
        ) : (
          <form className="form" onSubmit={submit} noValidate>
            <div className="frow">
              <label htmlFor="email">Email address</label>
              <input id="email" className="fld" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            {error ? <p className="err" role="alert">{error}</p> : null}
            <button type="submit" className="btn p" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button>
          </form>
        )}
        <div className="auth-foot">
          <Link href="/login"><u>Back to sign in</u></Link>
        </div>
      </div>
    </div>
  );
}
