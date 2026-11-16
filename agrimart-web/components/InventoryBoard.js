"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "./Providers";
import { opsApi } from "@/lib/api";
import { REASONS, dateTime, peso } from "@/lib/format";

export default function InventoryBoard({ title = "Inventory and stock log" }) {
  const { push } = useToast();
  const [data, setData] = useState({ products: [], lowStock: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [quick, setQuick] = useState({});
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({ productId: "", changeQty: "10", reason: "stock_in", note: "" });

  const load = useCallback(() => {
    setLoading(true);
    opsApi.inventory({ limit: 50 })
      .then((payload) => { setData(payload.data); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const products = useMemo(() => {
    const list = data.products || [];
    const q = query.trim().toLowerCase();
    return list.filter((product) => {
      if (lowOnly && product.stockQty > product.reorderLevel) return false;
      if (!q) return true;
      return [product.name, product.brand, product.category?.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    });
  }, [data.products, query, lowOnly]);

  async function recordStockIn(product) {
    const amount = Number(quick[product.id] ?? 20);
    if (!Number.isFinite(amount) || amount === 0) {
      setError("Enter a quantity other than zero.");
      return;
    }
    setBusy(`quick-${product.id}`);
    try {
      await opsApi.stockIn({ productId: product.id, changeQty: amount, reason: "stock_in" });
      push(`${amount} ${product.unit} added to ${product.name}.`);
      setQuick((current) => ({ ...current, [product.id]: "" }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function submitChange(event) {
    event.preventDefault();
    setError("");
    const amount = Number(form.changeQty);
    if (!form.productId) return setError("Choose a product.");
    if (!Number.isFinite(amount) || amount === 0) return setError("Enter a quantity other than zero.");
    const signed = form.reason === "spoilage" ? -Math.abs(amount) : amount;
    setBusy("form");
    try {
      if (form.reason === "stock_in") {
        await opsApi.stockIn({ productId: Number(form.productId), changeQty: Math.abs(amount), reason: "stock_in", note: form.note });
      } else {
        await opsApi.adjust({ productId: Number(form.productId), changeQty: signed, reason: form.reason, note: form.note });
      }
      push(form.reason === "stock_in" ? "Stock in recorded." : "Adjustment recorded.");
      setForm({ productId: "", changeQty: "10", reason: "stock_in", note: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const lowCount = data.lowStock?.length || 0;
  const outCount = (data.products || []).filter((product) => product.stockQty <= 0).length;

  return (
    <div>
      <div className="dstats">
        <div className="dstat"><span>Products tracked</span><b>{data.products?.length || 0}</b></div>
        <div className="dstat"><span>Low stock</span><b>{lowCount}</b><small>at or below reorder level</small></div>
        <div className="dstat"><span>Out of stock</span><b>{outCount}</b></div>
        <div className="dstat"><span>Log entries</span><b>{data.logs?.length || 0}</b><small>most recent</small></div>
      </div>

      {error ? <p className="err" role="alert">{error}</p> : null}

      <section className="panel" style={{ marginBottom: 40 }}>
        <div className="panel-h">
          <h2>{title}</h2>
          <div className="group" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <label htmlFor="inv-search" className="sr">Search products</label>
            <input id="inv-search" className="fld" type="search" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 200 }} />
            <button type="button" className={`chip ${lowOnly ? "on" : ""}`} aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}>Low stock only</button>
            <button type="button" className="btn s" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>
        </div>

        <div className="tw">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="num">On hand</th>
                <th className="num">Reorder</th>
                <th>Status</th>
                <th>Stock in</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const low = product.stockQty <= product.reorderLevel;
                return (
                  <tr key={product.id} data-low={low}>
                    <td>
                      <b>{product.name}</b>
                      <small className="meta" style={{ display: "block" }}>{product.brand || "—"} · {peso(product.price)} / {product.unit}</small>
                    </td>
                    <td>{product.category?.name || "—"}</td>
                    <td className="num">{product.stockQty} {product.unit}</td>
                    <td className="num">{product.reorderLevel}</td>
                    <td><span className={`tag ${product.stockQty <= 0 ? "out" : low ? "low" : "ok"}`}>{product.stock?.label || (product.stockQty <= 0 ? "Out of stock" : low ? "Low" : "In stock")}</span></td>
                    <td>
                      <div className="inline" style={{ display: "flex", gap: 6 }}>
                        <label className="sr" htmlFor={`qty-${product.id}`}>Quantity to add for {product.name}</label>
                        <input
                          id={`qty-${product.id}`}
                          className="fld"
                          type="number"
                          min="1"
                          placeholder="20"
                          value={quick[product.id] ?? ""}
                          onChange={(event) => setQuick((current) => ({ ...current, [product.id]: event.target.value }))}
                          style={{ width: 72 }}
                        />
                        <button type="button" className="btn s" disabled={busy === `quick-${product.id}`} onClick={() => recordStockIn(product)}>
                          {busy === `quick-${product.id}` ? "Saving" : "Add"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products.length && !loading ? <p className="empty">No products match that search.</p> : null}
      </section>

      <div className="dgrid">
        <section className="panel">
          <div className="panel-h"><h2>Record a stock change</h2></div>
          <form className="form" onSubmit={submitChange} noValidate>
            <div className="frow">
              <label htmlFor="stock-product">Product</label>
              <select id="stock-product" className="fld" value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
                <option value="">Choose a product</option>
                {(data.products || []).map((product) => (
                  <option key={product.id} value={product.id}>{product.name} — {product.stockQty} {product.unit} on hand</option>
                ))}
              </select>
            </div>
            <div className="f2">
              <div className="frow">
                <label htmlFor="stock-reason">Reason</label>
                <select id="stock-reason" className="fld" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>
                  <option value="stock_in">Stock in</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="spoilage">Spoilage</option>
                </select>
              </div>
              <div className="frow">
                <label htmlFor="stock-qty">Quantity</label>
                <input id="stock-qty" className="fld" type="number" value={form.changeQty} onChange={(event) => setForm({ ...form, changeQty: event.target.value })} required />
                <p className="form-note">Spoilage is subtracted automatically. Use a negative number for a downward adjustment.</p>
              </div>
            </div>
            <div className="frow">
              <label htmlFor="stock-note">Note (optional)</label>
              <input id="stock-note" className="fld" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Delivery reference, reason, damage details" />
            </div>
            <div><button type="submit" className="btn p" disabled={busy === "form"}>{busy === "form" ? "Recording..." : "Record change"}</button></div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-h"><h2>Needs restocking</h2><span className="meta">{lowCount} item{lowCount === 1 ? "" : "s"}</span></div>
          {data.lowStock?.length ? (
            <div className="restock">
              {data.lowStock.map((product) => (
                <div className="restock-row" key={product.id}>
                  <span>
                    {product.name}
                    <small>{product.stockQty} {product.unit} on hand · reorder at {product.reorderLevel}</small>
                  </span>
                  <span className="inline">
                    <label className="sr" htmlFor={`re-${product.id}`}>Quantity</label>
                    <input
                      id={`re-${product.id}`}
                      className="fld"
                      type="number"
                      min="1"
                      value={quick[product.id] ?? 20}
                      onChange={(event) => setQuick((current) => ({ ...current, [product.id]: event.target.value }))}
                    />
                    <button type="button" className="btn" disabled={busy === `quick-${product.id}`} onClick={() => recordStockIn(product)}>Stock in</button>
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="empty">Nothing is at its reorder level.</p>}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 40 }}>
        <div className="panel-h"><h2>Inventory log</h2><span className="meta">Every stock change keeps the person who made it</span></div>
        {data.logs?.length ? (
          <div className="tw">
            <table className="tbl">
              <thead>
                <tr><th>When</th><th>Product</th><th>Reason</th><th className="num">Change</th><th>By</th></tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="nowrap">{dateTime(log.createdAt)}</td>
                    <td>{log.product?.name || "Product removed"}</td>
                    <td><span className="tag">{REASONS[log.reason] || log.reason}</span></td>
                    <td className="num">{log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty}</td>
                    <td>{log.user?.fullName || "System"}{log.user?.roleName ? <small className="meta" style={{ display: "block" }}>{log.user.roleName}</small> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">No stock changes recorded yet.</p>}
      </section>
    </div>
  );
}
