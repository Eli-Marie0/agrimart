"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RoleGate from "./RoleGate";
import DashNav from "./DashNav";
import { useAuth, useToast } from "./Providers";
import { opsApi } from "@/lib/api";
import { REASONS, dateTime, peso } from "@/lib/format";

export default function StaffDashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [todayLabel, setTodayLabel] = useState("Today");

  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    opsApi.dashboard()
      .then((payload) => { setData(payload.data); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function restock(product, qty = 20) {
    setBusy(String(product.id));
    try {
      await opsApi.stockIn({ productId: product.id, changeQty: qty, reason: "stock_in" });
      push(`${qty} ${product.unit} added to ${product.name}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <RoleGate roles={["staff", "admin"]}>
      <div className="dash">
        <DashNav kind="staff" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Staff dashboard</p>
              <h1>Good day, {user?.fullName?.split(" ")[0] || "team"}.</h1>
              <p>{todayLabel} · Orders, stock and the day&apos;s log.</p>
            </div>
            <div className="btn-row">
              <Link href="/staff/orders" className="btn p">Open orders</Link>
              <Link href="/staff/inventory" className="btn">Inventory</Link>
            </div>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}
          {loading && !data ? <p className="load-note">Loading today&apos;s numbers...</p> : null}

          {data ? (
            <>
              <div className="dstats">
                <div className="dstat"><span>Orders today</span><b>{data.todayOrders}</b></div>
                <div className="dstat"><span>Paid sales today</span><b>{peso(data.todaySales)}</b></div>
                <div className="dstat"><span>Waiting to be paid</span><b>{data.pendingOrders}</b><small>pending orders</small></div>
                <div className="dstat"><span>Needs restocking</span><b>{data.lowStockCount}</b><small>at or below reorder</small></div>
              </div>

              <div className="dgrid">
                <section className="panel">
                  <div className="panel-h"><h2>Recent orders</h2><Link href="/staff/orders" className="link-quiet">All orders</Link></div>
                  {data.recentOrders?.length ? (
                    <div className="tw">
                      <table className="tbl">
                        <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
                        <tbody>
                          {data.recentOrders.map((order) => (
                            <tr key={order.id}>
                              <td><Link href="/staff/orders">{order.reference}</Link><small className="meta" style={{ display: "block" }}>{dateTime(order.createdAt)}</small></td>
                              <td>{order.customer?.fullName || "Customer"}</td>
                              <td><span className={`tag ${order.status === "cancelled" ? "out" : order.status === "pending" ? "warn" : "ink"}`}>{order.statusLabel}</span></td>
                              <td className="num">{peso(order.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="empty">No orders yet today.</p>}
                </section>

                <section className="panel">
                  <div className="panel-h"><h2>Needs restocking</h2><Link href="/staff/inventory" className="link-quiet">Open inventory</Link></div>
                  {data.lowStock?.length ? (
                    <div className="restock">
                      {data.lowStock.map((product) => (
                        <div className="restock-row" key={product.id}>
                          <span>{product.name}<small>{product.stockQty} {product.unit} on hand</small></span>
                          <button type="button" className="btn" disabled={busy === String(product.id)} onClick={() => restock(product)}>{busy === String(product.id) ? "Saving..." : "+20 stock in"}</button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="empty">Every product is above its reorder level.</p>}
                </section>
              </div>

              <section className="panel">
                <div className="panel-h"><h2>Today&apos;s inventory log</h2><Link href="/staff/inventory" className="link-quiet">Full log</Link></div>
                {data.recentLogs?.length ? (
                  <div className="tw">
                    <table className="tbl">
                      <thead><tr><th>When</th><th>Product</th><th>Reason</th><th className="num">Change</th><th>By</th></tr></thead>
                      <tbody>
                        {data.recentLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="nowrap">{dateTime(log.createdAt)}</td>
                            <td>{log.product?.name || "—"}</td>
                            <td>{REASONS[log.reason] || log.reason}</td>
                            <td className="num">{log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty}</td>
                            <td>{log.user?.fullName || "System"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="empty">No stock changes yet.</p>}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </RoleGate>
  );
}
