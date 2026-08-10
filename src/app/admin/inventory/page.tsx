"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Armchair,
  BatteryCharging,
  Box,
  CircleStop,
  CloudRain,
  Cog,
  Columns3,
  Filter,
  IndianRupee,
  Lightbulb,
  Link,
  MapPinHouse,
  MoreVertical,
  Package,
  PackageX,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
  Zap,
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  sku?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  reorder_level?: number;
  location?: string;
  batch_no?: string | null;
  supplier?: string;
  updated_at?: string;
  visual?: string;
};

type MovementSummary = {
  transactions: number;
  total_inward: number;
  total_outward: number;
};

type InventoryMovement = {
  id: number;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  unit_price: string;
  reference_no: string | null;
  created_at: string;
};

function CategoryIcon({ category, className = "" }: { category: string; className?: string }) {
  const props = { className: className || "table-product-icon", "aria-hidden": true, size: 22, strokeWidth: 1.9 };
  const c = category.toLowerCase();
  if (c.includes("engine") || c.includes("oil")) return <Package {...props} />;
  if (c.includes("gear") || c.includes("lubricant") || c.includes("grease")) return <Cog {...props} />;
  if (c.includes("filter")) return <Filter {...props} />;
  if (c.includes("brake") || c.includes("pad") || c.includes("shoe")) return <CircleStop {...props} />;
  if (c.includes("batter")) return <BatteryCharging {...props} />;
  if (c.includes("spark") || c.includes("ignition") || c.includes("plug")) return <Zap {...props} />;
  if (c.includes("coolant") || c.includes("radiator") || c.includes("wiper") || c.includes("wash")) return <CloudRain {...props} />;
  if (c.includes("bulb") || c.includes("light") || c.includes("lamp")) return <Lightbulb {...props} />;
  if (c.includes("tire") || c.includes("tyre") || c.includes("wheel")) return <CircleStop {...props} />;
  if (c.includes("belt") || c.includes("chain")) return <Link {...props} />;
  if (c.includes("suspension") || c.includes("shock") || c.includes("spring") || c.includes("tool") || c.includes("equipment")) return <Wrench {...props} />;
  if (c.includes("polish") || c.includes("wax") || c.includes("cleaner") || c.includes("shampoo")) return <Sparkles {...props} />;
  if (c.includes("accessory") || c.includes("mat") || c.includes("cover")) return <Armchair {...props} />;
  return <Box {...props} />;
}

