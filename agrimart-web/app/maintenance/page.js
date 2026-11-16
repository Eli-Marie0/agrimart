import Link from "next/link";

export const metadata = { title: "Down for maintenance" };

export default function MaintenancePage() {
  return (
    <div className="wrap">
      <div className="sys">
        <p className="eyebrow">Maintenance</p>
        <h1>We are restocking.</h1>
        <p>The store is briefly closed while we update stock and prices. Please check back in a little while, or contact us if you need something urgently.</p>
        <div className="btn-row">
          <Link href="/contact" className="btn p">Contact the store</Link>
          <Link href="/" className="btn">Try the storefront</Link>
        </div>
      </div>
    </div>
  );
}
