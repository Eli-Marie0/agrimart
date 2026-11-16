"use client";

import { useState } from "react";
import { publicApi } from "@/lib/api";
import { useToast } from "./Providers";

export default function ContactForm() {
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "Store inquiry", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function set(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Enter a valid email address.");
    if (form.message.trim().length < 10) return setError("Write a little more so we can help.");
    setBusy(true);
    try {
      await publicApi.contact({
        name: form.name,
        email: form.email,
        phone: form.phone,
        subject: form.subject,
        message: form.message,
        website: form.website,
      });
      setSent(true);
      push("Message sent. The store will reply by email.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="notice ok">
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Message received</h2>
        <p style={{ margin: 0 }}>Thanks, {form.name.split(" ")[0]}. The store will reply to {form.email} during business hours.</p>
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", subject: "Store inquiry", message: "", website: "" }); }}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="f2">
        <div className="frow">
          <label htmlFor="c-name">Your name</label>
          <input id="c-name" className="fld" value={form.name} onChange={set("name")} autoComplete="name" required />
        </div>
        <div className="frow">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" className="fld" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </div>
      </div>
      <div className="f2">
        <div className="frow">
          <label htmlFor="c-phone">Phone (optional)</label>
          <input id="c-phone" className="fld" value={form.phone} onChange={set("phone")} autoComplete="tel" />
        </div>
        <div className="frow">
          <label htmlFor="c-subject">Subject</label>
          <select id="c-subject" className="fld" value={form.subject} onChange={set("subject")}>
            <option>Store inquiry</option>
            <option>Product availability</option>
            <option>Order concern</option>
            <option>Bulk pricing</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div className="frow">
        <label htmlFor="c-message">Message</label>
        <textarea id="c-message" className="fld" value={form.message} onChange={set("message")} required />
        <p className="form-note">Tell us the product and quantity you need, or the order number if this is about an existing order.</p>
      </div>
      <div className="frow" aria-hidden="true" style={{ display: "none" }}>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" className="fld" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      {error ? <p className="err" role="alert">{error}</p> : null}
      <div>
        <button type="submit" className="btn p" disabled={busy}>{busy ? "Sending..." : "Send message"}</button>
      </div>
    </form>
  );
}
