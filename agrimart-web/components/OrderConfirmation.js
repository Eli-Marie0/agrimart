"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import OrderTracker from "./OrderTracker";
import { useAuth } from "./Providers";
import { checkoutApi } from "@/lib/api";
import { dateTime, peso } from "@/lib/format";
import { useCart } from "@/lib/cart";

export default function OrderConfirmation({ orderId, paymentFlag = "" }) {
  const { user, ready } = useAuth();
  const cart = useCart();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const cartClearedForOrder = useRef("");

  const load = useCallback(async () => {
    if (!orderId) {
      setError("That order link is incomplete.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const payload = await checkoutApi.mineOne(orderId);
      setOrder(payload.data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return;
    load();
  }, [ready, user, load]);

  useEffect(() => {
    if (["success", "simulated"].includes(paymentFlag)
      && order?.payment?.status === "paid"
      && ["paid", "preparing", "out_for_delivery", "completed"].includes(order?.status)
      && cartClearedForOrder.current !== String(order.id)) {
      cart.removeOrdered(order.items);
      cartClearedForOrder.current = String(order.id);
    }
  }, [paymentFlag, order?.id, order?.payment?.status]);

  // Pull the gateway state a few times after the redirect back, so the order
  // still updates when a webhook cannot reach this host.
  useEffect(() => {
    if (paymentFlag !== "success" || !order) return undefined;
    if (order.payment?.method === "cod" || order.payment?.status === "paid") return undefined;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await new Promise((resolve) => { setTimeout(resolve, attempt === 0 ? 800 : 3500); });
        if (cancelled) return;
        const updated = await checkPayment({ silent: true });
        if (cancelled) return;
        if (updated?.payment?.status === "paid") return;
      }
    })();
    return () => { cancelled = true; };
  }, [paymentFlag, order?.id]);

  async function simulatePayment() {
    if (!order || paymentBusy) return;
    setPaymentBusy(true);
    setError("");
    try {
      await checkoutApi.simulatePay(order.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  /**
   * PayMongo redirects the customer back here. When a public webhook cannot
   * reach the API (for example on localhost), the page pulls the checkout
   * session state a few times so the order still turns paid without a refresh.
   */
  async function checkPayment({ silent = false } = {}) {
    if (!order || order.payment?.method === "cod" || order.payment?.status === "paid") return null;
    if (paymentFlag === "simulated") return null;
    if (!silent) setChecking(true);
    try {
      const payload = await checkoutApi.syncPayment(order.id);
      const updated = payload?.data?.order;
      if (updated) setOrder(updated);
      if (!silent) setError("");
      return updated || null;
    } catch (err) {
      if (!silent) setError(err.message);
      return null;
    } finally {
      if (!silent) setChecking(false);
    }
  }

  async function refreshWithPayment() {
    if (!order) return;
    setBusy(true);
    try {
      if (order.payment?.method !== "cod" && order.payment?.status !== "paid") {
        const updated = await checkPayment();
        if (updated) {
          setBusy(false);
          return;
        }
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelUnpaidOrder() {
    if (!order || cancelBusy) return;
    setCancelBusy(true);
    setError("");
    try {
      await checkoutApi.cancel(order.id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelBusy(false);
    }
  }

  if (!ready || (!user && !error)) {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>Loading your order...</h2>
          <p>One moment.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>Sign in to see this order.</h2>
          <p>Use the account that placed the order.</p>
          <Link href={`/login?next=${encodeURIComponent(`/order-confirmation?order=${orderId || ""}`)}`} className="btn p">Sign in</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>We could not load that order.</h2>
          <p>{error}</p>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={load}>Try again</button>
            <Link href="/account/orders" className="btn">My orders</Link>
          </div>
        </div>
      </div>
    );
  }

  if (busy || !order) {
    return <div className="wrap pad"><p className="load-note">Fetching the latest order status...</p></div>;
  }

  const paid = order.payment?.status === "paid";
  const paidOnCancelledOrder = paid && order.status === "cancelled";
  const paymentWaiting = !paid && ["success", "pending"].includes(paymentFlag);
  const canSimulatePayment = paymentFlag === "simulated" && order.payment?.method !== "cod" && !paid && order.status !== "cancelled";

  return (
    <div className="wrap pad">
      <header className="page-h" style={{ paddingTop: 0 }}>
        <p className="eyebrow">{paidOnCancelledOrder ? "Payment received · Order cancelled" : paymentFlag === "cancelled" ? "Payment not completed" : paymentWaiting ? "Payment processing" : "Order received"}</p>
        <h1>{paidOnCancelledOrder ? "Your payment needs the store’s attention." : paid ? "Thank you. Payment received." : paymentWaiting ? "Payment confirmation pending." : "Thank you. Your order is in."}</h1>
        <p>
          Order <b>{order.reference}</b> was placed on {dateTime(order.createdAt)}.
          {order.fulfillmentType === "pickup" ? " Pick up at the counter when we email you." : " We will call before delivery."}
          {paymentWaiting ? " We are checking the payment with the provider; this page updates on its own." : null}
          {paidOnCancelledOrder ? " The order was cancelled before the payment arrived. Please contact the store to arrange a refund." : null}
          {paymentFlag === "cancelled" && !paid ? " The payment was cancelled; you were not charged. Your cart is still saved so you can try checkout again." : null}
          {canSimulatePayment ? " This is a local demo payment; it will not charge a real account." : null}
        </p>
      </header>

      <div className="two" style={{ alignItems: "start" }}>
        <div>
          <div className="order-head">
            <div>
              <h2 className="h2" style={{ marginBottom: 4 }}>{order.reference}</h2>
              <p className="meta" style={{ margin: 0 }}>{order.statusLabel} · {order.fulfillmentType === "pickup" ? "Store pickup" : "Delivery"}</p>
            </div>
            <span className={`tag ${order.status === "cancelled" ? "out" : paid ? "ok" : "warn"}`}>
              {paid ? "Paid" : order.payment?.status === "failed" ? "Payment failed" : "Payment pending"}
            </span>
          </div>

          <OrderTracker status={order.status} />

          <dl className="kv" style={{ marginTop: 24 }}>
            <dt>Customer</dt><dd>{order.customer?.fullName || user.fullName}</dd>
            <dt>Email</dt><dd>{order.customer?.email || user.email}</dd>
            <dt>Fulfillment</dt><dd>{order.fulfillmentType === "pickup" ? "Store pickup" : "Delivery"}</dd>
            {order.fulfillmentType === "delivery" ? (
              <>
                <dt>Address</dt>
                <dd>{[order.address?.street, order.address?.barangay, order.address?.municipality, order.address?.province].filter(Boolean).join(", ") || "—"}</dd>
              </>
            ) : null}
            <dt>Payment</dt><dd>{order.payment?.method?.toUpperCase() || "—"} · {order.payment?.status || "pending"}</dd>
            {order.notes ? <><dt>Note</dt><dd>{order.notes}</dd></> : null}
          </dl>

          <div className="line-items">
            {order.items.map((item) => (
              <div className="line-item" key={item.id}>
                <span>
                  {item.product ? <Link href={`/products/${item.product.slug}`}>{item.product.name}</Link> : "Item"}
                  <small className="meta" style={{ display: "block" }}>{item.quantity} × {peso(item.unitPrice)}</small>
                </span>
                <span className="meta">{item.quantity}</span>
                <span className="money">{peso(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="rl" style={{ marginTop: 16 }}><span>Subtotal</span><span>{peso(order.subtotal)}</span></div>
          <div className="rl"><span>Delivery fee</span><span>{peso(order.deliveryFee)}</span></div>
          <div className="rl tot"><span>Total</span><span className="price">{peso(order.totalAmount)}</span></div>
        </div>

        <aside className="rcpt">
          <h2>What happens next</h2>
          <p className="form-note" style={{ margin: 0 }}>
            {paidOnCancelledOrder
              ? "The order was cancelled before payment confirmation. Contact the store so staff can review the payment and arrange a refund."
              : order.status === "pending"
              ? "The store checks stock and confirms the order. You will get an email after every status change."
              : order.status === "paid"
                ? "Payment is complete and stock is reserved. The team starts preparing the order next."
                : order.status === "preparing"
                  ? "The team is packing the order now."
                  : order.status === "out_for_delivery"
                    ? "The order is with the rider. Keep your phone nearby."
                    : order.status === "completed"
                      ? "This order is complete. Thank you for buying local."
                      : "This order was cancelled and the stock was returned to the shelf."}
          </p>
          <button type="button" className="btn" onClick={refreshWithPayment} disabled={busy || checking}>
            {busy || checking ? "Checking..." : order.payment?.method === "cod" || paid || paymentFlag === "simulated" ? "Refresh status" : "Check payment status"}
          </button>
          {checking ? <p className="form-note" role="status">Asking the payment provider for the latest state...</p> : null}
          {canSimulatePayment ? <button type="button" className="btn p" onClick={simulatePayment} disabled={paymentBusy}>{paymentBusy ? "Confirming demo payment..." : "Simulate successful payment"}</button> : null}
          {paymentFlag === "cancelled" && order.status === "pending" && !paid ? <button type="button" className="btn" onClick={cancelUnpaidOrder} disabled={cancelBusy}>{cancelBusy ? "Cancelling order..." : "Cancel this unpaid order"}</button> : null}
          {paymentFlag === "cancelled" && !paid ? <Link href="/cart" className="btn p">Review saved cart</Link> : null}
          {paidOnCancelledOrder ? <Link href="/contact" className="btn p">Contact the store</Link> : null}
          <Link href="/account/orders" className="btn p">View my orders</Link>
          <Link href="/products" className="link-quiet" style={{ textAlign: "center" }}>Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
