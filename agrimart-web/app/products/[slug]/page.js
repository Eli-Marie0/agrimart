import Link from "next/link";
import { notFound } from "next/navigation";
import Gallery from "@/components/Gallery";
import AddToCart from "@/components/AddToCart";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import { tintFor } from "@/lib/tints";
import { api } from "@/lib/api";
import { peso, stockMeter } from "@/lib/format";


export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const { data } = await api(`/store/products/${encodeURIComponent(slug)}`);
    return {
      title: data.product.name,
      description: data.product.description?.slice(0, 160) || "Farm supplies from AgriMart in Victoria.",
    };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  let payload = null;
  try {
    payload = (await api(`/store/products/${encodeURIComponent(slug)}`)).data;
  } catch {
    payload = null;
  }
  if (!payload?.product) notFound();

  const { product, related, reviews = [], summary } = payload;
  const stock = product.stock || { key: "ok", label: "In stock" };
  const meter = stockMeter(product);
  const images = [product.imageUrl, ...(product.galleryUrls || [])].filter(Boolean);

  return (
    <div className="wrap pad">
      <p className="crumb">
        <Link href="/">Home</Link> / <Link href="/products">Products</Link>
        {product.category ? <> / <Link href={`/products?category=${product.category.slug}`}>{product.category.name}</Link></> : null}
        {" "}/ {product.name}
      </p>

      <div className="pdp">
        <Gallery
          images={images}
          alt={product.name}
          tint={tintFor(product.category)}
          label={product.category?.name || "Product photo"}
        />

        <div className="info">
          <p className="kicker">{product.brand || product.category?.name || "AgriMart"}</p>
          <h1 className="h2">{product.name}</h1>

          <div className="stkbox">
            <p className={`stk ${stock.key}`}>
              {stock.key === "ok" ? "✓" : stock.key === "low" ? "!" : "✕"} {stock.label}
            </p>
            <span className="mt" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((index) => (
                <span key={index} className={index < meter.segs ? `on ${meter.cls}` : ""} />
              ))}
            </span>
            {product.stockQty > 0 ? (
              <p className="meta" style={{ marginTop: 8 }}>
                {product.stockQty} {product.unit} on hand. Reorder level {product.reorderLevel}.
              </p>
            ) : (
              <p className="meta" style={{ marginTop: 8 }}>Ask the store when the next delivery arrives.</p>
            )}
          </div>

          <p className="price big">
            {peso(product.price)} <span className="unit">/ {product.unit}</span>
          </p>

          <p className="desc">{product.description}</p>

          <AddToCart item={product} />

          <table className="specs">
            <tbody>
              <tr><th scope="row">Brand</th><td>{product.brand || "—"}</td></tr>
              <tr><th scope="row">Category</th><td>{product.category?.name || "—"}</td></tr>
              <tr><th scope="row">Sold as</th><td>per {product.unit}</td></tr>
              <tr><th scope="row">On hand</th><td>{product.stockQty} {product.unit}</td></tr>
              <tr><th scope="row">Reorder level</th><td>{product.reorderLevel} {product.unit}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <ProductReviews
        productId={product.id}
        initialReviews={reviews}
        initialSummary={summary}
      />

      {related.length ? (
        <section className="rel">
          <div className="sec-h">
            <h2>More in {product.category?.name || "the store"}</h2>
            <Link href={`/products?category=${product.category?.slug || ""}`} className="link-quiet">See the category</Link>
          </div>
          <div className="grid rel-grid">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
