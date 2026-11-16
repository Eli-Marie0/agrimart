"use client";

import { useEffect } from "react";
import Link from "next/link";
import { setStoredUser, setToken } from "@/lib/api";

export default function SessionExpiredPage() {
  useEffect(() => {
    setToken(null);
    setStoredUser(null);
  }, []);

  return (
    <div className="wrap">
      <div className="sys">
        <p className="eyebrow">Session expired</p>
        <h1>Please sign in again.</h1>
        <p>Your session timed out to keep your account safe. Sign in and we will take you back to where you were.</p>
        <div className="btn-row">
          <Link href="/login" className="btn p">Sign in</Link>
          <Link href="/products" className="btn">Browse products</Link>
        </div>
      </div>
    </div>
  );
}
