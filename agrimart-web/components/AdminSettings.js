"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import { useToast } from "./Providers";
import { adminApi } from "@/lib/api";

const FEE_SUGGESTIONS = ["Victoria", "Naujan", "Calapan", "Socorro", "Pinamalayan", "Bongabong", "Roxas", "Mansalay", "Bulalacao", "Puerto Galera"];

export default function AdminSettings() {
  const { push } = useToast();
  const [settings, setSettings] = useState(null);
  const [fees, setFees] = useState([]);
  const [newFee, setNewFee] = useState({ name: "", fee: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState(null);
  const [mailTo, setMailTo] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailNote, setMailNote] = useState("");

  const loadMail = useCallback(() => {
    adminApi
      .mail()
      .then((payload) => {
        setMail(payload.data || null);
        setMailTo((current) => current || payload.data?.from?.match(/<(.+)>/)?.[1] || "");
      })
      .catch(() => setMail(null));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .content()
      .then((payload) => {
        const data = payload.data?.settings || {};
        setSettings({
          ...data,
          deliveryFees: undefined,
        });
        setFees(
          Object.entries(data.deliveryFees || {}).map(([name, fee]) => ({ name, fee: String(fee) }))
        );
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    loadMail();
  }, [load, loadMail]);

  const suggestions = useMemo(
    () => FEE_SUGGESTIONS.filter((name) => !fees.some((row) => row.name.toLowerCase() === name.toLowerCase())),
    [fees]
  );

  function set(key) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setSettings((current) => ({ ...current, [key]: value }));
    };
  }

  function setFee(index, key) {
    return (event) => {
      const value = event.target.value;
      setFees((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
    };
  }

  function removeFee(index) {
    setFees((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function addSuggested(name) {
    setNewFee({ name, fee: "100" });
  }

  function addFee(event) {
    event?.preventDefault();
    const name = newFee.name.trim();
    if (!name) return setError("Enter a municipality name before adding a fee.");
    if (fees.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      return setError(`${name} already has a delivery fee.`);
    }
    setFees((current) => [...current, { name, fee: String(newFee.fee || 0) }]);
    setNewFee({ name: "", fee: "" });
    setError("");
  }

  async function save(event) {
    event?.preventDefault();
    setError("");
    const deliveryFees = {};
    for (const row of fees) {
      const name = row.name.trim();
      if (!name) continue;
      deliveryFees[name] = Math.max(0, Number(row.fee || 0));
    }
    if (!Object.keys(deliveryFees).length) return setError("Add at least one municipality delivery fee.");
    setBusy(true);
    try {
      await adminApi.updateSettings({
        storeName: settings.storeName,
        tagline: settings.tagline,
        announcementBar: settings.announcementBar,
        supportPhone: settings.supportPhone,
        supportEmail: settings.supportEmail,
        pickupNote: settings.pickupNote,
        defaultDeliveryFee: Number(settings.defaultDeliveryFee || 0),
        freeDeliveryThreshold: Number(settings.freeDeliveryThreshold || 0),
        defaultReorderLevel: Number(settings.defaultReorderLevel || 0),
        lowStockEmail: settings.lowStockEmail,
        plusMonthly: Number(settings.plusMonthly || 0),
        plusYearly: Number(settings.plusYearly || 0),
        maintenanceMode: Boolean(settings.maintenanceMode),
        deliveryFees,
      });
      push("Store settings saved.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTestMail() {
    setMailBusy(true);
    setMailNote("");
    try {
      const payload = await adminApi.testMail({ to: mailTo.trim() });
      const result = payload.data || {};
      setMailNote(
        result.sent
          ? `Test email sent to ${result.to}.`
          : `SMTP is not configured, so the email was saved as a preview${result.preview ? ` at ${result.preview}` : " in .tmp/mail"}.`
      );
      loadMail();
    } catch (err) {
      setMailNote(err.message);
    } finally {
      setMailBusy(false);
    }
  }

  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Settings</p>
              <h1>Store settings</h1>
              <p>Delivery fees, low-stock alerts, plan prices, the announcement bar and maintenance mode.</p>
            </div>
            <div className="btn-row">
              <Link href="/" className="btn">View storefront</Link>
              <button type="button" className="btn" onClick={save} disabled={busy || loading}>{busy ? "Saving..." : "Save settings"}</button>
            </div>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}
          {loading && !settings ? <p className="load-note">Loading settings...</p> : null}

          {settings ? (
            <form className="form" onSubmit={save} noValidate>
              <section className="editor" style={{ marginTop: 0 }}>
                <h2>Store identity</h2>
                <div className="f2">
                  <div className="frow">
                    <label htmlFor="s-name">Store name</label>
                    <input id="s-name" className="fld" value={settings.storeName || ""} onChange={set("storeName")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="s-tagline">Tagline</label>
                    <input id="s-tagline" className="fld" value={settings.tagline || ""} onChange={set("tagline")} />
                  </div>
                </div>
              </section>

              <section className="editor">
                <div className="panel-h">
                  <h2>Delivery fees</h2>
                  <span className="meta">Flat fee per municipality</span>
                </div>
                <div className="tw">
                  <table className="tbl">
                    <thead><tr><th>Municipality</th><th className="num">Fee (PHP)</th><th /></tr></thead>
                    <tbody>
                      {fees.map((row, index) => (
                        <tr key={`${row.name}-${index}`}>
                          <td>
                            <label htmlFor={`fee-name-${index}`} className="sr">Municipality {index + 1}</label>
                            <input id={`fee-name-${index}`} className="fld" value={row.name} onChange={setFee(index, "name")} placeholder="Municipality" />
                          </td>
                          <td className="num">
                            <label htmlFor={`fee-value-${index}`} className="sr">Fee for {row.name || `row ${index + 1}`}</label>
                            <input id={`fee-value-${index}`} className="fld" type="number" min="0" step="1" value={row.fee} onChange={setFee(index, "fee")} style={{ maxWidth: 130, marginLeft: "auto" }} />
                          </td>
                          <td><button type="button" className="lnk" onClick={() => removeFee(index)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="f3" style={{ marginTop: 16 }}>
                  <div className="frow">
                    <label htmlFor="fee-new-name">Add municipality</label>
                    <input id="fee-new-name" className="fld" value={newFee.name} onChange={(event) => setNewFee((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Victoria" />
                  </div>
                  <div className="frow">
                    <label htmlFor="fee-new-value">Fee (PHP)</label>
                    <input id="fee-new-value" className="fld" type="number" min="0" value={newFee.fee} onChange={(event) => setNewFee((current) => ({ ...current, fee: event.target.value }))} />
                  </div>
                  <div className="frow">
                    <span aria-hidden="true">&nbsp;</span>
                    <button type="button" className="btn" onClick={addFee}>Add fee</button>
                  </div>
                </div>
                {suggestions.length ? (
                  <div className="pill-row" style={{ marginTop: 12 }}>
                    {suggestions.map((name) => (
                      <button key={name} type="button" className="chip" onClick={() => addSuggested(name)}>{name}</button>
                    ))}
                  </div>
                ) : null}
                <p className="form-note">Pickup is always free. Checkout uses these fees and falls back to the default fee below for unlisted towns.</p>
                <div className="f3" style={{ marginTop: 16 }}>
                  <div className="frow">
                    <label htmlFor="s-default-fee">Default delivery fee</label>
                    <input id="s-default-fee" className="fld" type="number" min="0" value={settings.defaultDeliveryFee ?? 0} onChange={set("defaultDeliveryFee")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="s-free">Free delivery from</label>
                    <input id="s-free" className="fld" type="number" min="0" value={settings.freeDeliveryThreshold ?? 0} onChange={set("freeDeliveryThreshold")} />
                    <p className="form-note">Set 0 to disable free-delivery threshold.</p>
                  </div>
                  <div className="frow">
                    <label htmlFor="s-pickup">Pickup note</label>
                    <textarea id="s-pickup" className="fld" value={settings.pickupNote || ""} onChange={set("pickupNote")} />
                  </div>
                </div>
              </section>

              <section className="editor">
                <h2>Inventory alerts</h2>
                <div className="f2">
                  <div className="frow">
                    <label htmlFor="s-reorder">Default reorder level</label>
                    <input id="s-reorder" className="fld" type="number" min="0" value={settings.defaultReorderLevel ?? 10} onChange={set("defaultReorderLevel")} />
                    <p className="form-note">Used for new products when no reorder level is typed.</p>
                  </div>
                  <div className="frow">
                    <label htmlFor="s-lowstock">Low-stock alert email</label>
                    <input id="s-lowstock" className="fld" type="email" value={settings.lowStockEmail || ""} onChange={set("lowStockEmail")} />
                    <p className="form-note">One email when a product first drops to its reorder level.</p>
                  </div>
                </div>
              </section>

              <section className="editor">
                <h2>Email delivery</h2>
                <div className="f2">
                  <div className="frow">
                    <p className="form-note" style={{ margin: "0 0 4px" }}>Delivery mode</p>
                    <p style={{ margin: 0 }}>
                      <b>{mail ? (mail.mode === "smtp" ? "SMTP (live)" : "Preview only") : "Checking…"}</b>
                    </p>
                    <p className="form-note">
                      {mail?.configured
                        ? `Sending through ${mail.host}:${mail.port}${mail.secure ? " (TLS)" : ""} from ${mail.from}.`
                        : "No usable SMTP credentials. Order and alert emails are written to agrimart-api/.tmp/mail so you can inspect them."}
                    </p>
                  </div>
                  <div className="frow">
                    <label htmlFor="s-mail-to">Send a test email to</label>
                    <input id="s-mail-to" className="fld" type="email" value={mailTo} onChange={(event) => setMailTo(event.target.value)} placeholder="you@example.com" />
                    <div className="btn-row" style={{ marginTop: 8 }}>
                      <button type="button" className="btn s" onClick={sendTestMail} disabled={mailBusy}>{mailBusy ? "Sending…" : "Send test email"}</button>
                    </div>
                    {mailNote ? <p className="form-note" role="status">{mailNote}</p> : null}
                  </div>
                </div>
              </section>

              <section className="editor">
                <h2>AgriMart Plus plans</h2>
                <div className="f2">
                  <div className="frow">
                    <label htmlFor="s-plus-m">Monthly price (PHP)</label>
                    <input id="s-plus-m" className="fld" type="number" min="0" value={settings.plusMonthly ?? 0} onChange={set("plusMonthly")} />
                  </div>
                  <div className="frow">
                    <label htmlFor="s-plus-y">Yearly price (PHP)</label>
                    <input id="s-plus-y" className="fld" type="number" min="0" value={settings.plusYearly ?? 0} onChange={set("plusYearly")} />
                  </div>
                </div>
              </section>

              <section className="editor">
                <h2>Storefront messages</h2>
                <div className="frow">
                  <label htmlFor="s-annbar">Announcement bar</label>
                  <input id="s-annbar" className="fld" value={settings.announcementBar || ""} onChange={set("announcementBar")} placeholder="Leave blank to hide the bar" />
                  <p className="form-note">Shown at the top of every storefront page. Keep it short.</p>
                </div>
                <label className="check" style={{ marginTop: 16 }}>
                  <input type="checkbox" checked={Boolean(settings.maintenanceMode)} onChange={set("maintenanceMode")} />
                  Maintenance mode: show the maintenance page to shoppers while you restock or update the store.
                </label>
                <p className="form-note">Staff and admin screens stay reachable. Turn this off before opening the store.</p>
              </section>

              <section className="editor">
                <h2>Support contacts</h2>
                <div className="f2">
                  <div className="frow">
                    <label htmlFor="s-phone">Support phone</label>
                    <input id="s-phone" className="fld" value={settings.supportPhone || ""} onChange={set("supportPhone")} placeholder="+63 …" />
                  </div>
                  <div className="frow">
                    <label htmlFor="s-email">Support email</label>
                    <input id="s-email" className="fld" type="email" value={settings.supportEmail || ""} onChange={set("supportEmail")} />
                  </div>
                </div>
              </section>

              <div className="btn-row">
                <button type="submit" className="btn p" disabled={busy}>{busy ? "Saving..." : "Save settings"}</button>
                <button type="button" className="btn" onClick={load} disabled={busy || loading}>Discard changes</button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </RoleGate>
  );
}
