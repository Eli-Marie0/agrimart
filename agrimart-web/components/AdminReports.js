"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import { useToast } from "./Providers";
import { reportsApi } from "@/lib/api";
import { STATUS_LABELS, dateTime, peso } from "@/lib/format";

function today() {
  return dateKey(new Date());
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateKey(d);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const PAYMENT_LABELS = {
  cod: "Cash on delivery",
  online: "Online payment",
  pickup: "Pay at pickup",
  paymongo: "PayMongo",
  gcash: "GCash",
};

export default function AdminReports() {
  const { push } = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    setTo(today());
    setFrom(daysAgo(29));
  }, []);

  const params = useMemo(() => ({ from, to }), [from, to]);

  const load = useCallback(() => {
    if (!from || !to) return;
    setLoading(true);
    Promise.all([reportsApi.summary(params), reportsApi.sales(params), reportsApi.inventory()])
      .then(([summaryPayload, salesPayload, inventoryPayload]) => {
        setSummary(summaryPayload.data);
        setSales(salesPayload.data);
        setInventory(inventoryPayload.data);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const series = useMemo(() => {
    const rows = summary?.series || [];
    const visibleRows = rows[0]?.period === "day" ? rows.slice(-31) : rows;
    const max = Math.max(1, ...visibleRows.map((row) => row.sales));
    return visibleRows.map((row) => ({ ...row, height: Math.max(2, Math.round((row.sales / max) * 100)) }));
  }, [summary]);

  const chartPeriod = series[0]?.period || "day";

  function periodLabel(row) {
    if (row.period === "year") return row.date;
    if (row.period === "month") {
      const [year, month] = row.date.split("-");
      const name = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-PH", { month: "short" });
      return `${name} '${year.slice(-2)}`;
    }
    return String(row.date).slice(5).replace("-", "/");
  }

  const paymentRows = summary?.paymentBreakdown || [];
  const statusRows = Object.entries(summary?.statusCounts || {}).sort((a, b) => b[1] - a[1]);

  async function download(type) {
    setExporting(type);
    try {
      const filename = await reportsApi.download(type, params);
      push(`Downloaded ${filename}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting("");
    }
  }

  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Reports</p>
              <h1>Sales and stock reports</h1>
              <p>Pick a date range, review paid sales, and export the numbers as CSV for your records.</p>
            </div>
            <div className="btn-row">
              <button type="button" className="btn s" onClick={() => { setFrom(today()); setTo(today()); }}>Today</button>
              <button type="button" className="btn s" onClick={() => { setFrom(daysAgo(6)); setTo(today()); }}>7 days</button>
              <button type="button" className="btn s" onClick={() => { setFrom(daysAgo(29)); setTo(today()); }}>30 days</button>
              <button type="button" className="btn s" onClick={() => { setFrom(daysAgo(89)); setTo(today()); }}>90 days</button>
            </div>
          </header>

          <div className="toolbar">
            <div className="group">
              <div className="frow">
                <label htmlFor="rep-from">From</label>
                <input id="rep-from" className="fld" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
              </div>
              <div className="frow">
                <label htmlFor="rep-to">To</label>
                <input id="rep-to" className="fld" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
              </div>
            </div>
            <button type="button" className="btn s" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>

          {error ? <p className="err" role="alert">{error}</p> : null}
          {loading && !summary ? <p className="load-note">Loading reports...</p> : null}

          {summary ? (
            <>
              <section className="period-sales" aria-label="Sales by period">
                <div className="dstat"><span>Sales today</span><b>{peso(summary.periods?.today?.sales || 0)}</b><small>{summary.periods?.today?.paidOrders || 0} paid orders</small></div>
                <div className="dstat"><span>Sales this month</span><b>{peso(summary.periods?.month?.sales || 0)}</b><small>{summary.periods?.month?.paidOrders || 0} paid orders</small></div>
                <div className="dstat"><span>Sales this year</span><b>{peso(summary.periods?.year?.sales || 0)}</b><small>{summary.periods?.year?.paidOrders || 0} paid orders</small></div>
              </section>
              <div className="dstats">
                <div className="dstat"><span>Sales in selected range</span><b>{peso(summary.totals.sales)}</b><small>{summary.totals.paidOrders} paid orders</small></div>
                <div className="dstat"><span>Orders</span><b>{summary.totals.orders}</b><small>{summary.totals.cancelled} cancelled · {summary.totals.pending} pending</small></div>
                <div className="dstat"><span>Items sold</span><b>{summary.totals.itemsSold}</b><small>{summary.totals.averageOrder ? `${peso(summary.totals.averageOrder)} average order` : "no paid orders yet"}</small></div>
                <div className="dstat"><span>Stock value</span><b>{peso(summary.inventory.retailValue)}</b><small>{summary.inventory.lowStock} low · {summary.inventory.outOfStock} out</small></div>
              </div>

              <section className="panel">
                <div className="panel-h">
                  <h2>Sales by {chartPeriod}</h2>
                  <span className="meta">{peso(summary.totals.sales)} across {summary.totals.paidOrders} orders</span>
                </div>
                <div className="bars bars-dense" role="img" aria-label={`Paid sales by ${chartPeriod} for the selected range`}>
                  {series.map((row, index) => (
                    <div className="bar" key={row.date} title={`${row.date}: ${peso(row.sales)} (${row.orders} orders)`}>
                      <b>{row.sales ? peso(row.sales) : ""}</b>
                      <div className="bar-plot"><i style={{ height: `${row.height}%` }} /></div>
                      <span>{series.length <= 16 || index % 2 === 0 ? periodLabel(row) : ""}</span>
                    </div>
                  ))}
                </div>
                <p className="form-note">Sales are grouped by payment date. Cash-on-delivery orders count when staff records payment; pending and cancelled orders are excluded.</p>
              </section>

              <div className="dgrid">
                <section className="panel">
                  <div className="panel-h"><h2>Top products</h2><span className="meta">by revenue</span></div>
                  {sales?.topProducts?.length ? (
                    <div className="tw">
                      <table className="tbl">
                        <thead><tr><th>#</th><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
                        <tbody>
                          {sales.topProducts.map((product, index) => (
                            <tr key={product.id}>
                              <td className="meta">{index + 1}</td>
                              <td>{product.name}<small className="meta" style={{ display: "block" }}>per {product.unit || "unit"}</small></td>
                              <td className="num">{product.quantity}</td>
                              <td className="num">{peso(product.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="empty">No paid sales in this range.</p>}
                </section>

                <section className="panel">
                  <div className="panel-h"><h2>Orders by status</h2><span className="meta">{summary.totals.orders} total</span></div>
                  {statusRows.length ? (
                    <div className="restock">
                      {statusRows.map(([status, count]) => (
                        <div className="restock-row" key={status}>
                          <span><span className={`tag ${status === "cancelled" ? "out" : status === "pending" ? "warn" : "ink"}`}>{STATUS_LABELS[status] || status}</span></span>
                          <span className="money">{count}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="empty">No orders in this range.</p>}

                  <div className="panel-h" style={{ marginTop: 24 }}><h2>Payment mix</h2></div>
                  {paymentRows.length ? (
                    <div className="restock">
                      {paymentRows.map((row) => (
                        <div className="restock-row" key={row.method}>
                          <span>{PAYMENT_LABELS[row.method] || row.method}<small>{row.count} paid orders</small></span>
                          <span className="money">{peso(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="empty">No paid payments in this range.</p>}
                </section>
              </div>

              <section className="panel">
                <div className="panel-h">
                  <h2>Orders in this range</h2>
                  <div className="btn-row">
                    <button type="button" className="btn s" disabled={exporting === "orders"} onClick={() => download("orders")}>{exporting === "orders" ? "Preparing..." : "Export orders CSV"}</button>
                    <button type="button" className="btn s" disabled={exporting === "sales"} onClick={() => download("sales")}>{exporting === "sales" ? "Preparing..." : "Export sales CSV"}</button>
                    <button type="button" className="btn s" disabled={exporting === "top-products"} onClick={() => download("top-products")}>{exporting === "top-products" ? "Preparing..." : "Export top products"}</button>
                  </div>
                </div>
                {sales?.orders?.length ? (
                  <div className="tw">
                    <table className="tbl">
                      <thead><tr><th>Order</th><th>Customer</th><th>Fulfillment</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr></thead>
                      <tbody>
                        {sales.orders.map((order) => (
                          <tr key={order.id}>
                            <td><b>{order.reference}</b><small className="meta" style={{ display: "block" }}>{dateTime(order.createdAt)}</small></td>
                            <td>{order.customer?.fullName || "Customer"}</td>
                            <td>{order.fulfillmentLabel || order.fulfillmentType}{order.municipality ? ` · ${order.municipality}` : ""}</td>
                            <td><span className={`tag ${order.status === "cancelled" ? "out" : order.status === "pending" ? "warn" : "ink"}`}>{order.statusLabel}</span></td>
                            <td>{PAYMENT_LABELS[order.payment?.method] || order.payment?.method || "—"}</td>
                            <td className="num">{peso(order.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="empty">No orders were placed in this range.</p>}
              </section>

              <section className="panel" style={{ marginTop: 40 }}>
                <div className="panel-h">
                  <h2>Inventory value</h2>
                  <div className="btn-row">
                    <span className="meta">{inventory?.totals.products || 0} active products · {inventory?.totals.units || 0} units on hand</span>
                    <button type="button" className="btn s" disabled={exporting === "inventory"} onClick={() => download("inventory")}>{exporting === "inventory" ? "Preparing..." : "Export inventory CSV"}</button>
                  </div>
                </div>
                {inventory?.rows?.length ? (
                  <div className="tw">
                    <table className="tbl">
                      <thead><tr><th>Product</th><th>Category</th><th className="num">On hand</th><th className="num">Price</th><th className="num">Value</th><th>Status</th></tr></thead>
                      <tbody>
                        {inventory.rows.map((row) => (
                          <tr key={row.id} data-low={row.low}>
                            <td><b>{row.name}</b><small className="meta" style={{ display: "block" }}>{row.brand || "—"}</small></td>
                            <td>{row.category?.name || "—"}</td>
                            <td className="num">{row.stockQty}<small className="meta" style={{ display: "block" }}>reorder {row.reorderLevel}</small></td>
                            <td className="num">{peso(row.price)}</td>
                            <td className="num">{peso(row.value)}</td>
                            <td><span className={`tag ${row.stock?.label === "Out of stock" ? "out" : row.low ? "low" : "ok"}`}>{row.stock?.label || (row.low ? "Low" : "In stock")}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="empty">No active products.</p>}
              </section>

              <p style={{ marginTop: 32 }}><Link href="/admin/settings" className="link-quiet">Delivery fees and store settings</Link></p>
            </>
          ) : null}
        </div>
      </div>
    </RoleGate>
  );
}
