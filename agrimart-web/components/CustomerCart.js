"use client";

import Link from "next/link";
import { useAuth } from "@/components/Providers";
import CartView from "@/components/CartView";

export default function CustomerCart() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <div className="wrap pad"><p className="load-note">Loading your account...</p></div>;
  }
  if (!user || user.roleName !== "customer") {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h1>Cart is for customers.</h1>
          <p>{user ? "Sign in with a customer account to place an order." : "Sign in to view your cart and place an order."}</p>
          {!user ? <Link href="/login" className="btn p">Sign in</Link> : null}
          <Link href="/products" className="btn">Browse supplies</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap pad">
      <header className="page-h" style={{ paddingTop: 0 }}>
        <p className="eyebrow">Step 1 of 2</p>
        <h1>Your cart</h1>
        <p>Check quantities, then continue to delivery, pickup and payment.</p>
      </header>
      <CartView />
      <p style={{ marginTop: 32 }}><Link href="/products" className="link-quiet">← Back to products</Link></p>
    </div>
  );
}
