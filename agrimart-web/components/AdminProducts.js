"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DashNav from "./DashNav";
import Photo from "./Photo";
import { tintFor } from "@/lib/tints";
import RoleGate from "./RoleGate";
import { useToast } from "./Providers";
import { adminApi } from "@/lib/api";
import { API_BASE } from "@/lib/format";
import { peso } from "@/lib/format";

const EMPTY_PRODUCT = {
  name: "",
  slug: "",
  brand: "",
  categoryId: "",
  unit: "piece",
  price: "",
  stockQty: "0",
  reorderLevel: "10",
  imageUrl: "",
  gallery: "",
  description: "",
  isActive: true,
  isFeatured: false,
};

const EMPTY_CATEGORY = { name: "", slug: "", description: "" };

export default function AdminProducts() {
  const { push } = useToast();
  const formRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
  const [editingCategory, setEditingCategory] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adminApi.products({ pageSize: 100 }), adminApi.categories()])
      .then(([productPayload, categoryPayload]) => {
        setProducts(productPayload.data || []);
        setCategories(categoryPayload.data || []);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => [product.name, product.brand, product.category?.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [products, query]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((product) => product.isActive).length,
    low: products.filter((product) => product.stockQty <= product.reorderLevel).length,
    categories: categories.length,
  }), [products, categories]);

  function set(key) {
    return (event) => {
      const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
    };
  }

  function resetForm() {
    setForm(EMPTY_PRODUCT);
    setEditingId(null);
  }

  async function uploadImages(event, gallery = false) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const tooLarge = files.find((file) => file.size > 8 * 1024 * 1024);
    if (tooLarge) return setError(`${tooLarge.name} is larger than the 8 MB limit.`);
    setError("");
    setBusy(gallery ? "gallery-upload" : "image-upload");
    try {
      const urls = [];
      for (const file of files) {
        const payload = await adminApi.uploadProductImage(file);
        const path = payload?.data?.url;
        if (!path) throw new Error("The uploaded image did not return a usable URL.");
        urls.push(/^https?:\/\//i.test(path) ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`);
      }
      if (gallery) {
        setForm((current) => ({ ...current, gallery: [...current.gallery.split("\n").map((line) => line.trim()).filter(Boolean), ...urls].join("\n") }));
      } else {
        setForm((current) => ({ ...current, imageUrl: urls[0] }));
      }
      push(`${urls.length} image${urls.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function edit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      slug: product.slug || "",
      brand: product.brand || "",
      categoryId: product.category?.id ? String(product.category.id) : "",
      unit: product.unit || "piece",
      price: String(product.price ?? ""),
      stockQty: String(product.stockQty ?? 0),
      reorderLevel: String(product.reorderLevel ?? 10),
      imageUrl: product.imageUrlRaw || product.imageUrl || "",
      gallery: (product.galleryUrls || []).join("\n"),
      description: product.description || "",
      isActive: product.isActive !== false,
      isFeatured: Boolean(product.isFeatured),
    });
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProduct(event) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Enter a product name.");
    if (form.price === "" || Number(form.price) < 0) return setError("Enter a price of zero or more.");
    setBusy("product");
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      brand: form.brand.trim(),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit: form.unit.trim() || "piece",
      price: Number(form.price),
      stockQty: Number(form.stockQty || 0),
      reorderLevel: Number(form.reorderLevel || 0),
      imageUrl: form.imageUrl.trim(),
      galleryUrls: form.gallery.split("\n").map((line) => line.trim()).filter(Boolean),
      description: form.description,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    };
    try {
      if (editingId) await adminApi.updateProduct(editingId, body);
      else await adminApi.createProduct(body);
      push(editingId ? "Product updated." : "Product created.");
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function archive(product) {
    if (!window.confirm(`Archive ${product.name}? It disappears from the storefront but order history keeps it.`)) return;
    setBusy(`archive-${product.id}`);
    try {
      await adminApi.deleteProduct(product.id);
      push(`${product.name} archived.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function restore(product) {
    setBusy(`restore-${product.id}`);
    try {
      await adminApi.updateProduct(product.id, { isActive: true });
      push(`${product.name} restored.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function setCategory(key) {
    return (event) => setCategoryForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function saveCategory(event) {
    event.preventDefault();
    setError("");
    if (!categoryForm.name.trim()) return setError("Enter a category name.");
    setBusy("category");
    try {
      if (editingCategory) await adminApi.updateCategory(editingCategory, categoryForm);
      else await adminApi.createCategory(categoryForm);
      push(editingCategory ? "Category updated." : "Category created.");
      setCategoryForm(EMPTY_CATEGORY);
      setEditingCategory(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete ${category.name}? Only empty categories can be removed.`)) return;
    setBusy(`cat-${category.id}`);
    try {
      await adminApi.deleteCategory(category.id);
      push(`${category.name} deleted.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <RoleGate roles={["admin"]}>
      <div className="dash">
        <DashNav kind="admin" />
        <div className="dmain">
          <header className="dhead">
            <div>
              <p className="eyebrow">Catalog</p>
              <h1>Products and categories</h1>
              <p>Add products, set prices and reorder levels, and keep the photo slots filled.</p>
            </div>
            <button type="button" className="btn" onClick={() => { resetForm(); formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>New product</button>
          </header>

          {error ? <p className="err" role="alert">{error}</p> : null}
          <div className="dstats">
            <div className="dstat"><span>Products</span><b>{stats.total}</b></div>
            <div className="dstat"><span>Active</span><b>{stats.active}</b></div>
            <div className="dstat"><span>Low stock</span><b>{stats.low}</b></div>
            <div className="dstat"><span>Categories</span><b>{stats.categories}</b></div>
          </div>

          <div className="toolbar">
            <div className="group">
              <label htmlFor="product-search" className="sr">Search products</label>
              <input id="product-search" className="fld" type="search" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 240 }} />
            </div>
            <button type="button" className="btn s" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
          </div>

          <div className="tw">
            <table className="tbl">
              <thead>
                <tr><th>Product</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} data-low={product.stockQty <= product.reorderLevel}>
                    <td>
                      <b>{product.name}</b>
                      <small className="meta" style={{ display: "block" }}>{product.brand || "—"}{product.isFeatured ? " · Featured" : ""}</small>
                    </td>
                    <td>{product.category?.name || "—"}</td>
                    <td className="num">{peso(product.price)}<small className="meta" style={{ display: "block" }}>per {product.unit}</small></td>
                    <td className="num">{product.stockQty}<small className="meta" style={{ display: "block" }}>reorder {product.reorderLevel}</small></td>
                    <td>
                      <span className={`tag ${product.isActive ? "ok" : ""}`}>{product.isActive ? "Active" : "Archived"}</span>
                      {product.stockQty <= product.reorderLevel ? <span className="tag low" style={{ marginLeft: 4 }}>Low</span> : null}
                    </td>
                    <td>
                      <div className="btn-row" style={{ flexWrap: "nowrap" }}>
                        <button type="button" className="btn s" onClick={() => edit(product)}>Edit</button>
                        {product.isActive ? (
                          <button type="button" className="btn s" disabled={busy === `archive-${product.id}`} onClick={() => archive(product)}>Archive</button>
                        ) : (
                          <button type="button" className="btn s" disabled={busy === `restore-${product.id}`} onClick={() => restore(product)}>Restore</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="editor" ref={formRef}>
            <h2>{editingId ? `Edit ${form.name}` : "Add a product"}</h2>
            <form className="form" onSubmit={saveProduct} noValidate>
              <div className="f2">
                <div className="frow">
                  <label htmlFor="f-name">Product name</label>
                  <input id="f-name" className="fld" value={form.name} onChange={set("name")} required />
                </div>
                <div className="frow">
                  <label htmlFor="f-slug">Slug (optional)</label>
                  <input id="f-slug" className="fld" value={form.slug} onChange={set("slug")} placeholder="auto from the name" />
                </div>
              </div>
              <div className="f3">
                <div className="frow">
                  <label htmlFor="f-brand">Brand</label>
                  <input id="f-brand" className="fld" value={form.brand} onChange={set("brand")} />
                </div>
                <div className="frow">
                  <label htmlFor="f-category">Category</label>
                  <select id="f-category" className="fld" value={form.categoryId} onChange={set("categoryId")}>
                    <option value="">No category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
                <div className="frow">
                  <label htmlFor="f-unit">Sold as</label>
                  <input id="f-unit" className="fld" value={form.unit} onChange={set("unit")} placeholder="sack, kg, piece" />
                </div>
              </div>
              <div className="f3">
                <div className="frow">
                  <label htmlFor="f-price">Price (PHP)</label>
                  <input id="f-price" className="fld" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} required />
                </div>
                <div className="frow">
                  <label htmlFor="f-stock">Stock on hand</label>
                  <input id="f-stock" className="fld" type="number" min="0" value={form.stockQty} onChange={set("stockQty")} />
                </div>
                <div className="frow">
                  <label htmlFor="f-reorder">Reorder level</label>
                  <input id="f-reorder" className="fld" type="number" min="0" value={form.reorderLevel} onChange={set("reorderLevel")} />
                </div>
              </div>
              <div className="frow">
                <label htmlFor="f-image">Photo URL</label>
                <input id="f-image" className="fld" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://… or /uploads/photo.jpg" />
                <label htmlFor="f-image-upload">Or upload a product photo</label>
                <input id="f-image-upload" className="fld" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadImages(event)} disabled={busy === "image-upload"} />
                <p className="form-note">PNG, JPEG, WebP or GIF · up to 8 MB. Leave blank to show the category placeholder.</p>
              </div>
              {form.imageUrl ? (
                <div style={{ maxWidth: 220 }}>
                  <Photo src={form.imageUrl} alt="Photo preview" tint={tintFor(categories.find((category) => String(category.id) === form.categoryId))} label="Preview" />
                </div>
              ) : null}
              <div className="frow">
                <label htmlFor="f-gallery">Gallery photo URLs (one per line)</label>
                <textarea id="f-gallery" className="fld" value={form.gallery} onChange={set("gallery")} />
                <label htmlFor="f-gallery-upload">Or upload gallery photos</label>
                <input id="f-gallery-upload" className="fld" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(event) => uploadImages(event, true)} disabled={busy === "gallery-upload"} />
                <p className="form-note">Uploaded photos are added to the URL list above.</p>
              </div>
              <div className="frow">
                <label htmlFor="f-desc">Description</label>
                <textarea id="f-desc" className="fld" value={form.description} onChange={set("description")} />
              </div>
              <div className="f2">
                <label className="check">
                  <input type="checkbox" checked={form.isActive} onChange={set("isActive")} />
                  Active on the storefront
                </label>
                <label className="check">
                  <input type="checkbox" checked={form.isFeatured} onChange={set("isFeatured")} />
                  Show in featured products
                </label>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn p" disabled={busy === "product"}>{busy === "product" ? "Saving..." : editingId ? "Update product" : "Create product"}</button>
                {editingId ? <button type="button" className="btn" onClick={resetForm}>Cancel edit</button> : null}
              </div>
            </form>
          </section>

          <section className="editor">
            <h2>Categories</h2>
            <div className="cat-list">
              {categories.map((category) => (
                <div className="cat-row" key={category.id}>
                  <span>
                    <b>{category.name}</b>
                    <small>{category.slug} · {category.productCount} product{category.productCount === 1 ? "" : "s"}</small>
                  </span>
                  <button type="button" className="lnk" onClick={() => { setEditingCategory(category.id); setCategoryForm({ name: category.name, slug: category.slug, description: category.description || "" }); }}>Edit</button>
                  <button type="button" className="lnk" disabled={busy === `cat-${category.id}`} onClick={() => deleteCategory(category)}>Delete</button>
                </div>
              ))}
            </div>
            <form className="form" onSubmit={saveCategory} noValidate style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 18, margin: 0 }}>{editingCategory ? "Edit category" : "Add a category"}</h3>
              <div className="f3">
                <div className="frow">
                  <label htmlFor="cat-name">Name</label>
                  <input id="cat-name" className="fld" value={categoryForm.name} onChange={setCategory("name")} required />
                </div>
                <div className="frow">
                  <label htmlFor="cat-slug">Slug (optional)</label>
                  <input id="cat-slug" className="fld" value={categoryForm.slug} onChange={setCategory("slug")} />
                </div>
                <div className="frow">
                  <label htmlFor="cat-desc">Description</label>
                  <input id="cat-desc" className="fld" value={categoryForm.description} onChange={setCategory("description")} />
                </div>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn" disabled={busy === "category"}>{busy === "category" ? "Saving..." : editingCategory ? "Update category" : "Create category"}</button>
                {editingCategory ? <button type="button" className="btn" onClick={() => { setEditingCategory(null); setCategoryForm(EMPTY_CATEGORY); }}>Cancel</button> : null}
              </div>
            </form>
          </section>

          <p style={{ marginTop: 32 }}><Link href="/products" className="link-quiet">Open the storefront catalog</Link></p>
        </div>
      </div>
    </RoleGate>
  );
}
