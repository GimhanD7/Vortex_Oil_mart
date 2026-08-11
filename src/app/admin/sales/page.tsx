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

function invoiceNo(saleId: number) {
  return `INV-${String(saleId).padStart(6, "0")}`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReceiptHtml(sale: Sale, items: SaleItem[]) {
  const subtotal = money(sale.subtotal_amount || sale.total_amount);
  const discount = money(sale.discount_amount || 0);
  const tax = money(sale.tax_amount || 0);
  const total = money(sale.total_amount);
  const invoice = invoiceNo(sale.id);
  const itemRows = items.length
    ? items.map((item) => `
        <tr>
          <td>${escapeHtml(item.product_name)}</td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(money(item.price_at_time))}</td>
          <td>${escapeHtml(money(Number(item.price_at_time) * item.quantity))}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4" class="empty">No item rows found.</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice)} Receipt</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: "Courier New", monospace; font-size: 11px; }
    .receipt { width: 72mm; margin: 0 auto; padding: 4mm 0; }
    .brand { text-align: center; border-bottom: 1px dashed #9ca3af; padding-bottom: 10px; margin-bottom: 10px; }
    .brand h1 { margin: 0 0 4px; font: 800 20px Arial, sans-serif; letter-spacing: 0; }
    .brand h1 span { color: #eaa600; }
    .brand p { margin: 0; line-height: 1.45; }
    .meta { border-bottom: 1px dashed #9ca3af; padding-bottom: 8px; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; gap: 10px; margin: 5px 0; }
    .row b { text-align: right; font-weight: 700; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { border-bottom: 1px dashed #9ca3af; padding: 5px 2px; text-align: left; }
    td { border-bottom: 1px dotted #d1d5db; padding: 6px 2px; vertical-align: top; }
    th:nth-child(n+2), td:nth-child(n+2) { text-align: right; }
    td:first-child { text-align: left; }
    .empty { text-align: center !important; color: #6b7280; }
    .totals { border-top: 1px dashed #9ca3af; margin-top: 9px; padding-top: 7px; }
    .total { border-top: 1px dashed #9ca3af; padding-top: 7px; margin-top: 7px; font-size: 15px; font-weight: 800; }
    .thanks { text-align: center; margin-top: 14px; line-height: 1.5; color: #475569; }
    @media screen {
      body { background: #f3f4f6; padding: 16px; }
      .receipt { background: #fff; box-shadow: 0 12px 35px #0002; padding: 8mm; }
    }
  </style>
</head>
<body>
  <main class="receipt">
    <section class="brand">
      <h1>OIL <span>MART</span></h1>
      <p>Oil &amp; Spare Parts Store<br />123, Industrial Area, New Delhi</p>
    </section>
    <section class="meta">
      <div class="row"><span>Invoice No.</span><b>${escapeHtml(invoice)}</b></div>
      <div class="row"><span>Date</span><b>${escapeHtml(new Date(sale.created_at).toLocaleString())}</b></div>
      <div class="row"><span>Business Date</span><b>${escapeHtml(sale.business_date ? new Date(sale.business_date).toLocaleDateString() : new Date(sale.created_at).toLocaleDateString())}</b></div>
      <div class="row"><span>Sales Cycle</span><b>${escapeHtml(sale.sales_cycle_id || "-")}</b></div>
      <div class="row"><span>Cashier</span><b>${escapeHtml(sale.cashier_name || "Admin")}</b></div>
      <div class="row"><span>Customer</span><b>${escapeHtml(sale.customer_name || "Walk-in Customer")}</b></div>
      <div class="row"><span>Payment</span><b>${escapeHtml(sale.payment_method || "Cash")}</b></div>
      <div class="row"><span>Status</span><b>${escapeHtml(sale.status || "completed")}</b></div>
    </section>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <section class="totals">
      <div class="row"><span>Subtotal</span><b>${escapeHtml(subtotal)}</b></div>
      <div class="row"><span>Discount (${escapeHtml(Number(sale.discount_rate || 0))}%)</span><b>- ${escapeHtml(discount)}</b></div>
      <div class="row"><span>Tax (${escapeHtml(Number(sale.tax_rate || 0))}% GST)</span><b>${escapeHtml(tax)}</b></div>
      ${sale.payment_method === "Cash" ? `
        <div class="row"><span>Cash Received</span><b>${escapeHtml(money(sale.cash_received || 0))}</b></div>
        <div class="row"><span>Balance Returned</span><b>${escapeHtml(money(sale.cash_balance || 0))}</b></div>
      ` : ""}
      <div class="row total"><span>Total</span><b>${escapeHtml(total)}</b></div>
    </section>
    <p class="thanks">Thank you for your visit!<br />Drive safe. Stay protected.</p>
  </main>
</body>
</html>`;
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

  const loadSaleItems = useCallback(async (saleId: number) => {
    const response = await fetch(`/api/sales/${saleId}`, { cache: "no-store" });
    const data = await response.json();
    const rows = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
    setSaleItems(rows);
    return rows as SaleItem[];
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }

    setSaleItems([]);
    loadSaleItems(selected.id)
      .catch(() => setSaleItems([]));
  }, [loadSaleItems, selected]);

  const printReceipt = async (sale = selected) => {
    if (!sale) return;
    setSelected(sale);
    const items = await loadSaleItems(sale.id).catch(() => []);
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) {
      setMessage("Please allow pop-ups to print the receipt.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(sale, items));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const downloadReceipt = async () => {
    if (!selected) return;
    const items = await loadSaleItems(selected.id).catch(() => []);
    downloadFile(`${invoiceNo(selected.id)}-receipt.html`, buildReceiptHtml(selected, items), "text/html");
  };

  const exportSales = () => {
    const rows = [
      ["Invoice No", "Date", "Cashier", "Customer", "Payment Method", "Items", "Total", "Status"],
      ...sales.map((sale) => [
        invoiceNo(sale.id),
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

  const refundInvoice = async () => {
    if (!selected || selected.status === "refunded") return;
    if (!confirm(`Refund invoice ${invoiceNo(selected.id)}? Stock will be returned.`)) return;
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
                      {cols.inv && <td><b>{invoiceNo(sale.id)}</b></td>}
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
                          <button aria-label="Print invoice" onClick={(event) => { event.stopPropagation(); void printReceipt(sale); }}><Printer size={15} aria-hidden="true" /></button>
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
            <div className="preview-paper printable-invoice sales-print-receipt">
              <div className="preview-brand">
                <h3>OIL <b>MART</b></h3>
                <p>Oil &amp; Spare Parts Store<br />123, Industrial Area, New Delhi</p>
              </div>
              <dl>
                {[
                  ["Invoice No.", invoiceNo(selected.id)],
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
              <button onClick={() => void printReceipt()}><Printer size={15} aria-hidden="true" /> Print</button>
              <button onClick={() => void downloadReceipt()}><Download size={15} aria-hidden="true" /> Download Receipt</button>
              <button className="danger" onClick={refundInvoice} disabled={selected.status === "refunded"}><RotateCcw size={15} aria-hidden="true" /> Refund</button>
            </footer>
          </aside>
        )}
      </div>
    </div>
  );
}
