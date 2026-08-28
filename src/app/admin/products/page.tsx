"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cachedFetch } from "@/lib/api-client";
import { ProductCategoryIcon } from "@/components/ProductCategoryIcon";
import { useToast } from "@/components/ToastProvider";
import {
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  product_type?: "packaged" | "loose_oil" | string;
  unit?: string;
  barrel_capacity_liters?: number | string | null;
  reorder_level?: number | string;
  sku?: string;
  category?: string;
  sub_category?: string;
  brand?: string;
  visual?: string;
};

function stockBadge(stockQuantity: number | string, reorderLevel: number | string = 10) {
  const stock = Number(stockQuantity || 0);
  const reorder = Number(reorderLevel || 10);
  if (stock <= 0) return { className: "out", label: "Out of Stock" };
  if (stock <= reorder) return { className: "low", label: "Low Stock" };
  return { className: "", label: "In Stock" };
}

function isLooseOil(product: Pick<Product, "product_type" | "unit">) {
  return product.product_type === "loose_oil" || (product.unit || "").toLowerCase() === "l";
}

function formatQty(value: string | number, unit = "Unit") {
  const quantity = Number(value || 0);
  const formatted = Number.isInteger(quantity)
    ? quantity.toLocaleString("en-IN")
    : quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return `${formatted} ${unit || "Unit"}`;
}

const blankProductForm = {
  name: "",
  description: "",
  price: "",
  stock_quantity: "",
  sku: "",
  category: "Engine Oils",
  brand: "Generic",
  sub_category: "General",
  product_type: "packaged",
  unit: "Unit",
  barrel_capacity_liters: "",
  reorder_level: "10",
};

