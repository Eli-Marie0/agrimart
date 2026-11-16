import Link from "next/link";
import Photo from "@/components/Photo";
import { tintFor } from "@/lib/tints";
import ProductCard from "@/components/ProductCard";
import { api } from "@/lib/api";
import { dayParts, peso, stockMeter } from "@/lib/format";


export const metadata = {
  title: "AgriMart — Check the shelf before you make the trip",
};

function Meter({ product }) {
  const { segs, cls } = stockMeter(product);
  return (
    <span className="mt" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <span key={index} className={index < segs ? `on ${cls}` : ""} />
      ))}
    </span>
  );
}

export default async function HomePage() {
  let data = null;
  try {
    data = (await api("/store/home")).data;
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="wrap pad">
        <div className="empty">
          <h2>The store is not reachable right now.</h2>
          <p>Start the Strapi API on port 1337, then reload this page.</p>
        </div>
      </div>
    );
  }

  const { home, categories, shelf, featured, bestSellers, recent, announcements, contact, settings } = data;
  const featuredCards = (featured.length ? featured : shelf).slice(0, 4);
  const best = bestSellers.slice(0, 5);
  const maxSold = Math.max(1, ...best.map((product) => product.soldCount || 0));
  const visitLat = Number(contact?.latitude);
  const visitLng = Number(contact?.longitude);
  const hasVisitPoint = Number.isFinite(visitLat) && Number.isFinite(visitLng) && visitLat !== 0 && visitLng !== 0;
  const visitUrl = `https://www.google.com/maps?q=${encodeURIComponent(hasVisitPoint ? `${visitLat},${visitLng}` : "Poblacion, Victoria, Oriental Mindoro")}&z=14&output=embed`;

  return (
    <>
      <section className="wrap hero">
        <div className="hero-in">
          <div className="hero-t">
            <p className="kicker">{home.kicker || "Agricultural supply store"}</p>
            <h1>{home.heroTitle}</h1>
            <p>{home.heroText}</p>
            <div className="hero-actions">
              <Link href="/products" className="btn p">Shop supplies</Link>
              <Link href="/contact" className="btn">Find the store</Link>
            </div>
            <p className="hero-note">
              <span><b>{shelf.length ? shelf.reduce((sum, product) => sum + product.stockQty, 0) : 0}</b> units on the shelf</span>
              <span><b>{categories.length}</b> categories</span>
              <span><b>{settings.freeDeliveryThreshold ? peso(settings.freeDeliveryThreshold) : "—"}</b> free delivery over</span>
            </p>
          </div>
          <Photo
            src={home.heroImageUrl || "/agrimart-home-hero.webp"}
            alt="Farmer carrying a basket of greens through a field at sunrise"
            tint="var(--zone)"
            label="Farm at sunrise"
            ratio="11 / 5"
            className="hero-photo"
            priority
          />
        </div>
      </section>

      <section className="wrap sec">
        <div className="shelf-h">
          <h2 className="h2" style={{ margin: 0 }}>Today&apos;s shelf</h2>
          <Link href="/products" className="link-quiet">See all products</Link>
        </div>
        <p className="mut" style={{ marginTop: 0 }}>
          Live counts from the counter. Updated {new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}.
        </p>
        <div className="shelf">
          {shelf.map((product) => (
            <div className="shelf-row" key={product.id}>
              <div className="nm">
                <Link href={`/products/${product.slug}`}>{product.name}</Link>
                <small>{product.brand || product.category?.name}</small>
              </div>
              <Meter product={product} />
              <span className="num">{product.stockQty} <span className="unit">{product.unit}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec zone">
        <div className="wrap">
          <div className="sec-h">
            <h2>Shop by category</h2>
            <Link href="/products" className="link-quiet">Browse the catalog</Link>
          </div>
          <div className="cat-grid">
            {categories.map((category) => (
              <Link key={category.id} href={`/products?category=${category.slug}`}>
                <strong>{category.name}</strong>
                <span>{category.productCount} product{category.productCount === 1 ? "" : "s"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap sec">
        <div className="sec-h">
          <h2>Store favourites</h2>
          <Link href="/products?featured=true" className="link-quiet">All featured</Link>
        </div>
        <div className="grid">
          {featuredCards.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      <section className="wrap sec">
        <div className="two">
          <div>
            <div className="sec-h">
              <h2>Best sellers</h2>
            </div>
            <ul className="rows">
              {best.map((product, index) => (
                <li className="rk" key={product.id}>
                  <span className="n">{String(index + 1).padStart(2, "0")}</span>
                  <Photo src={product.imageUrl} alt={product.name} tint={tintFor(product.category)} label="" ratio="1 / 1" />
                  <span className="nm">
                    <Link href={`/products/${product.slug}`}>{product.name}</Link>
                    <small>{product.brand || product.category?.name}</small>
                  </span>
                  <span className="sold">
                    {product.soldCount} sold
                    <span className="mt" style={{ marginTop: 4 }}>
                      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < Math.ceil((product.soldCount / maxSold) * 5) ? "on" : ""} />)}
                    </span>
                  </span>
                  <span className="price">{peso(product.price)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="sec-h">
              <h2>Recently added</h2>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {recent.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="promo">
            <div>
              <p className="eyebrow">AgriMart Plus</p>
              <h2>{home.promoTitle}</h2>
              <p>{home.promoText}</p>
            </div>
            <div className="btn-row">
              <Link href="/products" className="btn">Shop the catalog</Link>
              <Link href="/contact" className="btn">Ask about bulk pricing</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap sec">
        <div className="sec-h"><h2>How to order</h2></div>
        <ol className="steps">
          <li>
            <b>01</b>
            <h3>Check the shelf</h3>
            <p>Search by name, category or brand. Stock and price are shown before you commit.</p>
          </li>
          <li>
            <b>02</b>
            <h3>Pick delivery or pickup</h3>
            <p>Delivery fees are flat per municipality. Store pickup is always free.</p>
          </li>
          <li>
            <b>03</b>
            <h3>Pay and track</h3>
            <p>Pay online with a card or PayPal, or choose cash on delivery. Follow every step in My orders.</p>
          </li>
        </ol>
      </section>

      <section className="sec zone">
        <div className="wrap">
          <div className="sec-h">
            <h2>Advisories</h2>
            <Link href="/announcements" className="link-quiet">Read all announcements</Link>
          </div>
          <div className="adv-list">
            {announcements.length ? announcements.map((item) => {
              const parts = dayParts(item.publishedAt || item.createdAt);
              return (
                <article className="adv" key={item.id}>
                  <div className="date"><b>{parts.day}</b><span>{parts.month}</span></div>
                  <div>
                    <h3>
                      {item.title}
                      {item.isPinned ? <span className="pin">Pinned</span> : null}
                    </h3>
                    <p>{item.excerpt}</p>
                  </div>
                </article>
              );
            }) : <p className="empty">No advisories yet. Check back at the start of the planting season.</p>}
          </div>
        </div>
      </section>

      <section className="wrap sec">
        <div className="visit">
          <div>
            <h2 className="h2">Visit the store</h2>
            <p className="mut" style={{ marginTop: 0 }}>{contact.address}</p>
            <div className="hours">
              {(contact.hours || "").split("\n").filter(Boolean).map((line) => (
                <div key={line}><span>{line}</span></div>
              ))}
            </div>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <Link href="/contact" className="btn">Get directions and message us</Link>
            </div>
          </div>
          <div className="map">
            <iframe
              title="Map of the AgriMart store"
              src={visitUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>
    </>
  );
}
