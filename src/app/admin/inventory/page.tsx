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
  { id: 301, name: "Shell Helix Ultra 5W-40 4L", description: "Engine oil", price: 2650, stock_quantity: 64, sku: "SHL-UL-5W40-4L", category: "Engine Oils", brand: "Shell India", visual: "🛢️" },
  { id: 302, name: "Castrol EDGE 5W-30 4L", description: "Engine oil", price: 2450, stock_quantity: 48, sku: "CST-EDGE-5W30-4L", category: "Engine Oils", brand: "Castrol India", visual: "🧴" },
  { id: 303, name: "Bosch Oil Filter P7150", description: "Oil filter", price: 250, stock_quantity: 40, sku: "BOS-P7150", category: "Filters", brand: "Bosch Ltd.", visual: "⚙️" },
  { id: 304, name: "Brake Pad Set (Front)", description: "Brake pads", price: 1250, stock_quantity: 4, sku: "BRK-PAD-FRT-SDZ", category: "Brake System", brand: "Brembo India", visual: "▰" },
  { id: 305, name: "Amaron Go Battery 55B24L", description: "Battery", price: 4850, stock_quantity: 24, sku: "AMR-55B24L", category: "Batteries", brand: "Amaron", visual: "🔋" },
  { id: 306, name: "NGK Spark Plug SILZKR7B11", description: "Spark plug", price: 180, stock_quantity: 32, sku: "NGK-SILZKR7B11", category: "Spark Plugs", brand: "NGK India", visual: "♢" },
  { id: 307, name: "Mobil 1 5W-40 4L", description: "Engine oil", price: 2600, stock_quantity: 0, sku: "MOB1-5W40-4L", category: "Engine Oils", brand: "ExxonMobil", visual: "🛢️" },
  { id: 308, name: "Air Filter Hyundai i20", description: "Air filter", price: 650, stock_quantity: 16, sku: "AIR-FT-HYN-I20", category: "Filters", brand: "Mann+Hummel", visual: "▤" }
];

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>(fallback);
  const [tab, setTab] = useState("All Items");
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items) && d.items.length) {
          setProducts(
            d.items.map((p: Product, i: number) => ({
              ...p,
              sku: p.sku || `SKU-${p.id}`,
              category: p.category || fallback[i % 8].category,
              brand: p.brand || fallback[i % 8].brand,
              visual: fallback[i % 8].visual,
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
          tab === "All Items" ||
          (tab === "Low Stock" && p.stock_quantity > 0 && p.stock_quantity < 10) ||
          (tab === "Out of Stock" && p.stock_quantity === 0)
      ),
    [products, tab]
  );

  const stockValue = products.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0);
  const low = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 10).length;
  const out = products.filter((p) => !p.stock_quantity).length;

  const saveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjust) return;
    
    setSaving(true);
    const updated = adjust.stock_quantity + amount;

    const r = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: adjust.id,
        quantity_change: amount,
        notes: "Manual adjustment from inventory page",
      }),
    });
    
    if (r.ok) {
      setProducts((p) =>
        p.map((x) => (x.id === adjust.id ? { ...x, stock_quantity: updated } : x))
      );
    }
    
    setSaving(false);
    setAdjust(null);
    setAmount(0);
  };

  return (
    <div className="management-page inventory-page">
      <div className="inventory-title">
        <h1>
          ◇ Inventory <span>/ Stock Management</span>
        </h1>
      </div>

      <section className="inventory-kpis">
        {[
          ["Total Items", products.length, "All products & parts", "◇", "purple"],
          ["Total Stock Value", `Rs. ${stockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "At selling price", "₹", "blue"],
          ["Low Stock Items", low, "Reorder recommended", "⚠", "orange"],
          ["Out of Stock Items", out, "Currently unavailable", "⊗", "red"],
          ["Stock Locations", 4, "Warehouses / Stores", "▦", "green"]
        ].map(([l, v, s, i, c]) => (
          <article key={String(l)}>
            <p>
              <small>{l}</small>
              <b>{v}</b>
              <em>{s}</em>
            </p>
            <span className={String(c)}>{i}</span>
          </article>
        ))}
      </section>

      <section className="inventory-board">
        <header>
          <nav>
            {[
              ["All Items", products.length],
              ["Low Stock", low],
              ["Out of Stock", out],
              ["Expiring Soon", 5]
            ].map(([l, n]) => (
              <button
                key={String(l)}
                className={tab === l ? "active" : ""}
                onClick={() => setTab(String(l))}
              >
                {l}
                <i>{n}</i>
              </button>
            ))}
          </nav>
          <div>
            <select>
              <option>All Categories</option>
            </select>
            <select>
              <option>All Locations</option>
            </select>
            <select>
              <option>All Suppliers</option>
            </select>
            <button className="gold-btn">＋ Add Stock</button>
            <button>☷ Stock Adjustment</button>
          </div>
        </header>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>□</th>
                <th>Product</th>
                <th>SKU / Barcode</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
                <th>Location</th>
                <th>Batch No.</th>
                <th>Unit Price</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={p.id} className={p.stock_quantity < 10 ? "warning-row" : ""}>
                  <td>□</td>
                  <td>
                    <span>{p.visual}</span>
                    <b>{p.name}</b>
                  </td>
                  <td>
                    <b>{p.sku}</b>
                    <small>8901040900{String(i).padStart(3, "0")}</small>
                  </td>
                  <td>{p.category}</td>
                  <td>
                    <b className={p.stock_quantity < 10 ? "danger" : "success"}>
                      {p.stock_quantity}
                    </b>
                    <small className={p.stock_quantity < 10 ? "danger" : "success"}>
                      {p.stock_quantity === 0
                        ? "Out of Stock"
                        : p.stock_quantity < 10
                        ? "Low Stock"
                        : "In Stock"}
                    </small>
                  </td>
                  <td>10</td>
                  <td>{i % 3 === 0 ? "Warehouse A" : "Main Store"}</td>
                  <td>{p.stock_quantity ? `BATCH-2405-${String(i + 1).padStart(3, "0")}` : "-"}</td>
                  <td>
                    Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td>{p.brand}</td>
                  <td>
                    <em
                      className={
                        p.stock_quantity === 0 ? "out" : p.stock_quantity < 10 ? "low" : ""
                      }
                    >
                      {p.stock_quantity === 0
                        ? "Out of Stock"
                        : p.stock_quantity < 10
                        ? "Low Stock"
                        : "In Stock"}
                    </em>
                  </td>
                  <td>
                    07 Aug 2026<small>10:15 AM</small>
                  </td>
                  <td>
                    <button onClick={() => setAdjust(p)}>✎</button>
                    <button>⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer>
          Showing 1 to {shown.length} of {products.length} items
          <p>
            <button>‹</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>4</button>
            <button>…</button>
            <button>20</button>
            <button>›</button>
          </p>
        </footer>
      </section>

      <section className="inventory-bottom">
        <article className="movement-summary">
          <h2>
            Stock Movement Summary <small>(This Month)</small>
          </h2>
          <div>
            <p>
              <small>Total Inward</small>
              <b className="success">Rs. 2,45,600.00</b>
            </p>
            <p>
              <small>Total Outward</small>
              <b className="danger">Rs. 1,80,250.00</b>
            </p>
            <p>
              <small>Net Movement</small>
              <b className="blue-text">Rs. 65,350.00</b>
            </p>
            <p>
              <small>Transactions</small>
              <b>342</b>
            </p>
          </div>
        </article>

        <article className="stock-chart">
          <h2>Incoming vs Outgoing Stock</h2>
          <p>
            <i /> Incoming (Rs.) <i /> Outgoing (Rs.)
          </p>
          <svg viewBox="0 0 500 150">
            <path d="M10 115L70 85L125 25L180 58L235 100L290 88L345 52L400 94L455 110L490 92" />
            <path
              className="red-line"
              d="M10 135L70 110L125 75L180 65L235 92L290 72L345 95L400 108L455 132L490 100"
            />
          </svg>
        </article>

        <article className="low-alerts">
          <h2>
            Low Stock Alerts <button>View All</button>
          </h2>
          {products
            .filter((p) => p.stock_quantity < 10)
            .slice(0, 4)
            .map((p) => (
              <div key={p.id}>
                <span>{p.visual}</span>
                <p>
                  <b>{p.name}</b>
                  <small>
                    Current: {p.stock_quantity} | Reorder: 10
                  </small>
                </p>
                <em>Low Stock</em>
              </div>
            ))}
        </article>
      </section>

      {adjust && (
        <div className="management-modal">
          <form onSubmit={saveAdjustment}>
            <header>
              <h2>Stock Adjustment</h2>
              <button type="button" onClick={() => setAdjust(null)}>
                ×
              </button>
            </header>
            <p className="adjust-product">
              <b>{adjust.name}</b>
              <small>Current stock: {adjust.stock_quantity}</small>
            </p>
            <label>
              Adjustment quantity
              <input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <small>Use a negative value to reduce stock.</small>
            </label>
            <footer>
              <button type="button" onClick={() => setAdjust(null)}>
                Cancel
              </button>
              <button className="gold-btn" disabled={saving}>
                {saving ? "Saving..." : "Apply Adjustment"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
