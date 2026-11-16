"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Stars from "./Stars";
import { useAuth, useToast } from "./Providers";
import { reviewsApi } from "@/lib/api";
import { shortDate } from "@/lib/format";

const EMPTY_SUMMARY = { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

export default function ProductReviews({ productId, initialReviews = [], initialSummary }) {
  const { user, ready } = useAuth();
  const { push } = useToast();
  const [reviews, setReviews] = useState(initialReviews);
  const [summary, setSummary] = useState(initialSummary || EMPTY_SUMMARY);
  const [eligibility, setEligibility] = useState(null);
  const [checking, setChecking] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setEligibility({ canReview: false, review: null });
      return;
    }
    let active = true;
    setChecking(true);
    reviewsApi.eligibility(productId)
      .then((payload) => {
        if (active) setEligibility(payload.data);
      })
      .catch(() => {
        if (active) setEligibility({ canReview: false, review: null });
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [ready, user, productId]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!rating) {
      setError("Choose a star rating first.");
      return;
    }
    setBusy(true);
    try {
      const payload = await reviewsApi.create({ productId, rating, comment });
      setReviews(payload.data.reviews || []);
      setSummary(payload.data.summary || EMPTY_SUMMARY);
      setEligibility({
        canReview: false,
        review: payload.data.review,
        orderReference: payload.data.orderReference,
      });
      setRating(0);
      setHovered(0);
      setComment("");
      push("Review posted. Thanks for the feedback.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const average = Number(summary.average) || 0;
  const count = Number(summary.count) || 0;
  const active = hovered || rating;
  const checkingOrders = !ready || checking || (user && !eligibility);

  return (
    <section className="reviews-sec" id="reviews">
      <div className="sec-h">
        <h2>Reviews</h2>
        <span className="meta">Verified purchases only</span>
      </div>

      <div className="review-wrap">
        <aside className="review-sum">
          <p className="review-avg">{average.toFixed(1)}</p>
          <Stars value={average} label={`${average.toFixed(1)} out of 5 from ${count} reviews`} />
          <p className="meta" style={{ margin: "8px 0 20px" }}>
            {count === 1 ? "1 review" : `${count} reviews`} from delivered orders
          </p>
          <ul className="review-dist">
            {[5, 4, 3, 2, 1].map((stars) => {
              const amount = Number(summary.distribution?.[stars]) || 0;
              const percent = count ? Math.round((amount / count) * 100) : 0;
              return (
                <li key={stars}>
                  <span>{stars} ★</span>
                  <i><b style={{ width: `${percent}%` }} /></i>
                  <span>{amount}</span>
                </li>
              );
            })}
          </ul>
        </aside>

        <div>
          {reviews.length ? (
            <div className="review-list">
              {reviews.map((review) => (
                <article className="review" key={review.id}>
                  <header>
                    <Stars value={review.rating} />
                    <b>{review.author}</b>
                    <span className="tag ok">Verified purchase</span>
                    <span className="meta">{shortDate(review.createdAt)}</span>
                  </header>
                  {review.comment ? <p>{review.comment}</p> : <p className="meta">Rated without a written note.</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className="review-empty">
              No reviews yet. The first one can be written once an order with this item has been delivered.
            </p>
          )}

          <div className="review-write">
            {checkingOrders ? (
              <p className="meta" style={{ margin: 0 }}>Checking your delivered orders…</p>
            ) : !user ? (
              <p className="meta" style={{ margin: 0 }}>
                Bought this before? <Link href="/login">Sign in</Link> to review it after delivery.
              </p>
            ) : eligibility?.review ? (
              <div className="notice ok">
                <b>You reviewed this product.</b> You rated it {eligibility.review.rating} out of 5
                {eligibility.orderReference ? ` after order ${eligibility.orderReference}` : ""}.
                Thanks for the feedback.
              </div>
            ) : eligibility?.canReview ? (
              <form className="form" onSubmit={submit} noValidate>
                <div>
                  <p className="review-form-h">Review this product</p>
                  <p className="meta" style={{ margin: "4px 0 0" }}>
                    {eligibility.orderReference
                      ? `Delivered with order ${eligibility.orderReference}.`
                      : "Delivered order confirmed."}
                  </p>
                </div>
                <div className="starpick" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={step <= active ? "on" : ""}
                      role="radio"
                      aria-checked={rating === step}
                      aria-label={`${step} ${step === 1 ? "star" : "stars"}`}
                      onClick={() => setRating(step)}
                      onMouseEnter={() => setHovered(step)}
                      onMouseLeave={() => setHovered(0)}
                    >
                      ★
                    </button>
                  ))}
                  <span className="meta">{rating ? `${rating} of 5` : "Tap to rate"}</span>
                </div>
                <div className="frow">
                  <label htmlFor="review-comment">Your review <span className="meta">(optional)</span></label>
                  <textarea
                    id="review-comment"
                    className="fld"
                    maxLength={1200}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="How did the item work out on the farm?"
                  />
                </div>
                {error ? <p className="err" role="alert">{error}</p> : null}
                <div className="btn-row">
                  <button type="submit" className="btn p" disabled={busy}>
                    {busy ? "Posting…" : "Post review"}
                  </button>
                  <span className="meta">Shown publicly with your first name and last initial.</span>
                </div>
              </form>
            ) : (
              <p className="meta" style={{ margin: 0 }}>
                Reviews open after an order containing this item is marked delivered.{" "}
                <Link href="/account/orders">Check your orders</Link>.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
