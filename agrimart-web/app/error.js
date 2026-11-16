"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }) {
  return (
    <div className="wrap">
      <div className="sys">
        <p className="eyebrow">Something went wrong</p>
        <h1>We dropped a sack.</h1>
        <p>An unexpected error stopped this page. Try again, or head back to the store and keep browsing.</p>
        {error?.digest ? <p className="meta">Reference: {error.digest}</p> : null}
        <div className="btn-row">
          <button type="button" className="btn p" onClick={() => reset()}>Try again</button>
          <Link href="/" className="btn">Back to the store</Link>
        </div>
      </div>
    </div>
  );
}
