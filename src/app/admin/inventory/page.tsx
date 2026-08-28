"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedFetch } from "@/lib/api-client";
import { ProductCategoryIcon } from "@/components/ProductCategoryIcon";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Columns3,
  IndianRupee,
  MapPinHouse,
  MoreVertical,
  Package,
  PackageX,
  Pencil,
  Plus,
  SlidersHorizontal,
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
  monthly_in?: number;
  monthly_out?: number;
  monthly_start_stock?: number;
};

type MovementSummary = {
  transactions: number;
  total_inward: number;
  total_outward: number;
};

type InventoryMovement = {
  id: number;
  product_name: string;
  unit?: string | null;
  movement_type: string;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  unit_price: string;
  reference_no: string | null;
  created_at: string;
};

function formatQty(value: string | number, unit = "Unit") {
  const quantity = Number(value || 0);
  const formatted = Number.isInteger(quantity)
    ? quantity.toLocaleString("en-IN")
    : quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return `${formatted} ${unit || "Unit"}`;
}

function stockState(product: Pick<Product, "stock_quantity" | "reorder_level">) {
  const stock = Number(product.stock_quantity || 0);
  const reorder = Number(product.reorder_level || 10);
  if (stock <= 0) return { className: "out", label: "Out of Stock" };
  if (stock <= reorder) return { className: "low", label: "Low Stock" };
  return { className: "", label: "In Stock" };
}

