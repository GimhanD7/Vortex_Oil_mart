"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, Download, Eye, Printer, RotateCcw, X } from "lucide-react";

type Sale = {
  id: number;
  subtotal_amount?: string;
  discount_rate?: string;
  discount_amount?: string;
  tax_rate?: string;
  tax_amount?: string;
  cash_received?: string | null;
  cash_balance?: string | null;
  sales_cycle_id?: string | null;
  opening_cash_balance?: string | null;
  business_date?: string | null;
  total_amount: string;
  payment_method: string;
  status: string;
  created_at: string;
  cashier_name: string | null;
  customer_name: string | null;
  item_count: number;
};

type SaleItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  price_at_time: string;
};

const paymentMethods = ["All Payment Methods", "Cash", "Card", "Wallet", "Bank Transfer", "Credit"];
const statuses = ["All Status", "Completed", "Refunded", "Cancelled"];

function money(value: string | number) {
  return `Rs. ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function downloadFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showCols, setShowCols] = useState(false);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    cashier: "All Cashiers",
    payment: "All Payment Methods",
    status: "All Status",
  });
  const [cols, setCols] = useState({ inv: true, date: true, cashier: true, cust: true, pay: true, items: true, total: true, status: true, actions: true });

  const cashiers = useMemo(() => ["All Cashiers", ...Array.from(new Set(sales.map((sale) => sale.cashier_name || "Admin")))], [sales]);
  const total = sales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

  const loadSales = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("date_from", filters.from);
    if (filters.to) params.set("date_to", filters.to);
    if (filters.cashier !== "All Cashiers") params.set("cashier", filters.cashier);
    if (filters.payment !== "All Payment Methods") params.set("payment_method", filters.payment);
    if (filters.status !== "All Status") params.set("status", filters.status);

    fetch(`/api/sales?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSales(data);
          setSelected((current) => data.find((sale) => sale.id === current?.id) || data[0] || null);
        }
      })
      .catch(() => setMessage("Unable to load sales."))
      .finally(() => showLoading && setLoading(false));
  }, [filters]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => loadSales(), 0);
    const timer = window.setInterval(() => loadSales(false), 15000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [loadSales]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    fetch(`/api/sales/${selected.id}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSaleItems(Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []))
      .catch(() => setSaleItems([]));
  }, [selected]);

  const exportSales = () => {
    const rows = [
      ["Invoice No", "Date", "Cashier", "Customer", "Payment Method", "Items", "Total", "Status"],
      ...sales.map((sale) => [
        `INV-${String(sale.id).padStart(6, "0")}`,
        new Date(sale.created_at).toLocaleString(),
        sale.cashier_name || "Admin",
        sale.customer_name || "Walk-in Customer",
        sale.payment_method || "Cash",
        String(sale.item_count || 0),
        String(sale.total_amount),
        sale.status || "completed",
      ]),
    ];
    downloadFile("oil-mart-sales.csv", rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  };

  const exportInvoice = () => {
    if (!selected) return;
    const payload = { invoice: selected, items: saleItems };
    downloadFile(`invoice-${selected.id}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const refundInvoice = async () => {
    if (!selected || selected.status === "refunded") return;
    if (!confirm(`Refund invoice INV-${String(selected.id).padStart(6, "0")}? Stock will be returned.`)) return;
    const response = await fetch(`/api/sales/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refund" }),
    });
    const data = await response.json();
    setMessage(data.message || data.error || "Refund action completed.");
    if (response.ok) loadSales();
  };

  return (
    <div className="sales-history">
      <div className="sales-title">
        <h1>Sales History &amp; Invoice Management</h1>
        <p>Sales / Sales History &amp; Invoices</p>
      </div>

      {message && <div className="user-error">{message}<button onClick={() => setMessage("")}>×</button></div>}

      <div className="sales-layout">
        <section>
          <div className="sales-filters">
            <h2>Filters</h2>
            <label>
              From
              <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
            </label>
            <label>
              To
              <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
            </label>
            <label>
              Cashier
              <select value={filters.cashier} onChange={(event) => setFilters({ ...filters, cashier: event.target.value })}>
                {cashiers.map((cashier) => <option key={cashier}>{cashier}</option>)}
              </select>
            </label>
            <label>
              Payment Method
              <select value={filters.payment} onChange={(event) => setFilters({ ...filters, payment: event.target.value })}>
                {paymentMethods.map((method) => <option key={method}>{method}</option>)}
              </select>
            </label>
            <label>
              Order Status
              <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <footer>
              <button onClick={() => setFilters({ from: "", to: "", cashier: "All Cashiers", payment: "All Payment Methods", status: "All Status" })}>Reset Filters</button>
              <button className="gold-btn" onClick={() => loadSales()}>{loading ? "Loading..." : "Apply Filters"}</button>
            </footer>
          </div>

          <div className="sales-table">
            <header style={{ position: "relative", zIndex: 10 }}>
              <div><small>Total Invoices</small><b>{sales.length}</b></div>
              <div><small>Total Sales</small><b>{money(total)}</b></div>
              <div><small>Average Order Value</small><b>{money(total / Math.max(sales.length, 1))}</b></div>
              <aside style={{ position: "relative", display: "flex", gap: "8px" }}>
                <button onClick={exportSales}><Download size={15} aria-hidden="true" /> Export</button>
                <button onClick={() => setShowCols(!showCols)}><Columns3 size={15} aria-hidden="true" /> Columns</button>
                {showCols && (
                  <div className="column-menu">
                    {Object.entries({ inv: "Invoice No.", date: "Date & Time", cashier: "Cashier", cust: "Customer", pay: "Payment Method", items: "Items", total: "Total Amount", status: "Status", actions: "Actions" }).map(([key, label]) => (
                      <label key={key}><input type="checkbox" checked={cols[key as keyof typeof cols]} onChange={(event) => setCols({ ...cols, [key]: event.target.checked })} /> {label}</label>
                    ))}
                  </div>
                )}
              </aside>
            </header>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {cols.inv && <th>Invoice No.</th>}
                    {cols.date && <th>Date &amp; Time</th>}
                    {cols.cashier && <th>Cashier</th>}
                    {cols.cust && <th>Customer</th>}
                    {cols.pay && <th>Payment Method</th>}
                    {cols.items && <th>Items</th>}
                    {cols.total && <th>Total Amount</th>}
                    {cols.status && <th>Status</th>}
                    {cols.actions && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} onClick={() => setSelected(sale)} className={selected?.id === sale.id ? "selected" : ""}>
                      {cols.inv && <td><b>INV-{String(sale.id).padStart(6, "0")}</b></td>}
                      {cols.date && <td>{new Date(sale.created_at).toLocaleString()}</td>}
                      {cols.cashier && <td>{sale.cashier_name || "Admin"}</td>}
                      {cols.cust && <td>{sale.customer_name || "Walk-in Customer"}</td>}
                      {cols.pay && <td>{sale.payment_method || "Cash"}</td>}
                      {cols.items && <td>{sale.item_count || 0}</td>}
                      {cols.total && <td>{money(sale.total_amount)}</td>}
                      {cols.status && <td><em className={sale.status === "refunded" ? "refund" : sale.status === "cancelled" ? "cancel" : ""}>{sale.status || "completed"}</em></td>}
                      {cols.actions && (
                        <td>
                          <button aria-label="View invoice" onClick={(event) => { event.stopPropagation(); setSelected(sale); }}><Eye size={15} aria-hidden="true" /></button>
                          <button aria-label="Print invoice" onClick={(event) => { event.stopPropagation(); setSelected(sale); setTimeout(() => window.print(), 50); }}><Printer size={15} aria-hidden="true" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>Showing {sales.length === 0 ? 0 : 1} to {sales.length} of {sales.length} invoices</footer>
          </div>
        </section>

        {selected && (
          <aside className="invoice-preview">
            <header>
              <h2>Invoice Preview</h2>
              <button onClick={() => setSelected(null)}><X size={20} aria-label="Close" /></button>
            </header>
            <div className="preview-paper">
              <div className="preview-brand">
                <h3>OIL <b>MART</b></h3>
                <p>Oil &amp; Spare Parts Store<br />123, Industrial Area, New Delhi</p>
              </div>
              <dl>
                {[
                  ["Invoice No.", `INV-${String(selected.id).padStart(6, "0")}`],
                  ["Date", new Date(selected.created_at).toLocaleString()],
                  ["Business Date", selected.business_date ? new Date(selected.business_date).toLocaleDateString() : new Date(selected.created_at).toLocaleDateString()],
                  ["Sales Cycle", selected.sales_cycle_id || "-"],
                  ["Cashier", selected.cashier_name || "Admin"],
                  ["Customer", selected.customer_name || "Walk-in Customer"],
                  ["Payment Method", selected.payment_method || "Cash"],
                  ["Status", selected.status || "completed"],
                ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
              <table>
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                  {!saleItems.length && <tr><td colSpan={4} style={{ textAlign: "center", padding: "10px" }}>No item rows found.</td></tr>}
                  {saleItems.map((item) => (
                    <tr key={`${item.product_id}-${item.product_name}`}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.price_at_time)}</td>
                      <td>{money(Number(item.price_at_time) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="preview-total">
                <p>Subtotal <b>{money(selected.subtotal_amount || selected.total_amount)}</b></p>
                <p>Discount ({Number(selected.discount_rate || 0)}%) <b>- {money(selected.discount_amount || 0)}</b></p>
                <p>Tax ({Number(selected.tax_rate || 0)}% GST) <b>{money(selected.tax_amount || 0)}</b></p>
                {selected.payment_method === "Cash" && (
                  <>
                    <p>Cash Received <b>{money(selected.cash_received || 0)}</b></p>
                    <p>Balance Returned <b>{money(selected.cash_balance || 0)}</b></p>
                  </>
                )}
                <h3>Total <b>{money(selected.total_amount)}</b></h3>
              </div>
              <p className="thanks">Thank you for your visit!<br />Drive safe. Stay protected.</p>
            </div>
            <footer>
              <button onClick={() => window.print()}><Printer size={15} aria-hidden="true" /> Print</button>
              <button onClick={exportInvoice}><Download size={15} aria-hidden="true" /> Export</button>
              <button className="danger" onClick={refundInvoice} disabled={selected.status === "refunded"}><RotateCcw size={15} aria-hidden="true" /> Refund</button>
            </footer>
          </aside>
        )}
      </div>
    </div>
  );
}
