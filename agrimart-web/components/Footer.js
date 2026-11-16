import Link from "next/link";

const YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-in">
        <div>
          <p className="logo">AgriMart</p>
          <p>Seeds, feed, fertilizer and tools from Victoria, Oriental Mindoro.</p>
          <p className="ftr-note">Prices and stock are updated by the store team every day.</p>
        </div>
        <div>
          <p className="ft-h">Shop</p>
          <p><Link href="/products">All products</Link></p>
          <p><Link href="/announcements">Announcements</Link></p>
          <p><Link href="/about">About the store</Link></p>
        </div>
        <div>
          <p className="ft-h">Store</p>
          <p>Poblacion, Victoria</p>
          <p>Oriental Mindoro</p>
          <p>Mon–Sat 7:00 am – 6:00 pm</p>
          <p>Sun 7:00 am – 12:00 pm</p>
        </div>
        <div>
          <p className="ft-h">Account</p>
          <p><Link href="/account/orders">My orders</Link></p>
          <p><Link href="/account">Profile and addresses</Link></p>
          <p><Link href="/contact">Contact the store</Link></p>
          <p><Link href="/login">Sign in</Link></p>
        </div>
      </div>
      <div className="wrap ftr-base">
        <p>© {YEAR} AgriMart. Victoria, Oriental Mindoro.</p>
        <p>Cash on delivery or secure online payment.</p>
      </div>
    </footer>
  );
}
