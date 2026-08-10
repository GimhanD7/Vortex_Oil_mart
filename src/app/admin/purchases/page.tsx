"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, PackagePlus, Plus, Trash2, X } from "lucide-react";

type Product = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
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
};

type PurchaseLine = {
  product_id: number | "";
  quantity: number;
  unit_cost: number;
};

const blankLine: PurchaseLine = { product_id: "", quantity: 1, unit_cost: 0 };
const paymentMethods = ["Cash", "Card", "UPI", "Bank Transfer", "Credit"];

function money(value: string | number) {
  return `Rs. ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [supplier, setSupplier] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([{ ...blankLine }]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0), [lines]);
  const receivedThisMonth = purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount), 0);

  const load = () => {
    fetch("/api/products", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => Array.isArray(data) && setProducts(data))
      .catch(() => {});

    fetch("/api/purchases", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => Array.isArray(data) && setPurchases(data))
      .catch(() => setMessage("Unable to load purchases."));
  };

  useEffect(() => {
    load();
  }, []);

  const updateLine = (index: number, patch: Partial<PurchaseLine>) => {
    setLines((current) => current.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, ...patch };
      if (patch.product_id) {
        const product = products.find((item) => item.id === Number(patch.product_id));
        if (product && !line.unit_cost) next.unit_cost = Number(product.price);
      }
      return next;
    }));
  };

  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier,
        payment_method: paymentMethod,
        notes,
        items: lines.filter((line) => line.product_id).map((line) => ({
          product_id: Number(line.product_id),
          quantity: Number(line.quantity),
          unit_cost: Number(line.unit_cost),
        })),
      }),
    });
    const data = await response.json();
    setSaving(false);
    setMessage(data.message || data.error || "Purchase saved.");
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

      {message && <div className="user-error">{message}<button onClick={() => setMessage("")}>×</button></div>}

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
                  <td><em>{purchase.status}</em></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="management-modal">
          <form onSubmit={savePurchase}>
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
                <div key={index}>
                  <select required value={line.product_id} onChange={(event) => updateLine(index, { product_id: event.target.value ? Number(event.target.value) : "" })}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku || `SKU-${product.id}`})</option>)}
                  </select>
                  <input type="number" min={1} required value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} />
                  <input type="number" min={0} step="0.01" required value={line.unit_cost} onChange={(event) => updateLine(index, { unit_cost: Number(event.target.value) })} />
                  <strong>{money(Number(line.quantity || 0) * Number(line.unit_cost || 0))}</strong>
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
    </div>
  );
}
