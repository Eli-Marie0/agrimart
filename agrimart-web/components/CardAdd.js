"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useAuth, useToast } from "./Providers";

export default function CardAdd({ product }) {
  const { add } = useCart();
  const { user } = useAuth();
  const { push } = useToast();
  const out = Number(product.stockQty) <= 0;

  if (!user) {
    return <Link href="/login" className="btn s">Sign in to order</Link>;
  }
  if (user.roleName !== "customer") {
    return <button type="button" className="btn s" disabled>Customer account required</button>;
  }

  if (out) {
    return (
      <button type="button" className="btn s" disabled aria-disabled="true">
        Unavailable
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn s"
      onClick={() => {
        add(product, 1);
        push(`${product.name} added to cart.`);
      }}
    >
      Add to cart
    </button>
  );
}
