"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useAuth, useToast } from "./Providers";
import { peso } from "@/lib/format";

export default function AddToCart({ item }) {
  const { add } = useCart();
  const { push } = useToast();
  const { user } = useAuth();
  const [qty, setQty] = useState(1);
  const out = Number(item.stockQty) <= 0;
  const max = Math.max(1, Number(item.stockQty || 1));

  if (!user) {
    return (
      <div className="atc">
        <Link href="/login" className="btn p">Sign in to order</Link>
        <p className="mut">Sign in with a customer account to add this supply to your cart.</p>
      </div>
    );
  }
  if (user.roleName !== "customer") {
    return <p className="mut">Ordering is available to customer accounts.</p>;
  }

  return (
    <div className="atc">
      <div className="qty">
        <label htmlFor="qty">Quantity</label>
        <div>
          <button type="button" className="btn s" aria-label="Decrease quantity" disabled={out || qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
          <output id="qty" aria-live="polite">{qty}</output>
          <button type="button" className="btn s" aria-label="Increase quantity" disabled={out || qty >= max} onClick={() => setQty(qty + 1)}>+</button>
        </div>
        <span className="mut">Total {peso(Number(item.price) * qty)}</span>
      </div>
      <button
        type="button"
        className="btn p"
        disabled={out}
        onClick={() => {
          add(item, qty);
          push(`${qty} × ${item.name} added to cart.`);
        }}
      >
        {out ? "Unavailable" : "Add to cart"}
      </button>
      <p className="mut">
        {out ? "This item is out of stock." : `${Number(item.stockQty)} ${item.unit} on hand. `}
        <Link href="/cart"><u>Open cart</u></Link>
      </p>
    </div>
  );
}
