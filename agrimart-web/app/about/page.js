import Link from "next/link";
import Photo from "@/components/Photo";
import { api } from "@/lib/api";

export const metadata = { title: "About" };

export default async function AboutPage() {
  let content = null;
  try {
    content = (await api("/store/content")).data;
  } catch {}

  const about = content?.about || { title: "About AgriMart", body: "" };
  const contact = content?.contact || {};

  return (
    <div className="wrap pad">
      <header className="page-h">
        <p className="eyebrow">The store</p>
        <h1>{about.title}</h1>
      </header>
      <div className="split">
        <div>
          <p className="about-body">{about.body}</p>
          <div className="btn-row" style={{ marginTop: 28 }}>
            <Link href="/products" className="btn p">Shop supplies</Link>
            <Link href="/contact" className="btn">Visit the store</Link>
          </div>
        </div>
        <Photo src={about.imageUrl} alt="The AgriMart team and store" tint="var(--zone)" label="Store photo" ratio="4 / 3" />
      </div>

      <hr className="hair" />
      <div className="two">
        <div>
          <h2 className="h2">Store hours</h2>
          <div className="hours">
            {(contact.hours || "").split("\n").filter(Boolean).map((line) => <div key={line}><span>{line}</span></div>)}
          </div>
        </div>
        <div>
          <h2 className="h2">Where we are</h2>
          <p className="meta">{contact.address || "Poblacion, Victoria, Oriental Mindoro"}</p>
          <p className="meta">Delivery across Oriental Mindoro, with flat fees per municipality at checkout. Pickup at the counter is free.</p>
          <Link href="/contact" className="link-quiet">Open the map and contact form</Link>
        </div>
      </div>
    </div>
  );
}
