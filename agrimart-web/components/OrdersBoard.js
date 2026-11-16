"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "./Providers";
import { opsApi } from "@/lib/api";
import { STATUS_LABELS, dateTime, peso } from "@/lib/format";

const TRANSITIONS = {
  pending: ["paid", "preparing", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export default function OrdersBoard({ compact = false }) {
  const { push } = useToast();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    opsApi.orders({ status, q: appliedQuery })
      .then((payload) => { setOrders(payload.data || []); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, appliedQuery]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(order, next) {
    if (next === order.status) return false;
    if (next === "cancelled" && !window.confirm(`Cancel ${order.reference}? Stock that was deducted will be returned.`)) return false;
    setBusy(String(order.id));
    try {
      await opsApi.setStatus(order.id, next);
      push(`${order.reference} moved to ${STATUS_LABELS[next]}.`);
      load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <form
          className="group"
          onSubmit={(event) => { event.preventDefault(); setAppliedQuery(query.trim()); }}
          role="search"
        >
          <label htmlFor="order-search" className="sr">Search orders</label>
          <input
            id="order-search"
            className="fld"
            type="search"
            placeholder="Order number, customer, municipality"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ minWidth: 260 }}
          />
          <button type="submit" className="btn s">Search</button>
          {appliedQuery ? <button type="button" className="lnk" onClick={() => { setQuery(""); setAppliedQuery(""); }}>Clear</button> : null}
        </form>
        <div className="group">
          <span className="meta">{orders.length} order{orders.length === 1 ? "" : "s"}</span>
          <button type="button" className="btn s" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
      </div>

      <p className="form-note" style={{ margin: "-4px 0 16px" }}>
        Delivery steps: set an order to <b>Preparing</b>, then click <b>Start delivery</b>. AgriMart will send this device’s location to the customer if location access is allowed.
      </p>

      <div className="chips" style={{ marginBottom: 20 }}>
        <button type="button" className="chip" aria-pressed={!status} onClick={() => setStatus("")}>All</button>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <button key={value} type="button" className="chip" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>
        ))}
      </div>

      {error ? <p className="err" role="alert">{error}</p> : null}

      {!orders.length && !loading ? (
        <div className="empty"><h2>No orders match.</h2><p>Try another status or clear the search.</p></div>
      ) : null}

      {orders.length ? (
        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Fulfillment</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const allowed = (TRANSITIONS[order.status] || []).filter((next) => next !== "out_for_delivery");
                return (
                  <FragmentRow
                    key={order.id}
                    order={order}
                    allowed={allowed}
                    busy={busy === String(order.id)}
                    open={open === order.id}
                    onToggle={() => setOpen(open === order.id ? null : order.id)}
                    onChange={(next) => changeStatus(order, next)}
                    onTrackingUpdated={load}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function FragmentRow({ order, allowed, busy, open, onToggle, onChange, onTrackingUpdated }) {
  const { push } = useToast();
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingNote, setTrackingNote] = useState("");
  const [trackingError, setTrackingError] = useState("");

  function shareLocation() {
    setTrackingError("");
    if (!navigator.geolocation) {
      setTrackingError("Location sharing needs an HTTPS connection and browser location access. Open this page securely and allow location access.");
      return;
    }
    setTrackingBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        await opsApi.updateTracking(order.id, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          note: trackingNote,
        });
        setTrackingNote("");
        push(`Location updated for ${order.reference}.`);
        onTrackingUpdated();
      } catch (err) {
        setTrackingError(err.message);
      } finally {
        setTrackingBusy(false);
      }
    }, (err) => {
      setTrackingError(err.code === 1
        ? "Allow location access in the browser, then try again."
        : "Could not get the device location. Check GPS and try again.");
      setTrackingBusy(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  async function startDelivery() {
    if (!open) onToggle();
    const changed = await onChange("out_for_delivery");
    if (changed) shareLocation();
  }

  return (
    <>
      <tr>
        <td>
          <b>{order.reference}</b>
          <small className="meta" style={{ display: "block" }}>{dateTime(order.createdAt)}</small>
        </td>
        <td>
          {order.customer?.fullName || "Customer"}
          <small className="meta" style={{ display: "block" }}>{order.customer?.email}</small>
        </td>
        <td>
          {order.fulfillmentType === "pickup" ? "Pickup" : order.municipality || "Delivery"}
          <small className="meta" style={{ display: "block" }}>{order.items.length} item{order.items.length === 1 ? "" : "s"}</small>
        </td>
        <td className="num">{peso(order.totalAmount)}</td>
        <td>
          <span className={`tag ${order.status === "cancelled" ? "out" : order.status === "completed" ? "ok" : order.status === "pending" ? "warn" : "ink"}`}>
            {order.statusLabel}
          </span>
        </td>
        <td>
          <div className="btn-row" style={{ flexWrap: "nowrap" }}>
            {order.fulfillmentType === "delivery" && order.status === "preparing" ? (
              <button type="button" className="btn p s" onClick={startDelivery} disabled={busy || trackingBusy}>
                Start delivery
              </button>
            ) : null}
            {allowed.length ? (
              <select
                className="fld"
                aria-label={`Change status for ${order.reference}`}
                value={order.status}
                disabled={busy}
                onChange={(event) => onChange(event.target.value)}
              >
                <option value={order.status}>{busy ? "Saving..." : "Change status"}</option>
                {allowed.map((next) => <option key={next} value={next}>{STATUS_LABELS[next]}</option>)}
              </select>
            ) : null}
            <button type="button" className="btn s" onClick={onToggle} aria-expanded={open}>{open ? "Close" : "View"}</button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={6} style={{ background: "var(--surf)" }}>
            <div className="dgrid" style={{ gap: 24, margin: 0 }}>
              <div>
                <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Items</h3>
                {order.items.map((item) => (
                  <div className="line-item" key={item.id}>
                    <span>{item.product ? <Link href={`/products/${item.product.slug}`}>{item.product.name}</Link> : "Item"} <small className="meta">× {item.quantity}</small></span>
                    <span className="meta">{peso(item.unitPrice)}</span>
                    <span className="money">{peso(item.subtotal)}</span>
                  </div>
                ))}
                <div className="rl" style={{ marginTop: 8 }}><span>Subtotal</span><span>{peso(order.subtotal)}</span></div>
                <div className="rl"><span>Delivery</span><span>{peso(order.deliveryFee)}</span></div>
                <div className="rl tot"><span>Total</span><span>{peso(order.totalAmount)}</span></div>
              </div>
              <div>
                <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>Delivery</h3>
                <p className="meta" style={{ margin: "0 0 8px" }}>
                  {order.fulfillmentType === "pickup"
                    ? "Store pickup"
                    : [order.address?.street, order.address?.barangay, order.address?.municipality, order.address?.province].filter(Boolean).join(", ")}
                </p>
                <p className="meta" style={{ margin: "0 0 8px" }}>
                  Payment: {order.payment?.method?.toUpperCase() || "—"} · {order.payment?.status || "pending"}
                </p>
                {order.fulfillmentType === "delivery" && order.status === "out_for_delivery" ? (
                  <div className="notice" style={{ margin: "12px 0" }}>
                    <b>Delivery is in progress</b>
                    <p className="meta" style={{ margin: "4px 0 10px" }}>Tap below on the phone traveling with this order. Allow location access to send one map pin to the customer.</p>
                    <label className="sr" htmlFor={`tracking-note-${order.id}`}>Location update note</label>
                    <input
                      id={`tracking-note-${order.id}`}
                      className="fld"
                      value={trackingNote}
                      maxLength={160}
                      onChange={(event) => setTrackingNote(event.target.value)}
                      placeholder="Optional note, e.g. Leaving Victoria proper"
                    />
                    <button type="button" className="btn s" onClick={shareLocation} disabled={trackingBusy} style={{ marginTop: 8 }}>
                      {trackingBusy ? "Sending location..." : "Send location to customer"}
                    </button>
                    {order.tracking?.updatedAt ? <p className="meta" style={{ margin: "8px 0 0" }}>Last shared {dateTime(order.tracking.updatedAt)}{order.tracking.updatedBy ? ` by ${order.tracking.updatedBy}` : ""}.</p> : null}
                    {trackingError ? <p className="err" role="alert" style={{ margin: "8px 0 0" }}>{trackingError}</p> : null}
                  </div>
                ) : null}
                {order.notes ? <p className="meta" style={{ margin: "0 0 8px" }}>Note: {order.notes}</p> : null}
                <h3 style={{ fontSize: 16, margin: "16px 0 8px" }}>Activity</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {(order.statusHistory || []).slice().reverse().map((entry, index) => (
                    <li key={`${entry.at}-${index}`} style={{ fontSize: 13, borderBottom: "1px solid var(--bd)", padding: "5px 0" }}>
                      {entry.status.replace(/_/g, " ")} · {dateTime(entry.at)} · {entry.by}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
