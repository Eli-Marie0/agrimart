"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import { useToast } from "./Providers";
import { opsApi, reportsApi } from "@/lib/api";
import { REASONS, dateTime, peso } from "@/lib/format";

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const { push } = useToast();
  const [range, setRange] = useState(7);
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      reportsApi.summary({ from: isoDaysAgo(range - 1), to: new Date().toISOString().slice(0, 10) }),
      opsApi.dashboard(),
    ])
      .then(([report, dashboard]) => {
        setSummary(report.data);
        setOps(dashboard.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const series = useMemo(() => {
    const rows = summary?.series || [];
    const max = Math.max(1, ...rows.map((row) => row.sales));
    return rows.slice(-14).map((row) => ({ ...row, height: Math.max(2, Math.round((row.sales / max) * 100)) }));
  }, [summary]);

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
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Admin overview</p>
              <h1>Store overview</h1>
              <p>Paid sales, orders, stock and the shelf, in one place.</p>
            </div>
            <div className="group" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label htmlFor="range" className="meta">Range</label>
              <select id="range" className="fld" value={range} onChange={(event) => setRange(Number(event.target.value))}>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}
          {loading && !summary ? <p className="load-note">Loading reports...</p> : null}

          {summary ? (
            <>
              <div className="dstats">
                <div className="dstat"><span>Paid sales</span><b>{peso(summary.totals.sales)}</b><small>{summary.totals.paidOrders} paid orders</small></div>
                <div className="dstat"><span>Orders</span><b>{summary.totals.orders}</b><small>{summary.totals.averageOrder ? `${peso(summary.totals.averageOrder)} average` : "no paid orders yet"}</small></div>
                <div className="dstat"><span>Low stock</span><b>{summary.inventory.lowStock}</b><small>{summary.inventory.outOfStock} out of stock</small></div>
                <div className="dstat"><span>Products</span><b>{summary.inventory.products}</b><small>{peso(summary.inventory.retailValue)} retail value</small></div>
              </div>

              <div className="dgrid">
                <section className="panel">
                  <div className="panel-h"><h2>Sales this period</h2><span className="meta">{peso(summary.totals.sales)}</span></div>
                  <div className="bars bars-dense" role="img" aria-label={`Sales by day for the last ${range} days`}>
                    {series.map((row) => (
                      <div className="bar" key={row.date} title={`${row.date}: ${peso(row.sales)}`}>
                        <b>{row.sales ? peso(row.sales) : ""}</b>
                        <div className="bar-plot"><i style={{ height: `${row.height}%` }} /></div>
                        <span>{String(row.date).slice(5).replace("-", "/")}</span>
                      </div>
                    ))}
                  </div>
                  <p className="form-note">Bars show paid orders only. Cancelled orders are excluded.</p>
                </section>

                <section className="panel">
                  <div className="panel-h"><h2>Needs restocking</h2><Link href="/admin/inventory" className="link-quiet">Inventory</Link></div>
                  {summary.lowStock?.length ? (
                    <div className="restock">
                      {summary.lowStock.map((product) => (
                        <div className="restock-row" key={product.id}>
                          <span>{product.name}<small>{product.stockQty} {product.unit} on hand · reorder {product.reorderLevel}</small></span>
                          <button type="button" className="btn" disabled={busy === String(product.id)} onClick={() => restock(product)}>{busy === String(product.id) ? "Saving..." : "+20"}</button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="empty">No product is below its reorder level.</p>}
                </section>
              </div>

              <div className="dgrid">
                <section className="panel">
                  <div className="panel-h"><h2>Recent orders</h2><Link href="/admin/orders" className="link-quiet">All orders</Link></div>
                  <div className="tw">
                    <table className="tbl">
                      <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
                      <tbody>
                        {summary.recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td>{order.reference}<small className="meta" style={{ display: "block" }}>{dateTime(order.createdAt)}</small></td>
                            <td>{order.customer?.fullName || "Customer"}</td>
                            <td><span className={`tag ${order.status === "cancelled" ? "out" : order.status === "pending" ? "warn" : "ink"}`}>{order.statusLabel}</span></td>
                            <td className="num">{peso(order.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-h"><h2>Top sellers</h2><Link href="/admin/reports" className="link-quiet">Reports</Link></div>
                  {summary.topProducts?.length ? (
                    <div className="restock">
                      {summary.topProducts.map((product, index) => (
                        <div className="restock-row" key={product.id}>
                          <span><b>{index + 1}. {product.name}</b><small>{product.quantity} {product.unit} sold</small></span>
                          <span className="money">{peso(product.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="empty">No paid sales in this period.</p>}
                </section>
              </div>

              <section className="panel">
                <div className="panel-h"><h2>Inventory log</h2><Link href="/admin/inventory" className="link-quiet">Full log</Link></div>
                {ops?.recentLogs?.length ? (
                  <div className="tw">
                    <table className="tbl">
                      <thead><tr><th>When</th><th>Product</th><th>Reason</th><th className="num">Change</th><th>By</th></tr></thead>
                      <tbody>
                        {ops.recentLogs.map((log) => (
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
