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

const getCategoryIcon = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('engine') || c.includes('oil')) return "🛢️";
  if (c.includes('gear') || c.includes('lubricant') || c.includes('grease')) return "⚙️";
  if (c.includes('filter')) return "🌪️";
  if (c.includes('brake') || c.includes('pad') || c.includes('shoe')) return "🛑";
  if (c.includes('batter')) return "🔋";
  if (c.includes('spark') || c.includes('ignition') || c.includes('plug')) return "⚡";
  if (c.includes('coolant') || c.includes('antfreeze') || c.includes('radiator')) return "❄️";
  if (c.includes('wiper') || c.includes('wash')) return "🌧️";
  if (c.includes('bulb') || c.includes('light') || c.includes('lamp')) return "💡";
  if (c.includes('tire') || c.includes('tyre') || c.includes('wheel')) return "🛞";
  if (c.includes('belt') || c.includes('chain')) return "⛓️";
  if (c.includes('exhaust') || c.includes('muffler')) return "💨";
  if (c.includes('suspension') || c.includes('shock') || c.includes('spring')) return "🛠️";
  if (c.includes('tool') || c.includes('equipment')) return "🔧";
  if (c.includes('polish') || c.includes('wax') || c.includes('cleaner') || c.includes('shampoo')) return "🧽";
  if (c.includes('accessory') || c.includes('mat') || c.includes('cover')) return "💺";
  return "📦";
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState("All Items");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [cols, setCols] = useState({ check: true, prod: true, sku: true, cat: true, stock: true, reorder: true, loc: true, batch: true, price: true, supplier: true, status: true, updated: true, actions: true });

  const load = () => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) {
          setProducts(
            d.items.map((p: Product) => ({
              ...p,
              sku: p.sku || `SKU-${String(p.id).padStart(3, "0")}`,
              category: p.category || "General",
              brand: p.brand || "Generic",
              visual: p.visual || getCategoryIcon(p.category || "General"),
            }))
          );
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    return products.filter(
      (p) =>
        (tab === "All Items" ||
          (tab === "Low Stock" && p.stock_quantity > 0 && p.stock_quantity < 10) ||
          (tab === "Out of Stock" && p.stock_quantity === 0) ||
          (tab === "Expiring Soon" && false)) &&
        (catFilter === "All Categories" || p.category === catFilter)
    );
  }, [products, tab, catFilter]);

  const categories = useMemo(() => {
    const c = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All Categories", ...Array.from(c)] as string[];
  }, [products]);

  const totalPages = Math.max(1, Math.ceil(shown.length / itemsPerPage));
  const paginatedShown = shown.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

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
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "All Categories" ? "▦" : getCategoryIcon(c)} {c}
                </option>
              ))}
            </select>
            <select>
              <option>All Locations</option>
            </select>
            <select>
              <option>All Suppliers</option>
            </select>
            <button className="gold-btn" onClick={() => window.location.href = '/admin/products'}>＋ Add Stock</button>
            <button onClick={() => { if(products.length > 0) setAdjust(products[0]) }}>☷ Stock Adjustment</button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowCols(!showCols)} style={{ marginLeft: '4px', height: '34px', padding: '0 12px' }}>⚙️ Columns</button>
              {showCols && (
                <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', border: '1px solid #e2e4e7', padding: '12px', borderRadius: '8px', zIndex: 50, display: 'grid', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'left', minWidth: '150px' }}>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.check} onChange={(e) => setCols({...cols, check: e.target.checked})} /> Checkbox</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.prod} onChange={(e) => setCols({...cols, prod: e.target.checked})} /> Product</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.sku} onChange={(e) => setCols({...cols, sku: e.target.checked})} /> SKU / Barcode</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.cat} onChange={(e) => setCols({...cols, cat: e.target.checked})} /> Category</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.stock} onChange={(e) => setCols({...cols, stock: e.target.checked})} /> Current Stock</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.reorder} onChange={(e) => setCols({...cols, reorder: e.target.checked})} /> Reorder Level</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.loc} onChange={(e) => setCols({...cols, loc: e.target.checked})} /> Location</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.batch} onChange={(e) => setCols({...cols, batch: e.target.checked})} /> Batch No.</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.price} onChange={(e) => setCols({...cols, price: e.target.checked})} /> Unit Price</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.supplier} onChange={(e) => setCols({...cols, supplier: e.target.checked})} /> Supplier</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.status} onChange={(e) => setCols({...cols, status: e.target.checked})} /> Status</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.updated} onChange={(e) => setCols({...cols, updated: e.target.checked})} /> Last Updated</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.actions} onChange={(e) => setCols({...cols, actions: e.target.checked})} /> Actions</label>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {cols.check && <th>□</th>}
                {cols.prod && <th>Product</th>}
                {cols.sku && <th>SKU / Barcode</th>}
                {cols.cat && <th>Category</th>}
                {cols.stock && <th>Current Stock</th>}
                {cols.reorder && <th>Reorder Level</th>}
                {cols.loc && <th>Location</th>}
                {cols.batch && <th>Batch No.</th>}
                {cols.price && <th>Unit Price</th>}
                {cols.supplier && <th>Supplier</th>}
                {cols.status && <th>Status</th>}
                {cols.updated && <th>Last Updated</th>}
                {cols.actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedShown.map((p, i) => (
                <tr key={p.id} className={p.stock_quantity < 10 ? "warning-row" : ""}>
                  {cols.check && <td>□</td>}
                  {cols.prod && (
                    <td>
                      <span>{p.visual}</span>
                      <b>{p.name}</b>
                    </td>
                  )}
                  {cols.sku && (
                    <td>
                      <b>{p.sku}</b>
                      <small>8901040900{String(i).padStart(3, "0")}</small>
                    </td>
                  )}
                  {cols.cat && <td>{p.category}</td>}
                  {cols.stock && (
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
                  )}
                  {cols.reorder && <td>10</td>}
                  {cols.loc && <td>{i % 3 === 0 ? "Warehouse A" : "Main Store"}</td>}
                  {cols.batch && <td>{p.stock_quantity ? `BATCH-2405-${String(i + 1).padStart(3, "0")}` : "-"}</td>}
                  {cols.price && (
                    <td>
                      Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {cols.supplier && <td>{p.brand}</td>}
                  {cols.status && (
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
                  )}
                  {cols.updated && (
                    <td>
                      07 Aug 2026<small>10:15 AM</small>
                    </td>
                  )}
                  {cols.actions && (
                    <td>
                      <button onClick={() => setAdjust(p)}>✎</button>
                      <button>⋮</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer>
          Showing {shown.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, shown.length)} of {shown.length} items
          <p>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, i, arr) => {
                const isDots = i > 0 && arr[i - 1] !== p - 1;
                return (
                  <span key={p}>
                    {isDots && <button disabled>…</button>}
                    <button className={currentPage === p ? "active" : ""} onClick={() => setCurrentPage(p)}>
                      {p}
                    </button>
                  </span>
                );
              })
            }
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
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
            Low Stock Alerts <button onClick={() => setTab("Low Stock")}>View All</button>
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