export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState("All Items");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [locationFilter, setLocationFilter] = useState("All Locations");
  const [supplierFilter, setSupplierFilter] = useState("All Suppliers");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [movementSummary, setMovementSummary] = useState<MovementSummary>({ transactions: 0, total_inward: 0, total_outward: 0 });
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [movementType, setMovementType] = useState("all");
  const [movementProduct, setMovementProduct] = useState("all");
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [showCols, setShowCols] = useState(false);
  const [cols, setCols] = useState({ check: true, prod: true, sku: true, cat: true, stock: true, reorder: true, loc: true, batch: true, price: true, supplier: true, status: true, updated: true, actions: true });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openActions, setOpenActions] = useState<number | null>(null);

  const loadMovements = useCallback(() => {
    const params = new URLSearchParams({ limit: "6" });
    if (movementType !== "all") params.set("type", movementType);
    if (movementProduct !== "all") params.set("product_id", movementProduct);
    if (movementFrom) params.set("date_from", movementFrom);
    if (movementTo) params.set("date_to", movementTo);

    fetch(`/api/inventory/movements?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setMovements(d))
      .catch(() => setMovements([]));
  }, [movementFrom, movementProduct, movementTo, movementType]);

  const load = useCallback(() => {
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
              supplier: p.supplier || p.brand || "Not Assigned",
              location: p.location || "Main Store",
              reorder_level: Number(p.reorder_level || 10),
            }))
          );
        }
        if (d.movements) {
          setMovementSummary({
            transactions: Number(d.movements.transactions || 0),
            total_inward: Number(d.movements.total_inward || 0),
            total_outward: Number(d.movements.total_outward || 0),
          });
        }
      })
      .catch(() => {});

    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  const shown = useMemo(() => {
    return products.filter(
      (p) =>
        (tab === "All Items" ||
          (tab === "Low Stock" && p.stock_quantity > 0 && p.stock_quantity < 10) ||
          (tab === "Out of Stock" && p.stock_quantity === 0) ||
          (tab === "Expiring Soon" && false)) &&
        (catFilter === "All Categories" || p.category === catFilter) &&
        (locationFilter === "All Locations" || p.location === locationFilter) &&
        (supplierFilter === "All Suppliers" || p.supplier === supplierFilter)
    );
  }, [products, tab, catFilter, locationFilter, supplierFilter]);

  const categories = useMemo(() => {
    const c = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All Categories", ...Array.from(c)] as string[];
  }, [products]);
  const locations = useMemo(() => ["All Locations", ...Array.from(new Set(products.map((p) => p.location).filter(Boolean))) as string[]], [products]);
  const suppliers = useMemo(() => ["All Suppliers", ...Array.from(new Set(products.map((p) => p.supplier).filter(Boolean))) as string[]], [products]);

  const totalPages = Math.max(1, Math.ceil(shown.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedShown = shown.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);
  const visibleIds = paginatedShown.map((product) => product.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

  const toggleVisibleSelection = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visibleIds]));
      return current.filter((id) => !visibleIds.includes(id));
    });
  };

  const toggleProductSelection = (id: number, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  };

  const stockValue = products.reduce((s, p) => s + Number(p.price) * p.stock_quantity, 0);
  const low = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 10).length;
  const out = products.filter((p) => !p.stock_quantity).length;
  const netMovement = movementSummary.total_inward - movementSummary.total_outward;
  const kpiCards = [
    {
      label: "Total Items",
      value: products.length,
      summary: "All products & parts",
      Icon: Package,
      tone: "purple",
    },
    {
      label: "Total Stock Value",
      value: `Rs. ${stockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      summary: "At selling price",
      Icon: IndianRupee,
      tone: "blue",
    },
    {
      label: "Low Stock Items",
      value: low,
      summary: "Reorder recommended",
      Icon: AlertTriangle,
      tone: "orange",
    },
    {
      label: "Out of Stock Items",
      value: out,
      summary: "Currently unavailable",
      Icon: PackageX,
      tone: "red",
    },
    {
      label: "Stock Locations",
      value: 4,
      summary: "Warehouses / Stores",
      Icon: MapPinHouse,
      tone: "green",
    },
  ];

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
      load();
    }
    
    setSaving(false);
    setAdjust(null);
    setAmount(0);
  };

  return (
    <div className="management-page inventory-page">
      <div className="inventory-title">
        <h1>
          <Package className="section-title-icon" size={25} aria-hidden="true" /> Inventory <span>/ Stock Management</span>
        </h1>
      </div>

      <section className="inventory-kpis">
        {kpiCards.map(({ label, value, summary, Icon, tone }) => (
          <article key={label}>
            <p>
              <small>{label}</small>
              <b>{value}</b>
              <em>{summary}</em>
            </p>
            <span className={tone}>
              <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
            </span>
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
                  {c}
                </option>
              ))}
            </select>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              {locations.map((location) => <option key={location}>{location}</option>)}
            </select>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
              {suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}
            </select>
            <button className="gold-btn" onClick={() => router.push("/admin/products")}>
              <Plus size={15} aria-hidden="true" /> Add Stock
            </button>
            <button onClick={() => { if(products.length > 0) setAdjust(products[0]) }}><SlidersHorizontal size={15} aria-hidden="true" /> Stock Adjustment</button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowCols(!showCols)} style={{ marginLeft: '4px', height: '34px', padding: '0 12px' }}><Columns3 size={15} aria-hidden="true" /> Columns</button>
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
                {cols.check && (
                  <th className="select-cell">
                    <input
                      type="checkbox"
                      className="inventory-row-checkbox"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = !allVisibleSelected && someVisibleSelected;
                      }}
                      onChange={(event) => toggleVisibleSelection(event.target.checked)}
                      aria-label="Select all visible inventory items"
                    />
                  </th>
                )}
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
                  {cols.check && (
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        className="inventory-row-checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={(event) => toggleProductSelection(p.id, event.target.checked)}
                        aria-label={`Select ${p.name}`}
                      />
                    </td>
                  )}
                  {cols.prod && (
                    <td>
                      <CategoryIcon category={p.category || "General"} />
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
                  {cols.reorder && <td>{p.reorder_level || 10}</td>}
                  {cols.loc && <td>{p.location || "Main Store"}</td>}
                  {cols.batch && <td>{p.batch_no || "-"}</td>}
                  {cols.price && (
                    <td>
                      Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {cols.supplier && <td>{p.supplier || p.brand}</td>}
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
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                      {p.updated_at && <small>{new Date(p.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>}
                    </td>
                  )}
                  {cols.actions && (
                    <td className="inventory-actions-cell">
                      <button onClick={() => setAdjust(p)} aria-label={`Adjust ${p.name}`}>
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button onClick={() => setOpenActions((current) => current === p.id ? null : p.id)} aria-label={`More actions for ${p.name}`}>
                        <MoreVertical size={15} aria-hidden="true" />
                      </button>
                      {openActions === p.id && (
                        <div className="inventory-action-menu">
                          <button onClick={() => router.push(`/admin/products?edit=${p.id}`)}>Edit product</button>
                          <button onClick={() => { setMovementProduct(String(p.id)); setOpenActions(null); }}>View movements</button>
                          <button onClick={() => { setAdjust(p); setOpenActions(null); }}>Adjust stock</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer>
          Showing {shown.length === 0 ? 0 : (activePage - 1) * itemsPerPage + 1} to {Math.min(activePage * itemsPerPage, shown.length)} of {shown.length} items
          <p>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={activePage === 1}>{"<"}</button>
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
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={activePage === totalPages}>{">"}</button>
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
              <b className="success">Rs. {movementSummary.total_inward.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
            </p>
            <p>
              <small>Total Outward</small>
              <b className="danger">Rs. {movementSummary.total_outward.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
            </p>
            <p>
              <small>Net Movement</small>
              <b className="blue-text">Rs. {netMovement.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
            </p>
            <p>
              <small>Transactions</small>
              <b>{movementSummary.transactions}</b>
            </p>
          </div>
        </article>

        <article className="stock-chart movement-list">
          <h2>Recent Inventory Movement</h2>
          <div className="movement-filters">
            <select value={movementType} onChange={(event) => setMovementType(event.target.value)}>
              <option value="all">All Movements</option>
              <option value="in">Inward</option>
              <option value="out">Outward</option>
              <option value="adjustment">Adjustment</option>
            </select>
            <select value={movementProduct} onChange={(event) => setMovementProduct(event.target.value)}>
              <option value="all">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <input type="date" value={movementFrom} onChange={(event) => setMovementFrom(event.target.value)} />
            <input type="date" value={movementTo} onChange={(event) => setMovementTo(event.target.value)} />
          </div>
          {movements.map((movement) => (
            <div key={movement.id}>
              <p>
                <b>{movement.product_name}</b>
                <small>{movement.reference_no || movement.movement_type} / {new Date(movement.created_at).toLocaleString()}</small>
              </p>
              <strong className={movement.quantity_change > 0 ? "success" : "danger"}>
                {movement.quantity_change > 0 ? "+" : ""}{movement.quantity_change}
              </strong>
            </div>
          ))}
          {!movements.length && <p className="empty-movement">No movement history yet.</p>}
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
                <CategoryIcon category={p.category || "General"} />
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
                <X size={22} aria-label="Close" />
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
