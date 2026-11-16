import Link from "next/link";
import Photo from "./Photo";
import Stars from "./Stars";
import { tintFor } from "@/lib/tints";
import CardAdd from "./CardAdd";
import { peso } from "@/lib/format";

export default function ProductCard({ product }) {
  const stock = product.stock || { key: "ok", label: "In stock" };
  return (
    <article className="pc">
      <Link href={`/products/${product.slug}`} aria-hidden="true" tabIndex={-1}>
        <Photo
          src={product.imageUrl}
          alt={product.name}
          tint={tintFor(product.category)}
          label={product.category?.name || "Product photo"}
        />
      </Link>
      <p className="brand">{product.brand || "AgriMart"}</p>
      <h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3>
      {product.ratingCount > 0 ? (
        <p className="rating-line">
          <Stars
            value={product.ratingAvg}
            label={`${Number(product.ratingAvg).toFixed(1)} out of 5 from ${product.ratingCount} reviews`}
          />
          <span>{Number(product.ratingAvg).toFixed(1)} ({product.ratingCount})</span>
        </p>
      ) : null}
      <p className={`stk ${stock.key === "ok" ? "ok" : stock.key}`}>{stock.key === "ok" ? "✓" : stock.key === "low" ? "!" : "✕"} {stock.label}</p>
      <p className="price">{peso(product.price)} <span className="unit">/ {product.unit}</span></p>
      <CardAdd product={product} />
    </article>
  );
}
