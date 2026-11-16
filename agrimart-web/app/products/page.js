import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { api } from "@/lib/api";
import { peso } from "@/lib/format";


export const metadata = { title: "Products" };

const SORTS = [
  ["relevance", "Relevance"],
  ["priceAsc", "Price: low to high"],
  ["priceDesc", "Price: high to low"],
  ["newest", "Newest"],
  ["name", "Name"],
  ["popular", "Best selling"],
];

function one(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildQuery(current, patch) {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "" || value === "false") continue;
    if (key === "page" && String(value) === "1") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `/products${qs ? `?${qs}` : ""}`;
}

export default async function ProductsPage({ searchParams }) {
  const raw = await searchParams;
  const current = {
    q: one(raw.q) || "",
    category: one(raw.category) || "",
    brand: one(raw.brand) || "",
    minPrice: one(raw.minPrice) || "",
    maxPrice: one(raw.maxPrice) || "",
    sort: one(raw.sort) || "relevance",
    inStock: one(raw.inStock) || "",
    featured: one(raw.featured) || "",
    page: one(raw.page) || "1",
  };

  let result = { products: [], meta: { pagination: { total: 0, page: 1, pageCount: 1 } } };
  let categories = [];
  let brands = [];
  try {
    const [list, cats, brandList] = await Promise.all([
      api(`/store/products?${new URLSearchParams({
        q: current.q,
        category: current.category,
        brand: current.brand,
        minPrice: current.minPrice,
        maxPrice: current.maxPrice,
        sort: current.sort,
        inStock: current.inStock,
        featured: current.featured,
        page: current.page,
        pageSize: "24",
      }).toString()}`),
      api("/store/categories"),
      api("/store/brands"),
    ]);
    result = { products: list.data || [], meta: list.meta || {} };
    categories = cats.data || [];
    brands = brandList.data || [];
  } catch {}

  const pagination = result.meta?.pagination || { total: 0, page: 1, pageCount: 1 };
  const activeCategory = categories.find((category) => category.slug === current.category);
  const heading = current.q
    ? `Results for “${current.q}”`
    : activeCategory
      ? activeCategory.name
      : current.featured
        ? "Featured supplies"
        : "All supplies";

  return (
    <div className="wrap pad">
      <header className="page-h">
        <p className="eyebrow">Catalog</p>
        <h1>{heading}</h1>
        <p>
          {pagination.total} product{pagination.total === 1 ? "" : "s"} with live stock from the Victoria counter.
          {activeCategory?.description ? ` ${activeCategory.description}` : ""}
        </p>
      </header>

      <div className="shop">
        <aside className="filters" aria-label="Filters">
          <form method="get" action="/products">
            <h2>Search</h2>
            <div className="frow" style={{ marginBottom: 20 }}>
              <label htmlFor="q">Product name or brand</label>
              <input id="q" className="fld" type="search" name="q" defaultValue={current.q} placeholder="e.g. urea" />
            </div>

            <fieldset>
              <legend>Category</legend>
              <label>
                <input type="radio" name="category" value="" defaultChecked={!current.category} />
                All categories
              </label>
              {categories.map((category) => (
                <label key={category.id}>
                  <input type="radio" name="category" value={category.slug} defaultChecked={current.category === category.slug} />
                  {category.name} ({category.productCount})
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Brand</legend>
              <select className="fld" name="brand" defaultValue={current.brand} style={{ width: "100%" }}>
                <option value="">All brands</option>
                {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </fieldset>

            <fieldset>
              <legend>Price range</legend>
              <div className="f2" style={{ gap: 8 }}>
                <div className="frow">
                  <label htmlFor="minPrice" className="sr">Minimum price</label>
                  <input id="minPrice" className="fld" type="number" min="0" name="minPrice" defaultValue={current.minPrice} placeholder="Min" />
                </div>
                <div className="frow">
                  <label htmlFor="maxPrice" className="sr">Maximum price</label>
                  <input id="maxPrice" className="fld" type="number" min="0" name="maxPrice" defaultValue={current.maxPrice} placeholder="Max" />
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend>Availability</legend>
              <label className="check">
                <input type="checkbox" name="inStock" value="true" defaultChecked={current.inStock === "true"} />
                In stock only
              </label>
              <label className="check">
                <input type="checkbox" name="featured" value="true" defaultChecked={current.featured === "true"} />
                Featured only
              </label>
            </fieldset>

            <fieldset>
              <legend>Sort</legend>
              <select className="fld" name="sort" defaultValue={current.sort} style={{ width: "100%" }}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </fieldset>

            <div className="btn-row">
              <button type="submit" className="btn p">Apply filters</button>
              <Link href="/products" className="link-quiet">Clear</Link>
            </div>
          </form>
        </aside>

        <div>
          <div className="sortbar">
            <p className="meta" aria-live="polite">
              Showing {result.products.length} of {pagination.total} · page {pagination.page} of {pagination.pageCount}
            </p>
            <p className="meta">
              {current.inStock === "true" ? "In stock only" : "Includes low and out of stock"}
              {current.minPrice || current.maxPrice ? ` · ${peso(current.minPrice || 0)} to ${current.maxPrice ? peso(current.maxPrice) : "any"}` : ""}
            </p>
          </div>

          {result.products.length ? (
            <div className="grid">
              {result.products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="empty">
              <h2>No products match those filters.</h2>
              <p>Try a different search, widen the price range, or clear the filters.</p>
              <Link href="/products" className="btn" style={{ marginTop: 12 }}>Clear filters</Link>
            </div>
          )}

          {pagination.pageCount > 1 ? (
            <nav className="pager" aria-label="Product pages">
              {Number(pagination.page) > 1 ? (
                <Link className="btn s" href={buildQuery(current, { page: Number(pagination.page) - 1 })}>Previous</Link>
              ) : null}
              <span>Page {pagination.page} of {pagination.pageCount}</span>
              {Number(pagination.page) < Number(pagination.pageCount) ? (
                <Link className="btn s" href={buildQuery(current, { page: Number(pagination.page) + 1 })}>Next</Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
