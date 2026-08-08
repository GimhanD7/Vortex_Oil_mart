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
  if (c.includes('coolant') || c.includes('antifreeze') || c.includes('radiator')) return "❄️";
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<{id: number, name: string}[]>([]);
  const [dbBrands, setDbBrands] = useState<{id: number, name: string}[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [brandFilter, setBrandFilter] = useState("All Brands");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [cols, setCols] = useState({ prod: true, sku: true, cat: true, brand: true, pack: true, price: true, status: true, actions: true });
  const [showCols, setShowCols] = useState(false);
  const [isNewCat, setIsNewCat] = useState(false);
  const [isNewBrand, setIsNewBrand] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock_quantity: "",
    sku: "",
    category: "Engine Oils",
    brand: "Generic",
  });
  
  const catsList = ["All", ...Array.from(new Set(dbCategories.map(c => c.name)))];
  const brandsList = ["All Brands", ...Array.from(new Set(dbBrands.map(b => b.name)))];

  const generateSku = (name: string, category: string) => {
    const p1 = category.substring(0, 3).toUpperCase();
    const p2 = name.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase();
    const p3 = Math.floor(1000 + Math.random() * 9000);
    return `${p1}-${p2}-${p3}`;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    // Auto-generate SKU only if the user hasn't heavily customized it (or it's blank/matches pattern)
    // For simplicity, we just generate it dynamically if name is changed and SKU is either empty or was auto-generated.
    setForm(prev => {
      const isAuto = prev.sku === "" || /^[A-Z]{3}-[A-Z0-9]{3}-\d{4}$/.test(prev.sku);
      return {
        ...prev,
        name: newName,
        sku: isAuto && newName.length > 2 ? generateSku(newName, prev.category) : prev.sku
      };
    });
  };

  const load = () => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) {
          setProducts(
            d.map((p: Product, i: number) => ({
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
      
    fetch("/api/categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setDbCategories(d) }).catch(()=>{});
    fetch("/api/brands").then(r => r.json()).then(d => { if (Array.isArray(d)) setDbBrands(d) }).catch(()=>{});
  };

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    let result = products.filter(
      (p) =>
        (cat === "All" || p.category === cat) &&
        (brandFilter === "All Brands" || p.brand === brandFilter) &&
        `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())
    );

    if (statusFilter === "In Stock") {
      result = result.filter(p => p.stock_quantity >= 10);
    } else if (statusFilter === "Low Stock") {
      result = result.filter(p => p.stock_quantity > 0 && p.stock_quantity < 10);
    } else if (statusFilter === "Out of Stock") {
      result = result.filter(p => p.stock_quantity === 0);
    }

    return result;
  }, [products, query, cat, brandFilter, statusFilter]);



  const totalPages = Math.max(1, Math.ceil(shown.length / itemsPerPage));
  const paginatedShown = shown.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Auto-create category and brand if they don't exist
    if (form.category) await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.category }) });
    if (form.brand) await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.brand }) });

    const method = editId ? "PUT" : "POST";
    const url = editId ? `/api/products/${editId}` : "/api/products";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
      }),
    });
    setSaving(false);
    setShow(false);
    setEditId(null);
    setIsNewCat(false);
    setIsNewBrand(false);
    setForm({ name: "", description: "", price: "", stock_quantity: "", sku: "", category: "Engine Oils", brand: "Generic" });
    load();
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      stock_quantity: String(p.stock_quantity),
      sku: p.sku || "",
      category: p.category || "General",
      brand: p.brand || "Generic"
    });
    setEditId(p.id);
    setShow(true);
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
          <button className="gold-btn" onClick={() => { setEditId(null); setForm({ name: "", description: "", price: "", stock_quantity: "", sku: "", category: "Engine Oils", brand: "Generic" }); setShow(true); }}>
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
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          {catsList.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
        </select>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          {brandsList.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All Status">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
      </div>

      <div className="catalog-cats">
        {catsList.map((c, i) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cat === c ? "active" : ""}
          >
            <span>{c === "All" ? "▦" : getCategoryIcon(c)}</span>
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
        <header style={{ position: 'relative', zIndex: 10 }}>
          <h2>All Products</h2>
          <p>
            Show{" "}
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>{" "}
            Showing {shown.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, shown.length)} of {shown.length} products{" "}
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
          <div style={{ display: 'inline-block', position: 'relative', marginLeft: '12px' }}>
            <button onClick={() => setShowCols(!showCols)} className="gold-btn" style={{ padding: '0 8px', fontSize: '10px', height: '27px' }}>
              ⚙️ Columns
            </button>
            {showCols && (
              <div style={{ position: 'absolute', right: 0, top: '35px', background: '#fff', border: '1px solid #e2e4e7', padding: '10px', borderRadius: '8px', zIndex: 50, display: 'grid', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'left', minWidth: '130px' }}>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.prod} onChange={(e) => setCols({...cols, prod: e.target.checked})} /> Product</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.sku} onChange={(e) => setCols({...cols, sku: e.target.checked})} /> SKU</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.cat} onChange={(e) => setCols({...cols, cat: e.target.checked})} /> Category</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.brand} onChange={(e) => setCols({...cols, brand: e.target.checked})} /> Brand</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.pack} onChange={(e) => setCols({...cols, pack: e.target.checked})} /> Pack Size</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.price} onChange={(e) => setCols({...cols, price: e.target.checked})} /> Price</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.status} onChange={(e) => setCols({...cols, status: e.target.checked})} /> Status</label>
                <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.actions} onChange={(e) => setCols({...cols, actions: e.target.checked})} /> Actions</label>
              </div>
            )}
          </div>
        </header>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {cols.prod && <th>Product</th>}
                {cols.sku && <th>SKU</th>}
                {cols.cat && <th>Category</th>}
                {cols.brand && <th>Brand</th>}
                {cols.pack && <th>Pack Size</th>}
                {cols.price && <th>Price</th>}
                {cols.status && <th>Stock Status</th>}
                {cols.actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedShown.map((p) => (
                <tr key={p.id}>
                  {cols.prod && (
                    <td>
                      <span>{p.visual}</span>
                      <b>{p.name}</b>
                    </td>
                  )}
                  {cols.sku && <td>{p.sku}</td>}
                  {cols.cat && <td>{p.category}</td>}
                  {cols.brand && <td>{p.brand}</td>}
                  {cols.pack && <td>1 Unit</td>}
                  {cols.price && (
                    <td>
                      Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {cols.status && (
                    <td>
                      <em className={p.stock_quantity === 0 ? "out" : p.stock_quantity < 10 ? "low" : ""}>
                        {p.stock_quantity === 0 ? "Out of Stock" : p.stock_quantity < 10 ? "Low Stock" : "In Stock"}
                      </em>
                    </td>
                  )}
                  {cols.actions && (
                    <td>
                      <button onClick={() => openEdit(p)}>✎</button>
                      <button className="delete" onClick={() => del(p.id)}>
                        ♲
                      </button>
                    </td>
                  )}
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
              <h2>
                <span style={{ fontSize: '1.5em', marginRight: '8px' }}>{getCategoryIcon(form.category)}</span>
                {editId ? "Edit Product" : "Add New Product"}
              </h2>
              <button type="button" onClick={() => { setShow(false); setEditId(null); }}>
                ×
              </button>
            </header>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
              <label>
                Product Name
                <input
                  required
                  value={form.name}
                  onChange={handleNameChange}
                  placeholder="e.g. Shell Helix Ultra 5W-40"
                />
              </label>
              <label>
                Auto-generated SKU
                <input
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. ENG-SHE-8472"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label>
                Category
                {!isNewCat ? (
                  <select
                    value={form.category}
                    onChange={(e) => {
                      if (e.target.value === "++NEW++") {
                        setIsNewCat(true);
                        setForm({ ...form, category: "" });
                      } else {
                        setForm({ ...form, category: e.target.value });
                      }
                    }}
                    style={{ border: '1px solid #dfe2e5', borderRadius: '7px', padding: '11px', font: 'inherit', width: '100%', outline: 'none' }}
                  >
                    <option value="" disabled>Select a category</option>
                    {dbCategories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    <option value="++NEW++">+ Create New Category...</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      required
                      autoFocus
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Type new category..."
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => { setIsNewCat(false); setForm({ ...form, category: dbCategories[0]?.name || "General" }) }} style={{ padding: '0 10px', border: '1px solid #ccc', borderRadius: '7px', background: '#fff' }}>✕</button>
                  </div>
                )}
              </label>
              
              <label>
                Brand
                {!isNewBrand ? (
                  <select
                    value={form.brand}
                    onChange={(e) => {
                      if (e.target.value === "++NEW++") {
                        setIsNewBrand(true);
                        setForm({ ...form, brand: "" });
                      } else {
                        setForm({ ...form, brand: e.target.value });
                      }
                    }}
                    style={{ border: '1px solid #dfe2e5', borderRadius: '7px', padding: '11px', font: 'inherit', width: '100%', outline: 'none' }}
                  >
                    <option value="" disabled>Select a brand</option>
                    {dbBrands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    <option value="++NEW++">+ Create New Brand...</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      required
                      autoFocus
                      value={form.brand}
                      onChange={(e) => setForm({ ...form, brand: e.target.value })}
                      placeholder="Type new brand..."
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => { setIsNewBrand(false); setForm({ ...form, brand: dbBrands[0]?.name || "Generic" }) }} style={{ padding: '0 10px', border: '1px solid #ccc', borderRadius: '7px', background: '#fff' }}>✕</button>
                  </div>
                )}
              </label>
            </div>

            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the product..."
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label>
                Price (Rs.)
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
              <label>
                Initial Stock Status (Quantity)
                <input
                  required
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
              </label>
            </div>
            
            <footer>
              <button type="button" onClick={() => { setShow(false); setEditId(null); }}>
                Cancel
              </button>
              <button className="gold-btn" disabled={saving}>
                {saving ? "Saving..." : editId ? "Update Product" : "Save Product"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
