"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import RoleGate from "./RoleGate";
import Stars from "./Stars";
import { useToast } from "./Providers";
import { adminApi } from "@/lib/api";
import { dateTime } from "@/lib/format";

const FILTERS = [
  { id: "all", label: "All reviews" },
  { id: "visible", label: "Visible" },
  { id: "hidden", label: "Hidden" },
];

export default function AdminReviews() {
  const { push } = useToast();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, average: 0, visible: 0, hidden: 0 });
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = filter === "all" ? {} : { visible: filter === "visible" ? "true" : "false" };
    adminApi.reviews(params)
      .then((payload) => {
        setItems(payload.data || []);
        setMeta(payload.meta || { total: 0, average: 0, visible: 0, hidden: 0 });
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function toggle(item) {
    setBusy(`toggle-${item.id}`);
    try {
      await adminApi.updateReview(item.id, { isVisible: !item.isVisible });
      push(item.isVisible ? "Review hidden from the storefront." : "Review is visible again.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete the review by ${item.author} for “${item.product?.name || "this product"}”? This cannot be undone.`)) return;
    setBusy(`delete-${item.id}`);
    try {
      await adminApi.deleteReview(item.id);
      push("Review deleted.");
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
              <p className="eyebrow">Customers</p>
              <h1>Reviews</h1>
              <p>Every rating comes from a delivered order. Hide a review to remove it from the product page without deleting the record.</p>
            </div>
            <Link href="/products" className="btn">View storefront</Link>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}

          <div className="dstats">
            <div className="dstat"><span>All reviews</span><b>{meta.total}</b></div>
            <div className="dstat"><span>Visible</span><b>{meta.visible}</b></div>
            <div className="dstat"><span>Hidden</span><b>{meta.hidden}</b></div>
            <div className="dstat"><span>Average rating</span><b>{Number(meta.average || 0).toFixed(1)}</b><small>out of 5</small></div>
          </div>

          <div className="toolbar">
            <div className="chips" role="group" aria-label="Filter reviews">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="chip"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="meta">{items.length} shown</span>
          </div>

          {loading ? <p className="load-note">Loading reviews...</p> : null}
          {!loading && !items.length ? (
            <p className="empty">No reviews in this view yet. Reviews appear after a delivered order is rated on its product page.</p>
          ) : null}

          {!loading && items.length ? (
            <div className="tw">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Review</th>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.product ? (
                          <Link href={`/products/${item.product.slug}`}>{item.product.name}</Link>
                        ) : <span className="meta">Deleted product</span>}
                        {item.orderReference ? <small className="meta" style={{ display: "block" }}>{item.orderReference}</small> : null}
                      </td>
                      <td>
                        {item.author}
                        {item.email ? <small className="meta" style={{ display: "block" }}>{item.email}</small> : null}
                      </td>
                      <td>
                        <Stars value={item.rating} />
                        <small className="meta" style={{ display: "block" }}>{item.rating} of 5</small>
                      </td>
                      <td className="review-cell">{item.comment || <span className="meta">No written note</span>}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{dateTime(item.createdAt)}</td>
                      <td><span className={`tag ${item.isVisible ? "ok" : ""}`}>{item.isVisible ? "Visible" : "Hidden"}</span></td>
                      <td>
                        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn s"
                            disabled={busy === `toggle-${item.id}`}
                            onClick={() => toggle(item)}
                          >
                            {item.isVisible ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            className="lnk"
                            disabled={busy === `delete-${item.id}`}
                            onClick={() => remove(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="form-note" style={{ marginTop: 16 }}>
            Hiding keeps the record for reporting but removes it from the product page and the star average.
          </p>
        </div>
      </div>
    </RoleGate>
  );
}
