"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountNav from "./AccountNav";
import OrderTracker from "./OrderTracker";
import MapPicker from "./MapPicker";
import { useAuth, useToast } from "./Providers";
import { checkoutApi, publicApi } from "@/lib/api";
import { dateTime, peso } from "@/lib/format";

export default function AccountOrderDetail({ orderId }) {
  const { user, ready } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [storeLocation, setStoreLocation] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    checkoutApi.mineOne(orderId)
      .then((payload) => { setOrder(payload.data); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}`);
  }, [ready, user, router, orderId]);

  useEffect(() => {
    if (ready && user) load();
  }, [ready, user, load]);

  useEffect(() => {
    let alive = true;
    publicApi.content()
      .then((payload) => { if (alive) setStoreLocation(payload?.data?.contact || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (order?.status !== "out_for_delivery") return undefined;
    const poll = () => checkoutApi.mineOne(orderId)
      .then((payload) => setOrder(payload.data))
      .catch(() => {});
    const timer = window.setInterval(poll, 30000);
    return () => window.clearInterval(timer);
  }, [order?.status, orderId]);

  if (!ready || !user) {
    return <div className="wrap pad"><p className="load-note">Loading the order...</p></div>;
  }

  async function cancelOrder() {
    if (!window.confirm("Cancel this order? Stock will be returned to the shelf.")) return;
    setBusy(true);
    try {
      await checkoutApi.cancel(order.id);
      push("Order cancelled. Stock was returned.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canCancel = order && ["pending", "paid"].includes(order.status);
  const hasPoint = (latitude, longitude) => latitude !== null && latitude !== undefined && latitude !== ""
    && longitude !== null && longitude !== undefined && longitude !== ""
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const hasTrackingPoint = hasPoint(order?.tracking?.latitude, order?.tracking?.longitude);
  const hasDestinationPoint = hasPoint(order?.address?.latitude, order?.address?.longitude);
  const storePoint = hasPoint(storeLocation?.latitude, storeLocation?.longitude)
    ? `${storeLocation.latitude},${storeLocation.longitude}`
    : "13.177,121.279";
  const destination = hasDestinationPoint
    ? `${order.address.latitude},${order.address.longitude}`
    : [order?.address?.street, order?.address?.barangay, order?.address?.municipality, order?.address?.province].filter(Boolean).join(", ");
  const markerCoordinates = hasTrackingPoint
    ? `${order.tracking.latitude},${order.tracking.longitude}`
    : hasDestinationPoint && (order?.status === "out_for_delivery" || order?.status === "completed")
      ? `${order.address.latitude},${order.address.longitude}`
      : storePoint;
  const mapCoordinates = markerCoordinates.split(",").map(Number);
  const mapLat = mapCoordinates[0];
  const mapLng = mapCoordinates[1];
  const directionsFrom = hasTrackingPoint ? `${order.tracking.latitude},${order.tracking.longitude}` : storePoint;
  const directionsTo = hasDestinationPoint ? destination : "";
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(directionsFrom)}&destination=${encodeURIComponent(destination || storePoint)}`;

  return (
    <div className="dash">
      <AccountNav />
      <div className="dmain">
        {loading ? <p className="load-note">Loading the order...</p> : null}
        {error ? (
          <div className="empty">
            <h2>We could not load that order.</h2>
            <p>{error}</p>
            <Link href="/account/orders" className="btn" style={{ marginTop: 12 }}>Back to my orders</Link>
          </div>
        ) : null}

        {order ? (
          <>
            <header className="dhead">
              <div>
                <p className="eyebrow">Order detail</p>
                <h1>{order.reference}</h1>
                <p>Placed {dateTime(order.createdAt)} · {order.fulfillmentType === "pickup" ? "Store pickup" : "Delivery"}</p>
              </div>
              <div className="btn-row">
                <span className={`tag ${order.status === "cancelled" ? "out" : order.status === "pending" ? "warn" : "ok"}`}>{order.statusLabel}</span>
                {canCancel ? <button type="button" className="btn" disabled={busy} onClick={cancelOrder}>{busy ? "Cancelling..." : "Cancel order"}</button> : null}
              </div>
            </header>

            <OrderTracker status={order.status} />

            {order.fulfillmentType === "delivery" ? (
              <section className="panel" style={{ margin: "0 0 24px" }}>
                <div className="panel-h">
                  <div>
                    <h2>Delivery tracking</h2>
                    <p className="meta" style={{ margin: "4px 0 0" }}>
                      {hasTrackingPoint
                        ? `Last location shared${order.tracking.updatedBy ? ` by ${order.tracking.updatedBy}` : ""} · ${dateTime(order.tracking.updatedAt)}`
                        : order.status === "out_for_delivery"
                          ? "The order is on its way. Waiting for the store's next location update."
                          : order.status === "completed"
                            ? "The order has been marked as delivered."
                            : "Your order is at the store while the team prepares it."}
                    </p>
                  </div>
                  <button type="button" className="btn s" onClick={load} disabled={loading}>
                    {loading ? "Refreshing..." : "Refresh location"}
                  </button>
                </div>
                {order.status !== "cancelled" ? (
                  <>
                    <MapPicker
                      latitude={mapLat}
                      longitude={mapLng}
                      zoom={15}
                      height={280}
                      readOnly
                      fallbackQuery={destination}
                      title={hasTrackingPoint ? "Last reported parcel location" : "AgriMart delivery map"}
                    />
                    {order.tracking?.note ? <p className="meta" style={{ margin: "10px 0 0" }}>{order.tracking.note}</p> : null}
                    <div className="btn-row" style={{ marginTop: 12 }}>
                      <a className="btn" href={directionsUrl} target="_blank" rel="noreferrer">{directionsTo ? "Open route in Google Maps" : "Find address in Google Maps"}</a>
                      {hasDestinationPoint ? <span className="meta">Delivery pin: {order.address.latitude}, {order.address.longitude}</span> : null}
                    </div>
                  </>
                ) : <p className="meta" style={{ margin: 0 }}>This order was cancelled; it is no longer being tracked.</p>}
                <p className="form-note" style={{ margin: "12px 0 0" }}>
                  This map shows the latest pin sent by the store. Tap <b>Refresh location</b> to check again; the pin moves when staff sends a new location. It is not continuous GPS tracking.
                </p>
              </section>
            ) : null}

            <div className="dgrid">
              <section className="panel">
                <div className="panel-h"><h2>Items</h2></div>
                <div className="line-items" style={{ marginTop: 0 }}>
                  {order.items.map((item) => (
                    <div className="line-item" key={item.id}>
                      <span>
                        {item.product ? <Link href={`/products/${item.product.slug}`}>{item.product.name}</Link> : "Item"}
                        <small className="meta" style={{ display: "block" }}>{item.quantity} × {peso(item.unitPrice)} · {item.product?.unit}</small>
                        {order.status === "completed" && item.product ? (
                          <Link className="link-quiet" href={`/products/${item.product.slug}#reviews`}>Review this item</Link>
                        ) : null}
                      </span>
                      <span className="meta">{item.quantity}</span>
                      <span className="money">{peso(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="rl" style={{ marginTop: 16 }}><span>Subtotal</span><span>{peso(order.subtotal)}</span></div>
                <div className="rl"><span>Delivery fee</span><span>{peso(order.deliveryFee)}</span></div>
                <div className="rl tot"><span>Total</span><span className="price">{peso(order.totalAmount)}</span></div>
              </section>

              <section className="panel">
                <div className="panel-h"><h2>Delivery and payment</h2></div>
                <dl className="kv">
                  <dt>Fulfillment</dt><dd>{order.fulfillmentType === "pickup" ? "Store pickup" : "Delivery"}</dd>
                  {order.fulfillmentType === "delivery" ? (
                    <>
                      <dt>Address</dt>
                      <dd>{[order.address?.street, order.address?.barangay, order.address?.municipality, order.address?.province].filter(Boolean).join(", ") || "—"}</dd>
                    </>
                  ) : null}
                  <dt>Payment</dt><dd>{order.payment?.method?.toUpperCase() || "—"} · {order.payment?.status || "pending"}</dd>
                  {order.payment?.paymongoRef ? <><dt>Payment ref</dt><dd style={{ wordBreak: "break-all" }}>{order.payment.paymongoRef}</dd></> : null}
                  {order.notes ? <><dt>Note</dt><dd>{order.notes}</dd></> : null}
                </dl>

                {order.statusHistory?.length ? (
                  <>
                    <h2 style={{ fontSize: 18, marginTop: 24 }}>Activity</h2>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {order.statusHistory.slice().reverse().map((entry, index) => (
                        <li key={`${entry.status}-${entry.at}-${index}`} style={{ borderBottom: "1px solid var(--bd)", padding: "8px 0", fontSize: 13 }}>
                          <b>{entry.status.replace(/_/g, " ")}</b> · {dateTime(entry.at)} · {entry.by}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            </div>

            <div className="btn-row" style={{ marginTop: 32 }}>
              <Link href="/account/orders" className="btn">Back to my orders</Link>
              <Link href="/products" className="btn p">Shop again</Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