export default function InventoryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ role: string; permissions: string[] } | null>(null);
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
  const [cols, setCols] = useState({ check: true, prod: true, sku: true, cat: true, start_stock: true, monthly_in: true, monthly_out: true, stock: true, reorder: true, loc: true, batch: true, price: true, supplier: true, status: true, updated: true, actions: true });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openActions, setOpenActions] = useState<number | null>(null);

  const canManage = currentUser?.role === "admin" || currentUser?.permissions?.includes("manage_inventory") || false;

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.ok && r.json())
      .then((d) => d && setCurrentUser(d))
      .catch(() => {});
  }, []);

  const loadMovements = useCallback(() => {
    const params = new URLSearchParams({ limit: "6" });
    if (movementType !== "all") params.set("type", movementType);
    if (movementProduct !== "all") params.set("product_id", movementProduct);
    if (movementFrom) params.set("date_from", movementFrom);
    if (movementTo) params.set("date_to", movementTo);

    cachedFetch(`/api/inventory/movements?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setMovements(d))
      .catch(() => setMovements([]));
  }, [movementFrom, movementProduct, movementTo, movementType]);

  const load = useCallback(() => {
    cachedFetch("/api/inventory")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) {
          setProducts(
            d.items.map((p: Product) => ({
              ...p,
              sku: p.sku || `SKU-${String(p.id).padStart(3, "0")}`,
              category: p.category || "General",
              brand: p.brand || "Generic",
              product_type: p.product_type || "packaged",
              unit: p.unit || "Unit",
              supplier: p.supplier || p.brand || "Not Assigned",
              location: p.location || "Main Store",
              stock_quantity: Number(p.stock_quantity || 0),
              reorder_level: Number(p.reorder_level || 10),
              monthly_in: Number(p.monthly_in || 0),
              monthly_out: Number(p.monthly_out || 0),
              monthly_start_stock: Number(p.monthly_start_stock || 0),
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

    if (canManage) loadMovements();
  }, [canManage, loadMovements]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canManage) loadMovements();
  }, [canManage, loadMovements]);

  const shown = useMemo(() => {
    return products.filter(
      (p) =>
        (tab === "All Items" ||
          (tab === "Low Stock" && p.stock_quantity > 0 && p.stock_quantity <= Number(p.reorder_level || 10)) ||
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
  const visibleCols = {
    ...cols,
    check: canManage && cols.check,
    actions: canManage && cols.actions,
  };
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
  const low = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= Number(p.reorder_level || 10)).length;
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
    ...(!canManage ? [] : [
      {
        label: "Total Stock Value",
        value: `Rs. ${stockValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        summary: "At selling price",
        Icon: IndianRupee,
        tone: "blue",
      },
    ]),
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

  const globalStartStock = products.reduce((sum, p) => sum + (p.monthly_start_stock || 0), 0);
  const globalMonthlyIn = products.reduce((sum, p) => sum + (p.monthly_in || 0), 0);
  const globalMonthlyOut = products.reduce((sum, p) => sum + (p.monthly_out || 0), 0);
  const globalCurrentStock = products.reduce((sum, p) => sum + Number(p.stock_quantity), 0);

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

        {canManage && (
          <section className="inventory-stats analysis-grid" style={{ marginTop: "1rem" }}>
            <div>
              <small>Monthly Start Stock (Units)</small>
              <b>{globalStartStock}</b>
            </div>
            <div>
              <small>Stock Increases (In)</small>
              <b className="good">+{globalMonthlyIn}</b>
            </div>
            <div>
              <small>Stock Decreases (Out)</small>
              <b className="bad">-{globalMonthlyOut}</b>
            </div>
            <div>
              <small>Monthly End Stock (Current)</small>
              <b>{globalCurrentStock}</b>
            </div>
          </section>
        )}

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
            {canManage && (
              <button className="gold-btn" onClick={() => router.push("/admin/products")}>
                <Plus size={15} aria-hidden="true" /> Add Stock
              </button>
            )}
            {canManage && (
              <button onClick={() => { if(products.length > 0) setAdjust(products[0]) }}><SlidersHorizontal size={15} aria-hidden="true" /> Stock Adjustment</button>
            )}
            <div className="inventory-column-picker">
              <button onClick={() => setShowCols(!showCols)} style={{ marginLeft: '4px', height: '34px', padding: '0 12px' }}><Columns3 size={15} aria-hidden="true" /> Columns</button>
              {showCols && (
                <div className="column-menu">
                  {canManage && <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.check} onChange={(e) => setCols({...cols, check: e.target.checked})} /> Checkbox</label>}
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.prod} onChange={(e) => setCols({...cols, prod: e.target.checked})} /> Product</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.sku} onChange={(e) => setCols({...cols, sku: e.target.checked})} /> SKU / Barcode</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.cat} onChange={(e) => setCols({...cols, cat: e.target.checked})} /> Category / Brand</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.start_stock} onChange={(e) => setCols({...cols, start_stock: e.target.checked})} /> Start Stock</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.monthly_in} onChange={(e) => setCols({...cols, monthly_in: e.target.checked})} /> Stock In</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.monthly_out} onChange={(e) => setCols({...cols, monthly_out: e.target.checked})} /> Stock Out</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.stock} onChange={(e) => setCols({...cols, stock: e.target.checked})} /> Current Stock</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.reorder} onChange={(e) => setCols({...cols, reorder: e.target.checked})} /> Reorder Level</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.loc} onChange={(e) => setCols({...cols, loc: e.target.checked})} /> Location</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.batch} onChange={(e) => setCols({...cols, batch: e.target.checked})} /> Batch No.</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.price} onChange={(e) => setCols({...cols, price: e.target.checked})} /> Unit Price</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.supplier} onChange={(e) => setCols({...cols, supplier: e.target.checked})} /> Supplier</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.status} onChange={(e) => setCols({...cols, status: e.target.checked})} /> Status</label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.updated} onChange={(e) => setCols({...cols, updated: e.target.checked})} /> Last Updated</label>
                  {canManage && <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={cols.actions} onChange={(e) => setCols({...cols, actions: e.target.checked})} /> Actions</label>}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {visibleCols.check && (
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
                {visibleCols.prod && <th>Item Details</th>}
                {visibleCols.sku && <th>SKU / Barcode</th>}
                {visibleCols.cat && <th>Category / Brand</th>}
                {visibleCols.start_stock && <th style={{ textAlign: 'right' }}>Start Stock</th>}
                {visibleCols.monthly_in && <th style={{ textAlign: 'right' }}>In</th>}
                {visibleCols.monthly_out && <th style={{ textAlign: 'right' }}>Out</th>}
                {visibleCols.stock && <th>Current Stock</th>}
                {visibleCols.reorder && <th>Reorder Level</th>}
                {visibleCols.loc && <th>Location</th>}
                {visibleCols.batch && <th>Batch No.</th>}
                {visibleCols.price && <th>Unit Price</th>}
                {visibleCols.supplier && <th>Supplier</th>}
                {visibleCols.status && <th>Status</th>}
                {visibleCols.updated && <th>Last Updated</th>}
                {visibleCols.actions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedShown.map((p, i) => (
                <tr key={p.id} className={stockState(p).className === "low" ? "warning-row" : ""}>
                  {visibleCols.check && (
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
                  {visibleCols.prod && (
                    <td className="inventory-product-cell">
                      <ProductCategoryIcon category={p.category} productName={p.name} className="table-product-icon" />
                      <b>{p.name}</b>
                      <small>{p.brand}</small>
                    </td>
                  )}
                  {visibleCols.sku && (
                    <td className="inventory-sku-cell">
                      <b>{p.sku}</b>
                      <small>8901040900{String(i).padStart(3, "0")}</small>
                    </td>
                  )}
                  {visibleCols.cat && (
                    <td className="inventory-category-cell">
                      <b>{p.category}</b>
                      <small>{p.brand}</small>
                    </td>
                  )}
                  {visibleCols.start_stock && <td style={{ textAlign: 'right' }}>{p.monthly_start_stock}</td>}
                  {visibleCols.monthly_in && <td style={{ textAlign: 'right', color: '#16a34a' }}>+{p.monthly_in}</td>}
                  {visibleCols.monthly_out && <td style={{ textAlign: 'right', color: '#dc2626' }}>-{p.monthly_out}</td>}
                  {visibleCols.stock && (
                    <td>
                      <b className={stockState(p).className === "" ? "success" : "danger"}>
                        {formatQty(p.stock_quantity, p.unit)}
                      </b>
                      <small className={stockState(p).className === "" ? "success" : "danger"}>
                        {stockState(p).label}
                      </small>
                    </td>
                  )}
                  {visibleCols.reorder && <td>{p.reorder_level || 10}</td>}
                  {visibleCols.loc && <td>{p.location || "Main Store"}</td>}
                  {visibleCols.batch && <td>{p.batch_no || "-"}</td>}
                  {visibleCols.price && (
                    <td>
                      Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  {visibleCols.supplier && <td>{p.supplier || p.brand}</td>}
                  {visibleCols.status && (
                    <td>
                      <em
                        className={stockState(p).className}
                      >
                        {stockState(p).label}
                      </em>
                    </td>
                  )}
                  {visibleCols.updated && (
                    <td>
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                      {p.updated_at && <small>{new Date(p.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small>}
                    </td>
                  )}
                  {visibleCols.actions && (
                    <td className="inventory-actions-cell">
                      {canManage && (
                        <button onClick={() => setAdjust(p)} aria-label={`Adjust ${p.name}`}>
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      )}
                      <button onClick={() => setOpenActions((current) => current === p.id ? null : p.id)} aria-label={`More actions for ${p.name}`}>
                        <MoreVertical size={15} aria-hidden="true" />
                      </button>
                      {openActions === p.id && (
                        <div className="inventory-action-menu">
                          {canManage && <button onClick={() => router.push(`/admin/products?edit=${p.id}`)}>Edit product</button>}
                          {canManage && <button onClick={() => { setMovementProduct(String(p.id)); setOpenActions(null); }}>View movements</button>}
                          {canManage && <button onClick={() => { setAdjust(p); setOpenActions(null); }}>Adjust stock</button>}
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

      {canManage && (
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
                  {movement.quantity_change > 0 ? "+" : ""}{formatQty(movement.quantity_change, movement.unit || "Unit")}
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
              .filter((p) => stockState(p).className === "low")
              .slice(0, 4)
              .map((p) => (
                <div key={p.id}>
                  <ProductCategoryIcon category={p.category} productName={p.name} className="table-product-icon" />
                  <p>
                    <b>{p.name}</b>
                    <small>
                      Current: {formatQty(p.stock_quantity, p.unit)} | Reorder: {formatQty(p.reorder_level || 10, p.unit)}
                    </small>
                  </p>
                  <em>Low Stock</em>
                </div>
              ))}
          </article>
        </section>
      )}

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
              <small>Current stock: {formatQty(adjust.stock_quantity, adjust.unit)}</small>
            </p>
            <label>
              Adjustment quantity
              <input
                type="number"
                required
                step={adjust.unit === "L" ? "0.001" : "1"}
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
