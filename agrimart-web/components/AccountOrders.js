"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountNav from "./AccountNav";
import OrderTracker from "./OrderTracker";
import { useAuth } from "./Providers";
import { checkoutApi } from "@/lib/api";
import { STATUS_LABELS, dateTime, peso } from "@/lib/format";

const FILTERS = [["", "All"], ...Object.entries(STATUS_LABELS)];

export default function AccountOrders() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/account/orders");
  }, [ready, user, router]);

  useEffect(() => {
    if (!ready || !user) return;
    let alive = true;
    setLoading(true);
    checkoutApi.mine(filter || undefined)
      .then((payload) => { if (alive) { setOrders(payload.data || []); setError(""); } })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [ready, user, filter]);

  if (!ready || !user) {
    return <div className="wrap pad"><p className="load-note">Loading your orders...</p></div>;
  }

  return (
    <div className="dash">
      <AccountNav />
      <div className="dmain">
        <header className="dhead">
          <div>
            <p className="eyebrow">Account</p>
            <h1>My orders</h1>
            <p>Every order and its current status. Cancel while an order is still pending or paid.</p>
          </div>
          <Link href="/products" className="btn">Shop again</Link>
        </header>

        <div className="chips" style={{ marginBottom: 24 }}>
          {FILTERS.map(([value, label]) => (
            <button key={value || "all"} type="button" className="chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>

        {error ? <p className="err" role="alert">{error}</p> : null}
        {loading ? <p className="load-note">Loading orders...</p> : null}

        {!loading && !orders.length ? (
          <div className="empty">
            <h2>{filter ? `No ${STATUS_LABELS[filter]?.toLowerCase() || ""} orders.` : "No orders yet."}</h2>
            <p>When you place an order it appears here with live status and stock.</p>
            <Link href="/products" className="btn p" style={{ marginTop: 12 }}>Browse supplies</Link>
          </div>
        ) : null}

        {orders.map((order) => (
          <div className="ord-row" key={order.id}>
            <div>
              <h3><Link href={`/account/orders/${order.id}`}>{order.reference}</Link></h3>
              <p className="mut">{dateTime(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? "" : "s"} · {order.fulfillmentType === "pickup" ? "Pickup" : "Delivery"}</p>
              <OrderTracker status={order.status} />
            </div>
            <div>
              <span className={`tag ${order.status === "cancelled" ? "out" : order.status === "completed" ? "ok" : order.status === "pending" ? "warn" : "ink"}`}>
                {order.statusLabel}
              </span>
            </div>
            <div className="price">{peso(order.totalAmount)}</div>
            <Link href={`/account/orders/${order.id}`} className="btn s">Open</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
