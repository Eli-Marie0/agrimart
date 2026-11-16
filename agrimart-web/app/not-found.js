import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="sys">
        <p className="eyebrow">404</p>
        <h1>Nothing here.</h1>
        <p>The page may have moved, or the link may be mistyped. The shelf is still open.</p>
        <div className="btn-row">
          <Link href="/" className="btn p">Back to the store</Link>
          <Link href="/products" className="btn">Browse products</Link>
        </div>
      </div>
    </div>
  );
}