export default function ProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<{id: number, name: string}[]>([]);
  const [dbSubCategories, setDbSubCategories] = useState<{id: number, category_name: string, name: string}[]>([]);
  const [dbBrands, setDbBrands] = useState<{id: number, name: string}[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [subCatFilter, setSubCatFilter] = useState("All Sub-Categories");
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
  const [isNewSubCat, setIsNewSubCat] = useState(false);
  const [isNewBrand, setIsNewBrand] = useState(false);
  const [form, setForm] = useState(blankProductForm);

  const [showIcons, setShowIcons] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('showProductIcons');
    if (saved !== null) {
      setShowIcons(saved === 'true');
    }
  }, []);

  const toggleIcons = () => {
    const next = !showIcons;
    setShowIcons(next);
    localStorage.setItem('showProductIcons', String(next));
  };
  
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
    cachedFetch("/api/products")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) {
          setProducts(
            d.map((p: Product) => ({
              ...p,
              sku: p.sku || `SKU-${String(p.id).padStart(3, "0")}`,
              category: p.category || "General",
              sub_category: p.sub_category || "General",
              brand: p.brand || "Generic",
              product_type: p.product_type || "packaged",
              unit: p.unit || "Unit",
              stock_quantity: Number(p.stock_quantity || 0),
              reorder_level: Number(p.reorder_level || 10),
            }))
          );
        }
      })
      .catch(() => {});
      
    cachedFetch("/api/categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setDbCategories(d) }).catch(()=>{});
    cachedFetch("/api/sub_categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setDbSubCategories(d) }).catch(()=>{});
    cachedFetch("/api/brands").then(r => r.json()).then(d => { if (Array.isArray(d)) setDbBrands(d) }).catch(()=>{});
  };

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    let result = products.filter(
      (p) =>
        (cat === "All" || p.category === cat) &&
        (subCatFilter === "All Sub-Categories" || p.sub_category === subCatFilter) &&
        (brandFilter === "All Brands" || p.brand === brandFilter) &&
        `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())
    );

    if (statusFilter === "In Stock") {
      result = result.filter(p => Number(p.stock_quantity || 0) > Number(p.reorder_level || 10));
    } else if (statusFilter === "Low Stock") {
      result = result.filter(p => Number(p.stock_quantity || 0) > 0 && Number(p.stock_quantity || 0) <= Number(p.reorder_level || 10));
    } else if (statusFilter === "Out of Stock") {
      result = result.filter(p => Number(p.stock_quantity || 0) <= 0);
    }

    return result;
  }, [products, query, cat, subCatFilter, brandFilter, statusFilter]);



  const totalPages = Math.max(1, Math.ceil(shown.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedShown = shown.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    // Auto-create category, sub-category, and brand if they don't exist
    if (form.category && isNewCat) await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.category }) });
    if (form.sub_category && isNewSubCat) await fetch("/api/sub_categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category_name: form.category, name: form.sub_category }) });
    if (form.brand && isNewBrand) await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.brand }) });

    const method = editId ? "PUT" : "POST";
    const url = editId ? `/api/products/${editId}` : "/api/products";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        unit: form.product_type === "loose_oil" ? "L" : form.unit || "Unit",
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        barrel_capacity_liters: form.product_type === "loose_oil" && form.barrel_capacity_liters ? Number(form.barrel_capacity_liters) : null,
        reorder_level: Number(form.reorder_level || (form.product_type === "loose_oil" ? 20 : 10)),
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      showToast({ type: "error", title: "Product failed", message: data.error || "Could not save product." });
      return;
    }
    setShow(false);
    setEditId(null);
    setIsNewCat(false);
    setIsNewSubCat(false);
    setIsNewBrand(false);
    setForm(blankProductForm);
    load();
    showToast({ type: "success", title: editId ? "Product updated" : "Product created", message: data.message || "Product saved successfully." });
  };

  const importFileRef = useRef<HTMLInputElement>(null);

  const exportProducts = () => {
    let csv = "Name,SKU,Category,Brand,Description,Product Type,Unit,Barrel Capacity Liters,Price,Stock Quantity,Reorder Level\n";
    products.forEach((p) => {
      const escape = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
      csv += `${escape(p.name)},${escape(p.sku || "")},${escape(p.category || "")},${escape(p.brand || "")},${escape(p.description || "")},${escape(p.product_type || "packaged")},${escape(p.unit || "Unit")},${p.barrel_capacity_liters || ""},${p.price},${p.stock_quantity},${p.reorder_level || 10}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    if (!headers.includes("name") || !headers.includes("price") || !headers.includes("stock quantity")) {
      showToast({ type: "error", title: "Import failed", message: "Invalid CSV format. Missing required columns: Name, Price, Stock Quantity." });
      setSaving(false);
      if (importFileRef.current) importFileRef.current.value = "";
      return;
    }

    let importedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
      if (row.length < headers.length) continue;

      const getCol = (name: string) => row[headers.indexOf(name)] || "";

      const name = getCol("name");
      if (!name) continue;
      const price = Number(getCol("price"));
      const stock = Number(getCol("stock quantity"));
      const category = getCol("category") || "General";
      const brand = getCol("brand") || "Generic";

      const sku = getCol("sku") || generateSku(name, category);
      const existingProduct = products.find((p) => p.sku === sku || p.name.toLowerCase() === name.toLowerCase());

      const payload = {
        name,
        sku,
        category,
        brand,
        description: getCol("description"),
        price: isNaN(price) ? 0 : price,
        stock_quantity: isNaN(stock) ? 0 : stock,
        product_type: getCol("product type") === "loose_oil" ? "loose_oil" : "packaged",
        unit: getCol("unit") || (getCol("product type") === "loose_oil" ? "L" : "Unit"),
        barrel_capacity_liters: getCol("barrel capacity liters") ? Number(getCol("barrel capacity liters")) : null,
        reorder_level: getCol("reorder level") ? Number(getCol("reorder level")) : (getCol("product type") === "loose_oil" ? 20 : 10),
      };

      if (existingProduct) {
        await fetch(`/api/products/${existingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      importedCount++;
    }

    showToast({ type: "success", title: "Import completed", message: `Successfully imported ${importedCount} products.` });
    if (importFileRef.current) importFileRef.current.value = "";
    load();
    setSaving(false);
  };

  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      stock_quantity: String(p.stock_quantity),
      sku: p.sku || "",
      category: p.category || "General",
      sub_category: p.sub_category || "General",
      brand: p.brand || "Generic",
      product_type: p.product_type || "packaged",
      unit: p.unit || "Unit",
      barrel_capacity_liters: p.barrel_capacity_liters ? String(p.barrel_capacity_liters) : "",
      reorder_level: String(p.reorder_level || (isLooseOil(p) ? 20 : 10)),
    });
    setEditId(p.id);
    setShow(true);
  };

  const deleteProduct = async (id: number) => {
    const r = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await r.json();
    if (r.ok) {
      setProducts((p) => p.filter((x) => x.id !== id));
      showToast({ type: "success", title: "Product deleted", message: data.message || "Product removed successfully." });
    } else {
      showToast({ type: "error", title: "Delete failed", message: data.error || "Could not delete product." });
    }
  };

  const del = (id: number) => {
    showToast({
      type: "warning",
      title: "Delete product?",
      message: "This product will be removed if it is not linked to sales.",
      duration: 0,
      actionLabel: "Delete",
      onAction: () => void deleteProduct(id),
    });
  };

  return (
    <div className="management-page products-page">
      <div className="management-heading">
        <div>
          <h1>Product Management</h1>
          <p>Dashboard / Products</p>
        </div>
        <aside>
          <input
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            ref={importFileRef}
            onChange={handleImport}
          />
          <button onClick={() => importFileRef.current?.click()} disabled={saving}>
            <Upload size={15} aria-hidden="true" /> {saving ? "Importing..." : "Import"}
          </button>
          <button onClick={exportProducts}>
            <Download size={15} aria-hidden="true" /> Export
          </button>
          <button className="gold-btn" onClick={() => { setEditId(null); setForm(blankProductForm); setShow(true); }}>
            <Plus size={15} aria-hidden="true" /> Add Product
          </button>
        </aside>
      </div>

      <div className="management-filters">
        <label>
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name, SKU or part number..."
          />
        </label>
        <select value={cat} onChange={(e) => { setCat(e.target.value); setSubCatFilter("All Sub-Categories"); }}>
          {catsList.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
        </select>
        {cat !== "All" && (
          <select value={subCatFilter} onChange={(e) => setSubCatFilter(e.target.value)}>
            <option value="All Sub-Categories">All Sub-Categories</option>
            {dbSubCategories.filter(sc => sc.category_name === cat).map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
          </select>
        )}
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
        {catsList.map((c) => (
          <button
            key={c}
            onClick={() => { setCat(c); setSubCatFilter("All Sub-Categories"); }}
            className={cat === c ? "active" : ""}
          >
            <ProductCategoryIcon category={c} className="catalog-icon" colored />
            {c}
          </button>
        ))}
      </div>

      

      <section className="product-overview">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Product Overview</h2>
          
          <button 
            onClick={toggleIcons} 
            style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}
          >
            {showIcons ? <EyeOff size={16} /> : <Eye size={16} />}
            {showIcons ? "Hide Icons" : "Show Icons"}
          </button>
        </div>
        {cat !== "All" && dbSubCategories.filter(sc => sc.category_name === cat).length > 0 && (
        <div className="catalog-sub-cats" style={{ display: 'flex', gap: '8px', padding: '0 25px 20px', overflowX: 'auto' }}>
          <button 
            onClick={() => setSubCatFilter("All Sub-Categories")}
            style={{ 
              padding: '6px 14px', 
              borderRadius: '20px', 
              border: '1px solid #cbd5e1', 
              background: subCatFilter === "All Sub-Categories" ? '#0f172a' : '#f8fafc', 
              color: subCatFilter === "All Sub-Categories" ? '#fff' : '#334155', 
              fontSize: '13px', 
              fontWeight: 500,
              cursor: 'pointer', 
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            All Sub-Categories
          </button>
          {dbSubCategories.filter(sc => sc.category_name === cat).map(sc => (
            <button
              key={sc.id}
              onClick={() => setSubCatFilter(sc.name)}
              style={{ 
                padding: '6px 14px', 
                borderRadius: '20px', 
                border: '1px solid #cbd5e1', 
                background: subCatFilter === sc.name ? '#0f172a' : '#f8fafc', 
                color: subCatFilter === sc.name ? '#fff' : '#334155', 
                fontSize: '13px', 
                fontWeight: 500,
                cursor: 'pointer', 
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {sc.name}
            </button>
          ))}
        </div>
      )}
        <div>
          {shown.slice(0, 7).map((p) => {
            const status = stockBadge(p.stock_quantity, Number(p.reorder_level || 10));
            return (
              <article key={p.id}>
                {showIcons && <ProductCategoryIcon category={p.category} productName={p.name} className="product-card-icon" colored />}
                <b>{p.name}</b>
                <small>SKU: {p.sku}</small>
                {/* <small style={{ color: '#64748b', fontSize: '0.8em', marginTop: '-4px', marginBottom: '4px' }}>
                  {p.category} {p.sub_category && `> ${p.sub_category}`}
                </small> */}
                <em className={status.className}>{status.label}</em>
                <strong>
                  Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </strong>
              </article>
            );
          })}
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
            Showing {shown.length === 0 ? 0 : (activePage - 1) * itemsPerPage + 1} to {Math.min(activePage * itemsPerPage, shown.length)} of {shown.length} products{" "}
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={activePage === 1} aria-label="Previous page">
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - activePage) <= 1)
              .map((p, i, arr) => {
                const isDots = i > 0 && arr[i - 1] !== p - 1;
                return (
                  <span key={p}>
                    {isDots && <button disabled>...</button>}
                    <button className={activePage === p ? "active" : ""} onClick={() => setCurrentPage(p)}>
                      {p}
                    </button>
                  </span>
                );
              })
            }
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={activePage === totalPages} aria-label="Next page">
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </p>
          <div style={{ display: 'inline-block', position: 'relative', marginLeft: '12px' }}>
            <button onClick={() => setShowCols(!showCols)} className="gold-btn columns-button">
              <Columns3 size={15} aria-hidden="true" /> Columns
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
                      <ProductCategoryIcon category={p.category} productName={p.name} className="table-product-icon" colored />
                      <b>{p.name}</b>
                    </td>
                  )}
                  {cols.sku && <td>{p.sku}</td>}
                  {cols.cat && (
                    <td>
                      <div>{p.category}</div>
                      <small style={{ color: "#64748b" }}>{p.sub_category}</small>
                    </td>
                  )}
                  {cols.brand && <td>{p.brand}</td>}
                  {cols.pack && <td>{isLooseOil(p) ? `Loose Oil / ${p.unit || "L"}` : "1 Unit"}</td>}
                  {cols.price && (
                    <td>
                      Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      {isLooseOil(p) ? " / L" : ""}
                    </td>
                  )}
                  {cols.status && (
                    <td className="product-stock-status-cell">
                      <em className={stockBadge(p.stock_quantity, Number(p.reorder_level || 10)).className}>{stockBadge(p.stock_quantity, Number(p.reorder_level || 10)).label}</em>
                      <small>{formatQty(p.stock_quantity, p.unit)}</small>
                    </td>
                  )}
                  {cols.actions && (
                    <td className="table-actions-cell product-actions-cell">
                      <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button className="delete" onClick={() => del(p.id)} aria-label={`Delete ${p.name}`}>
                        <Trash2 size={15} aria-hidden="true" />
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
          <form className="product-modal-form" onSubmit={add}>
            <header>
              <h2>
                <ProductCategoryIcon category={form.category} productName={form.name} className="modal-title-icon" colored />
                {editId ? "Edit Product" : "Add New Product"}
              </h2>
              <button type="button" onClick={() => { setShow(false); setEditId(null); }}>
                <X size={22} aria-label="Close" />
              </button>
            </header>
            
            <div className="product-form-grid product-form-grid-primary">
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

            <div className="product-form-grid product-form-grid-two">
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
                Sub-Category
                {!isNewSubCat ? (
                  <select
                    value={form.sub_category}
                    onChange={(e) => {
                      if (e.target.value === "++NEW++") {
                        setIsNewSubCat(true);
                        setForm({ ...form, sub_category: "" });
                      } else {
                        setForm({ ...form, sub_category: e.target.value });
                      }
                    }}
                    style={{ border: '1px solid #dfe2e5', borderRadius: '7px', padding: '11px', font: 'inherit', width: '100%', outline: 'none' }}
                  >
                    <option value="" disabled>Select a sub-category</option>
                    {dbSubCategories.filter(sc => sc.category_name === form.category).map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
                    <option value="++NEW++">+ Create New Sub-Category...</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      required
                      autoFocus
                      value={form.sub_category}
                      onChange={(e) => setForm({ ...form, sub_category: e.target.value })}
                      placeholder="Type new sub-category..."
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => { setIsNewSubCat(false); setForm({ ...form, sub_category: "General" }) }} style={{ padding: '0 10px', border: '1px solid #ccc', borderRadius: '7px', background: '#fff' }}>✕</button>
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

            <div className="product-form-grid product-form-grid-three">
              <label>
                Product Type
                <select
                  value={form.product_type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setForm({
                      ...form,
                      product_type: nextType,
                      unit: nextType === "loose_oil" ? "L" : "Unit",
                      reorder_level: nextType === "loose_oil" && form.reorder_level === "10" ? "20" : form.reorder_level,
                      barrel_capacity_liters: nextType === "loose_oil" ? (form.barrel_capacity_liters || "200") : "",
                    });
                  }}
                  style={{ border: '1px solid #dfe2e5', borderRadius: '7px', padding: '11px', font: 'inherit', width: '100%', outline: 'none' }}
                >
                  <option value="packaged">Packaged Item</option>
                  <option value="loose_oil">Loose Oil</option>
                </select>
              </label>
              <label>
                Unit
                <input
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  readOnly={form.product_type === "loose_oil"}
                  placeholder="Unit"
                />
              </label>
              <label>
                Barrel Capacity (L)
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.barrel_capacity_liters}
                  onChange={(e) => setForm({ ...form, barrel_capacity_liters: e.target.value })}
                  disabled={form.product_type !== "loose_oil"}
                  placeholder="200"
                />
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

            <div className="product-form-grid product-form-grid-three">
              <label>
                {form.product_type === "loose_oil" ? "Selling Price / L (Rs.)" : "Price (Rs.)"}
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
                Initial Stock {form.product_type === "loose_oil" ? "(Liters)" : "(Quantity)"}
                <input
                  required
                  type="number"
                  min="0"
                  step={form.product_type === "loose_oil" ? "0.001" : "1"}
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
              </label>
              <label>
                Reorder Level {form.product_type === "loose_oil" ? "(L)" : ""}
                <input
                  required
                  type="number"
                  min="0"
                  step={form.product_type === "loose_oil" ? "0.001" : "1"}
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
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
