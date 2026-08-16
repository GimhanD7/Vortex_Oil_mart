"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, PackagePlus, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type Product = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  product_type?: "packaged" | "loose_oil" | string;
  unit?: string;
  barrel_capacity_liters?: number | string | null;
  sku?: string;
  supplier?: string;
};

type Purchase = {
  id: number;
  supplier: string;
  payment_method: string;
  total_amount: string;
  status: string;
  item_count: number;
  created_by: string | null;
  created_at: string;
  notes?: string | null;
};

type PurchaseItem = {
  id: number;
  product_id: number;
  product_name: string;
  sku?: string;
  quantity: number;
  purchase_unit?: string;
  barrel_count?: number | string | null;
  barrel_capacity_liters?: number | string | null;
  product_type?: string;
  unit?: string;
  unit_cost: string;
};

type PurchaseLine = {
  product_id: number | "";
  quantity: number;
  unit_cost: number;
  barrel_count: number;
  barrel_capacity_liters: number;
};

const blankLine: PurchaseLine = { product_id: "", quantity: 1, unit_cost: 0, barrel_count: 1, barrel_capacity_liters: 200 };
const paymentMethods = ["Cash", "Card", "UPI", "Bank Transfer", "Credit"];

function money(value: string | number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function isLooseOil(product?: Pick<Product, "product_type" | "unit">) {
  return product?.product_type === "loose_oil" || (product?.unit || "").toLowerCase() === "l";
}

function formatQty(value: string | number, unit = "Unit") {
  const quantity = Number(value || 0);
  const formatted = Number.isInteger(quantity)
    ? quantity.toLocaleString("en-IN")
    : quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return `${formatted} ${unit || "Unit"}`;
}

export default function PurchasesPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([{ ...blankLine }]);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([]);
  const [editing, setEditing] = useState<Purchase | null>(null);

  const lineQuantity = useCallback((line: PurchaseLine) => {
    const product = products.find((item) => item.id === Number(line.product_id));
    if (isLooseOil(product)) {
      return Number(line.barrel_count || 0) * Number(line.barrel_capacity_liters || product?.barrel_capacity_liters || 200);
    }
    return Number(line.quantity || 0);
  }, [products]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineQuantity(line) * Number(line.unit_cost || 0), 0), [lineQuantity, lines]);
  const receivedThisMonth = purchases
    .filter((purchase) => purchase.status !== "cancelled")
    .reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);

  const load = useCallback(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => Array.isArray(data) && setProducts(data))
      .catch(() => {});

    fetch("/api/purchases", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => Array.isArray(data) && setPurchases(data))
      .catch(() => showToast({ type: "error", title: "Purchases failed", message: "Unable to load purchases." }));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateLine = (index: number, patch: Partial<PurchaseLine>) => {
    setLines((current) => current.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, ...patch };
      if (patch.product_id) {
        const product = products.find((item) => item.id === Number(patch.product_id));
        if (product && !line.unit_cost) next.unit_cost = Number(product.price);
        if (product && isLooseOil(product)) {
          next.barrel_capacity_liters = Number(product.barrel_capacity_liters || 200);
          next.quantity = Number(product.barrel_capacity_liters || 200);
        }
      }
      return next;
    }));
  };

  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier,
        payment_method: paymentMethod,
        notes,
        items: lines.filter((line) => line.product_id).map((line) => ({
          product_id: Number(line.product_id),
          quantity: lineQuantity(line),
          barrel_count: isLooseOil(products.find((product) => product.id === Number(line.product_id))) ? Number(line.barrel_count) : null,
          barrel_capacity_liters: isLooseOil(products.find((product) => product.id === Number(line.product_id))) ? Number(line.barrel_capacity_liters) : null,
          unit_cost: Number(line.unit_cost),
        })),
      }),
    });
    const data = await response.json();
    setSaving(false);
    showToast({
      type: response.ok ? "success" : "error",
      title: response.ok ? "Purchase saved" : "Purchase failed",
      message: data.message || data.error || "Purchase saved.",
    });
    if (response.ok) {
      setSupplier("");
      setPaymentMethod("Cash");
      setNotes("");
      setLines([{ ...blankLine }]);
      setShowForm(false);
      load();
    }
  };

  const exportPurchases = () => {
    const rows = [
      ["Purchase No", "Date", "Supplier", "Payment Method", "Items", "Total", "Status"],
      ...purchases.map((purchase) => [
        `PUR-${String(purchase.id).padStart(6, "0")}`,
        new Date(purchase.created_at).toLocaleString(),
        purchase.supplier,
        purchase.payment_method,
        String(purchase.item_count || 0),
        String(purchase.total_amount),
        purchase.status,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "oil-mart-purchases.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const viewPurchase = async (purchase: Purchase) => {
    setSelected(purchase);
    setSelectedItems([]);
    const response = await fetch(`/api/purchases/${purchase.id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setSelected(data.purchase || purchase);
      setSelectedItems(Array.isArray(data.items) ? data.items : []);
    } else {
      showToast({ type: "error", title: "Purchase details failed", message: data.error || "Unable to load purchase details." });
    }
  };

  const openEdit = (purchase: Purchase) => {
    setEditing(purchase);
    setSupplier(purchase.supplier || "");
    setPaymentMethod(purchase.payment_method || "Cash");
    setNotes(purchase.notes || "");
  };

  const updatePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    const response = await fetch(`/api/purchases/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier, payment_method: paymentMethod, notes }),
    });
    const data = await response.json();
    setSaving(false);
    showToast({
      type: response.ok ? "success" : "error",
      title: response.ok ? "Purchase updated" : "Update failed",
      message: data.message || data.error || "Purchase updated.",
    });
    if (response.ok) {
      setEditing(null);
      setSupplier("");
      setPaymentMethod("Cash");
      setNotes("");
      load();
    }
  };

  const executeCancelPurchase = async (purchase: Purchase) => {
    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const data = await response.json();
    showToast({
      type: response.ok ? "success" : "error",
      title: response.ok ? "Purchase cancelled" : "Cancel failed",
      message: data.message || data.error || "Purchase cancelled.",
    });
    if (response.ok) load();
  };

  const cancelPurchase = (purchase: Purchase) => {
    showToast({
      type: "warning",
      title: "Cancel purchase?",
      message: "Received stock will be reversed if this purchase is cancelled.",
      duration: 0,
      actionLabel: "Cancel purchase",
      onAction: () => void executeCancelPurchase(purchase),
    });
  };

  const executeDeletePurchase = async (purchase: Purchase) => {
    const response = await fetch(`/api/purchases/${purchase.id}`, { method: "DELETE" });
    const data = await response.json();
    showToast({
      type: response.ok ? "success" : "error",
      title: response.ok ? "Purchase deleted" : "Delete failed",
      message: data.message || data.error || "Purchase deleted.",
    });
    if (response.ok) load();
  };

  const deletePurchase = (purchase: Purchase) => {
    showToast({
      type: "warning",
      title: "Delete purchase?",
      message: "This permanently deletes the purchase and reverses received stock if needed.",
      duration: 0,
      actionLabel: "Delete",
      onAction: () => void executeDeletePurchase(purchase),
    });
  };

  return (
    <div className="management-page purchases-page">
      <div className="management-heading">
        <div>
          <h1>Purchase Management</h1>
          <p>Dashboard / Purchases</p>
        </div>
        <aside>
          <button onClick={exportPurchases}><Download size={15} aria-hidden="true" /> Export</button>
          <button className="gold-btn" onClick={() => setShowForm(true)}><PackagePlus size={15} aria-hidden="true" /> New Purchase</button>
        </aside>
      </div>

      <section className="purchase-kpis">
        <article><small>Purchase Entries</small><b>{purchases.length}</b><em>All received orders</em></article>
        <article><small>This Month Purchase Value</small><b>{money(receivedThisMonth)}</b><em>Received stock value</em></article>
        <article><small>Available Products</small><b>{products.length}</b><em>Ready for purchase entry</em></article>
      </section>

      <section className="management-table">
        <header>
          <h2>Purchase History</h2>
        </header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Purchase No.</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Payment Method</th>
                <th>Items</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td><b>PUR-{String(purchase.id).padStart(6, "0")}</b></td>
                  <td>{new Date(purchase.created_at).toLocaleString()}</td>
                  <td>{purchase.supplier}</td>
                  <td>{purchase.payment_method}</td>
                  <td>{purchase.item_count || 0}</td>
                  <td>{money(purchase.total_amount)}</td>
                  <td><em className={purchase.status === "cancelled" ? "out" : ""}>{purchase.status}</em></td>
                  <td className="purchase-actions">
                    <button onClick={() => viewPurchase(purchase)} aria-label="View purchase"><Eye size={15} aria-hidden="true" /></button>
                    <button onClick={() => openEdit(purchase)} aria-label="Edit purchase"><Pencil size={15} aria-hidden="true" /></button>
                    <button onClick={() => cancelPurchase(purchase)} disabled={purchase.status === "cancelled"} aria-label="Cancel purchase"><RotateCcw size={15} aria-hidden="true" /></button>
                    <button onClick={() => deletePurchase(purchase)} aria-label="Delete purchase"><Trash2 size={15} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="management-modal">
          <form className="purchase-modal-form" onSubmit={savePurchase}>
            <header>
              <h2>New Purchase</h2>
              <button type="button" onClick={() => setShowForm(false)}><X size={22} aria-label="Close" /></button>
            </header>
            <div>
              <label>Supplier<input required value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Supplier name" /></label>
              <label>
                Payment Method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
            </div>
            <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional purchase notes" /></label>

            <section className="purchase-lines">
              <header>
                <h3>Purchase Items</h3>
                <button type="button" onClick={() => setLines((current) => [...current, { ...blankLine }])}><Plus size={14} aria-hidden="true" /> Add Line</button>
              </header>
              {lines.map((line, index) => (
                <div key={index} className={isLooseOil(products.find((product) => product.id === Number(line.product_id))) ? "loose-purchase-line" : ""}>
                  <select required value={line.product_id} onChange={(event) => updateLine(index, { product_id: event.target.value ? Number(event.target.value) : "" })}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku || `SKU-${product.id}`}){isLooseOil(product) ? " / Loose Oil" : ""}</option>)}
                  </select>
                  {isLooseOil(products.find((product) => product.id === Number(line.product_id))) ? (
                    <>
                      <input type="number" min={0.001} step="0.001" required value={line.barrel_count} onChange={(event) => updateLine(index, { barrel_count: Number(event.target.value) })} title="Barrel count" placeholder="Barrels" />
                      <input type="number" min={0.001} step="0.001" required value={line.barrel_capacity_liters} onChange={(event) => updateLine(index, { barrel_capacity_liters: Number(event.target.value) })} title="Liters per barrel" placeholder="L / Barrel" />
                    </>
                  ) : (
                    <input type="number" min={1} step={1} required value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} />
                  )}
                  <input type="number" min={0} step="0.01" required value={line.unit_cost} onChange={(event) => updateLine(index, { unit_cost: Number(event.target.value) })} />
                  <strong>
                    {money(lineQuantity(line) * Number(line.unit_cost || 0))}
                    <small>{formatQty(lineQuantity(line), isLooseOil(products.find((product) => product.id === Number(line.product_id))) ? "L" : "Unit")} received</small>
                  </strong>
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><Trash2 size={15} aria-hidden="true" /></button>
                </div>
              ))}
            </section>

            <footer>
              <strong className="purchase-total">Total: {money(total)}</strong>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="gold-btn" disabled={saving}>{saving ? "Saving..." : "Receive Stock"}</button>
            </footer>
          </form>
        </div>
      )}

      {editing && (
        <div className="management-modal">
          <form className="purchase-modal-form compact" onSubmit={updatePurchase}>
            <header>
              <h2>Edit Purchase</h2>
              <button type="button" onClick={() => setEditing(null)}><X size={22} aria-label="Close" /></button>
            </header>
            <div>
              <label>Supplier<input required value={supplier} onChange={(event) => setSupplier(event.target.value)} /></label>
              <label>
                Payment Method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
            </div>
            <label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            <footer>
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="gold-btn" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </footer>
          </form>
        </div>
      )}

      {selected && (
        <div className="management-modal">
          <form className="purchase-modal-form purchase-view-form">
            <header>
              <h2>PUR-{String(selected.id).padStart(6, "0")}</h2>
              <button type="button" onClick={() => setSelected(null)}><X size={22} aria-label="Close" /></button>
            </header>
            <section className="purchase-detail">
              <p><small>Supplier</small><b>{selected.supplier}</b></p>
              <p><small>Payment Method</small><b>{selected.payment_method}</b></p>
              <p><small>Status</small><b>{selected.status}</b></p>
              <p><small>Total</small><b>{money(selected.total_amount)}</b></p>
            </section>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Received From</th><th>Unit Cost</th><th>Total</th></tr></thead>
                <tbody>
                  {selectedItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.sku || `SKU-${item.product_id}`}</td>
                      <td>{formatQty(item.quantity, item.purchase_unit || item.unit || "Unit")}</td>
                      <td>{item.barrel_count && item.barrel_capacity_liters ? `${item.barrel_count} barrel x ${item.barrel_capacity_liters}L` : "-"}</td>
                      <td>{money(item.unit_cost)}</td>
                      <td>{money(Number(item.unit_cost) * Number(item.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
