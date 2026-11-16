"use client";

import Link from "next/link";
import Photo from "./Photo";
import { useCart } from "@/lib/cart";
import { useToast } from "./Providers";
import { peso } from "@/lib/format";

export default function CartView() {
  const { items, subtotal, setQty, remove, clear } = useCart();
  const { push } = useToast();
  const hasUnavailable = items.some((item) => Number(item.stockQty) < Number(item.qty));

  if (!items.length) {
    return (
      <div className="empty">
        <h2>Your cart is empty.</h2>
        <p>Browse the shelf and add the supplies you need. Stock is checked again at checkout.</p>
        <Link href="/products" className="btn p" style={{ marginTop: 16 }}>Browse supplies</Link>
      </div>
    );
  }

  return (
    <div className="cart">
      <div>
        <div className="toolbar">
          <p className="meta" style={{ margin: 0 }}>{items.length} line{items.length === 1 ? "" : "s"} in the cart</p>
          <button type="button" className="lnk" onClick={() => { clear(); push("Cart cleared."); }}>Clear cart</button>
        </div>
        {items.map((item) => (
          <div className="cart-line" key={item.id}>
            <Photo src={item.imageUrl} alt={item.name} label="" ratio="1 / 1" />
            <div>
              <h3><Link href={`/products/${item.slug}`}>{item.name}</Link></h3>
              <p className="meta" style={{ margin: 0 }}>{item.brand || "AgriMart"} · {peso(item.price)} per {item.unit}</p>
              <div className="cart-actions">
                <div className="qty">
                  <button type="button" className="btn s" aria-label={`Decrease ${item.name}`} disabled={item.qty <= 1} onClick={() => setQty(item.id, item.qty - 1)}>−</button>
                  <output aria-live="polite" style={{ minWidth: 44, textAlign: "center" }}>{item.qty}</output>
                  <button type="button" className="btn s" aria-label={`Increase ${item.name}`} disabled={item.qty >= item.stockQty} onClick={() => setQty(item.id, item.qty + 1)}>+</button>
                </div>
                <button type="button" className="lnk" onClick={() => { remove(item.id); push(`${item.name} removed from cart.`); }}>Remove</button>
                {item.stockQty <= item.reorderLevel ? <span className="tag low">Low stock: {item.stockQty} left</span> : null}
                {Number(item.stockQty) < Number(item.qty) ? <span className="tag out">Only {item.stockQty} left. Adjust or remove this item.</span> : null}
              </div>
            </div>
            <span className="price nowrap">{peso(item.qty * item.price)}</span>
          </div>
        ))}
      </div>

      <aside className="rcpt" aria-label="Order summary">
        <h2>Summary</h2>
        <div className="rl"><span>Subtotal</span><span className="money">{peso(subtotal)}</span></div>
        <div className="rl mut"><span>Delivery fee</span><span>Chosen at checkout</span></div>
        <div className="rl mut"><span>Payment</span><span>COD or online</span></div>
        <div className="rl tot"><span>Total before delivery</span><span className="price">{peso(subtotal)}</span></div>
        {hasUnavailable ? <p className="err" role="alert">Update or remove unavailable items before checkout.</p> : null}
        {hasUnavailable
          ? <button type="button" className="btn p" disabled>Continue to checkout</button>
          : <Link href="/checkout" className="btn p">Continue to checkout</Link>}
        <Link href="/products" className="link-quiet" style={{ textAlign: "center" }}>Keep shopping</Link>
        <p className="form-note" style={{ margin: 0 }}>Delivery is flat per municipality. Store pickup is free.</p>
      </aside>
    </div>
  );
}
