"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="wrap">
      <div className="sys">
        <p className="eyebrow">Offline</p>
        <h1>The store is offline.</h1>
        <p>We cannot reach the server right now. Check your connection, then try again. Items already in your cart stay on this device.</p>
        <div className="btn-row">
          <button type="button" className="btn p" onClick={() => window.location.reload()}>Try again</button>
          <Link href="/" className="btn">Home</Link>
        </div>
      </div>
    </div>
  );
}
