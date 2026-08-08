"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  sku?: string;
  category?: string;
  brand?: string;
  visual?: string;
};

const fallback: Product[] = [
  { id: 201, name: "Castrol EDGE 5W-30", description: "Premium synthetic engine oil", price: 2450, stock_quantity: 48, sku: "EO-002", category: "Engine Oils", brand: "Castrol", visual: "🧴" },
  { id: 202, name: "Shell Helix Ultra 5W-40", description: "Fully synthetic engine oil", price: 2650, stock_quantity: 64, sku: "EO-001", category: "Engine Oils", brand: "Shell", visual: "🛢️" },
  { id: 203, name: "Gulf Gear EP 80W-90", description: "Heavy duty gear oil", price: 1350, stock_quantity: 28, sku: "GO-001", category: "Gear Oils", brand: "Gulf", visual: "🧴" },
  { id: 204, name: "Liqui Moly 10W-40", description: "High performance lubricant", price: 1350, stock_quantity: 32, sku: "LU-001", category: "Lubricants", brand: "Liqui Moly", visual: "🛢️" },
  { id: 205, name: "Bosch Oil Filter", description: "Premium oil filter", price: 250, stock_quantity: 40, sku: "FLT-001", category: "Filters", brand: "Bosch", visual: "⚙️" },
  { id: 206, name: "Mann Air Filter", description: "High-flow air filter", price: 650, stock_quantity: 4, sku: "FLT-002", category: "Filters", brand: "Mann", visual: "▤" },
  { id: 207, name: "Brake Pad Set (Front)", description: "Front ceramic brake pads", price: 1250, stock_quantity: 24, sku: "BRK-001", category: "Brake Pads", brand: "Brembo", visual: "▰" },
  { id: 208, name: "Amaron Go Battery", description: "Maintenance-free battery", price: 6850, stock_quantity: 18, sku: "BAT-001", category: "Batteries", brand: "Amaron", visual: "🔋" },
  { id: 209, name: "Exide Mileage Battery", description: "Long life battery", price: 7250, stock_quantity: 5, sku: "BAT-002", category: "Batteries", brand: "Exide", visual: "🔋" },
  { id: 210, name: "NGK Spark Plug", description: "Iridium spark plug", price: 180, stock_quantity: 32, sku: "SPK-001", category: "Spark Plugs", brand: "NGK", visual: "♢" }
];

const cats = ["All", "Engine Oils", "Gear Oils", "Lubricants", "Filters", "Brake Pads", "Batteries", "Spark Plugs"];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(fallback);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", stock_quantity: "" });

  const load = () => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) {
          setProducts(
            d.map((p: Product, i: number) => ({
              ...p,
              sku: p.sku || `SKU-${String(p.id).padStart(3, "0")}`,
              category: p.category || fallback[i % fallback.length].category,
              brand: p.brand || fallback[i % fallback.length].brand,
              visual: p.visual || fallback[i % fallback.length].visual,
            }))
          );
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(
    () =>
      products.filter(
        (p) =>
          (cat === "All" || p.category === cat) &&
          `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())
      ),
    [products, query, cat]
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
      }),
    });
    setSaving(false);
    setShow(false);
    setForm({ name: "", description: "", price: "", stock_quantity: "" });
    load();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    const r = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (r.ok) setProducts((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="management-page products-page">
      <div className="management-heading">
        <div>
          <h1>Product Management</h1>
          <p>Dashboard › Products</p>
        </div>
        <aside>
          <button>⇩ Import</button>
          <button>⇧ Export</button>
          <button className="gold-btn" onClick={() => setShow(true)}>
            ＋ Add Product
          </button>
        </aside>
      </div>

      <div className="management-filters">
        <label>
          ⌕
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name, SKU or part number..."
          />
        </label>
        <select>
          <option>All Categories</option>
        </select>
        <select>
          <option>All Brands</option>
        </select>
        <select>
          <option>All Status</option>
        </select>
      </div>

      <div className="catalog-cats">
        {cats.map((c, i) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cat === c ? "active" : ""}
          >
            <span>{["▦", "♙", "▣", "▤", "▥", "◉", "▰", "♢"][i]}</span>
            {c}
          </button>
        ))}
      </div>

      <section className="product-overview">
        <h2>Product Overview</h2>
        <div>
          {shown.slice(0, 7).map((p) => (
            <article key={p.id}>
              <span>{p.visual}</span>
              <b>{p.name}</b>
              <small>SKU: {p.sku}</small>
              <em className={p.stock_quantity < 10 ? "low" : ""}>
                {p.stock_quantity ? "In Stock" : "Out of Stock"}
              </em>
              <strong>
                Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </strong>
            </article>
          ))}
        </div>
      </section>

      <section className="management-table">
        <header>
          <h2>All Products</h2>
          <p>
            Show{" "}
            <select>
              <option>10</option>
            </select>{" "}
            Showing 1 to {shown.length} of {products.length} products{" "}
            <button>‹</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </p>
        </header>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Pack Size</th>
                <th>Price</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span>{p.visual}</span>
                    <b>{p.name}</b>
                  </td>
                  <td>{p.sku}</td>
                  <td>{p.category}</td>
                  <td>{p.brand}</td>
                  <td>1 Unit</td>
                  <td>
                    Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <em className={p.stock_quantity < 10 ? "low" : ""}>
                      {p.stock_quantity < 10 ? "Low Stock" : "In Stock"}
                    </em>
                  </td>
                  <td>
                    <button>✎</button>
                    <button className="delete" onClick={() => del(p.id)}>
                      ♲
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {show && (
        <div className="management-modal">
          <form onSubmit={add}>
            <header>
              <h2>Add New Product</h2>
              <button type="button" onClick={() => setShow(false)}>
                ×
              </button>
            </header>
            <label>
              Product Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div>
              <label>
                Price (Rs.)
                <input
                  required
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
              <label>
                Initial Stock
                <input
                  required
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setShow(false)}>
                Cancel
              </button>
              <button className="gold-btn" disabled={saving}>
                {saving ? "Saving..." : "Save Product"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
