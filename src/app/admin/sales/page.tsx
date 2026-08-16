"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns3, Download, Eye, Printer, RotateCcw, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

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
  unit?: string | null;
  product_type?: string | null;
};

type DailySoldItem = {
  product_id: number;
  product_name: string;
  sku: string | null;
  category: string | null;
  unit?: string | null;
  product_type?: string | null;
  quantity: string | number;
  total_amount: string | number;
  invoice_count: string | number;
};

type DailySoldSummary = {
  date: string;
  product_count: number;
  quantity: number;
  total_amount: number;
  invoice_count: number;
};

type InvoiceSettings = {
  store_name: string;
  store_address: string;
  store_phone: string;
  gst_number: string;
  invoice_prefix: string;
  invoice_footer: string;
};

type RefundApproval = {
  reason: string;
  approver_username: string;
  approver_pin: string;
};

type TransactionLog = {
  id: number;
  sale_id: number | null;
  action_type: string;
  reason: string;
  affected_amount: string | number;
  metadata: string | null;
  created_at: string;
  cashier_name: string | null;
  approver_name: string | null;
  sale_status: string | null;
  payment_method: string | null;
  total_amount: string | number | null;
  sale_created_at: string | null;
  customer_name: string | null;
};

const defaultInvoiceSettings: InvoiceSettings = {
  store_name: "Oil Mart",
  store_address: "123, Industrial Area, New Delhi",
  store_phone: "",
  gst_number: "",
  invoice_prefix: "INV",
  invoice_footer: "Thank you for your visit. Drive safe. Stay protected.",
};

const paymentMethods = ["All Payment Methods", "Cash", "Card", "Wallet", "Bank Transfer", "Credit"];
const statuses = ["All Status", "Completed", "Refunded", "Voided", "Cancelled"];
const refundReasons = [
  "Sale was completed accidentally",
  "Duplicate transaction was created",
  "Payment succeeded but the wrong items were billed",
  "Wrong return item selected",
  "Incorrect refund quantity or amount",
  "Customer decides not to return the product",
  "Other correction",
];

function money(value: string | number) {
  return `Rs. ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function formatQty(value: string | number, unit = "Unit") {
  const quantity = Number(value || 0);
  const formatted = Number.isInteger(quantity)
    ? quantity.toLocaleString("en-IN")
    : quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return `${formatted} ${unit || "Unit"}`;
}

function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function invoiceNo(saleId: number, settings: InvoiceSettings) {
  return `${settings.invoice_prefix || "INV"}-${String(saleId).padStart(6, "0")}`;
}

function actionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataSummary(metadata: string | null) {
  if (!metadata) return "";
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
      .join(" / ");
  } catch {
    return metadata;
  }
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlWithBreaks(value: string | number | null | undefined) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function brandNameParts(storeName: string) {
  const words = (storeName || defaultInvoiceSettings.store_name).trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { primary: (words[0] || "OIL").toUpperCase(), accent: "" };
  }
  const accent = words[words.length - 1];
  return {
    primary: words.slice(0, -1).join(" ").toUpperCase(),
    accent: accent.toUpperCase(),
  };
}

function buildReceiptHtml(sale: Sale, items: SaleItem[], settings: InvoiceSettings) {
  const subtotal = money(sale.subtotal_amount || sale.total_amount);
  const discount = money(sale.discount_amount || 0);
  const total = money(sale.total_amount);
  const invoice = invoiceNo(sale.id, settings);
  const storeName = settings.store_name || defaultInvoiceSettings.store_name;
  const storeAddress = settings.store_address || defaultInvoiceSettings.store_address;
  const storePhone = settings.store_phone;
  const footer = settings.invoice_footer || defaultInvoiceSettings.invoice_footer;
  const brand = brandNameParts(storeName);
  const brandTitle = `${escapeHtml(brand.primary)}${brand.accent ? ` <span>${escapeHtml(brand.accent)}</span>` : ""}`;
  const itemRows = items.length
    ? items.map((item) => `
        <tr>
          <td>${escapeHtml(item.product_name)}</td>
          <td>${escapeHtml(formatQty(item.quantity, item.unit || "Unit"))}</td>
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
      <h1>${brandTitle}</h1>
      <p>
        Oil &amp; Spare Parts Store<br />
        ${escapeHtmlWithBreaks(storeAddress)}
        ${storePhone ? `<br />Phone: ${escapeHtml(storePhone)}` : ""}
      </p>
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
      ${sale.payment_method === "Cash" ? `
        <div class="row"><span>Cash Received</span><b>${escapeHtml(money(sale.cash_received || 0))}</b></div>
        <div class="row"><span>Balance Returned</span><b>${escapeHtml(money(sale.cash_balance || 0))}</b></div>
      ` : ""}
      <div class="row total"><span>Total</span><b>${escapeHtml(total)}</b></div>
    </section>
    <p class="thanks">${escapeHtmlWithBreaks(footer)}</p>
  </main>
</body>
</html>`;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [activeTab, setActiveTab] = useState<"sales" | "logs">("sales");
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings>(defaultInvoiceSettings);
  const [itemSummaryDate, setItemSummaryDate] = useState(dateInputValue());
  const [itemSummaryLoading, setItemSummaryLoading] = useState(false);
  const [dailyItems, setDailyItems] = useState<DailySoldItem[]>([]);
  const [refundApprovalOpen, setRefundApprovalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState(refundReasons[0]);
  const [refundNotes, setRefundNotes] = useState("");
  const [approverUsername, setApproverUsername] = useState("");
  const [approverPin, setApproverPin] = useState("");
  const [refundSaving, setRefundSaving] = useState(false);
  const [dailySummary, setDailySummary] = useState<DailySoldSummary>({
    date: dateInputValue(),
    product_count: 0,
    quantity: 0,
    total_amount: 0,
    invoice_count: 0,
  });
  const { showToast } = useToast();
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
  const previewBrand = brandNameParts(settings.store_name || defaultInvoiceSettings.store_name);
  const selectedLogs = useMemo(
    () => selected ? transactionLogs.filter((log) => Number(log.sale_id) === selected.id) : [],
    [selected, transactionLogs]
  );

  const loadDailyItems = useCallback(async (date: string) => {
    setItemSummaryLoading(true);
    try {
      const response = await fetch(`/api/sales/items?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load selling items");

      setDailyItems(Array.isArray(data.items) ? data.items : []);
      setDailySummary({
        date: data.summary?.date || date,
        product_count: Number(data.summary?.product_count || 0),
        quantity: Number(data.summary?.quantity || 0),
        total_amount: Number(data.summary?.total_amount || 0),
        invoice_count: Number(data.summary?.invoice_count || 0),
      });
    } catch (error) {
      setDailyItems([]);
      setDailySummary({ date, product_count: 0, quantity: 0, total_amount: 0, invoice_count: 0 });
      const message = error instanceof Error ? error.message : "Unable to load selling items";
      showToast({ type: "error", title: "Selling items failed", message });
    } finally {
      setItemSummaryLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSettings({ ...defaultInvoiceSettings, ...data }))
      .catch(() => setSettings(defaultInvoiceSettings));
  }, []);

  useEffect(() => {
    void loadDailyItems(itemSummaryDate);
  }, [itemSummaryDate, loadDailyItems]);

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
      .catch(() => showToast({ type: "error", title: "Sales failed", message: "Unable to load sales." }))
      .finally(() => showLoading && setLoading(false));
  }, [filters, showToast]);

  const loadTransactionLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const response = await fetch("/api/sales/revocations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load transaction logs");
      setTransactionLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast({ type: "error", title: "Logs failed", message: error instanceof Error ? error.message : "Unable to load transaction logs." });
    } finally {
      setLogsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => loadSales(), 0);
    const timer = window.setInterval(() => loadSales(false), 15000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
    };
  }, [loadSales]);

  useEffect(() => {
    void loadTransactionLogs();
  }, [loadTransactionLogs]);

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
      showToast({ type: "warning", title: "Print blocked", message: "Please allow pop-ups to print the receipt." });
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(sale, items, settings));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const downloadReceipt = async () => {
    if (!selected) return;
    const items = await loadSaleItems(selected.id).catch(() => []);
    downloadFile(`${invoiceNo(selected.id, settings)}-receipt.html`, buildReceiptHtml(selected, items, settings), "text/html");
  };

  const exportSales = () => {
    const rows = [
      ["Invoice No", "Date", "Cashier", "Customer", "Payment Method", "Items", "Total", "Status"],
      ...sales.map((sale) => [
        invoiceNo(sale.id, settings),
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

  const executeRefundInvoice = async (approval: RefundApproval) => {
    if (!selected || selected.status === "refunded") return;
    const response = await fetch(`/api/sales/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refund", ...approval }),
    });
    const data = await response.json();
    showToast({
      type: response.ok ? "success" : "error",
      title: response.ok ? "Refund completed" : "Refund failed",
      message: data.message || data.error || "Refund action completed.",
    });
    if (response.ok) {
      setRefundApprovalOpen(false);
      setApproverUsername("");
      setApproverPin("");
      setRefundNotes("");
      loadSales();
      void loadTransactionLogs();
    }
  };

  const refundInvoice = () => {
    if (!selected || selected.status === "refunded") return;
    setRefundReason(refundReasons[0]);
    setRefundNotes("");
    setApproverUsername("");
    setApproverPin("");
    setRefundApprovalOpen(true);
  };

  const confirmRefundInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !refundReason || !approverUsername.trim() || !approverPin) {
      showToast({ type: "warning", title: "Approval required", message: "Select a reason and enter supervisor/admin approval." });
      return;
    }

    setRefundSaving(true);
    const reason = refundNotes.trim() ? `${refundReason} - ${refundNotes.trim()}` : refundReason;
    try {
      await executeRefundInvoice({
        reason,
        approver_username: approverUsername.trim(),
        approver_pin: approverPin,
      });
    } finally {
      setRefundSaving(false);
    }
  };

  return (
    <div className="sales-history">
      <div className="sales-title">
        <h1>Sales History &amp; Invoice Management</h1>
        <p>Sales / Sales History &amp; Invoices</p>
      </div>

      <div className="sales-view-tabs">
        <button className={activeTab === "sales" ? "active" : ""} onClick={() => setActiveTab("sales")}>
          Sales History
        </button>
        <button className={activeTab === "logs" ? "active" : ""} onClick={() => { setActiveTab("logs"); void loadTransactionLogs(); }}>
          Transaction Logs
          <span>{transactionLogs.length}</span>
        </button>
      </div>

      {activeTab === "sales" ? (
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

          <div className="daily-items-card">
            <header>
              <div>
                <h2>Daily Selling Items</h2>
                <p>Product quantities sold for the selected business date</p>
              </div>
              <label>
                Date
                <input type="date" value={itemSummaryDate} onChange={(event) => setItemSummaryDate(event.target.value)} />
              </label>
              <button onClick={() => void loadDailyItems(itemSummaryDate)} disabled={itemSummaryLoading}>
                {itemSummaryLoading ? "Loading..." : "Show Items"}
              </button>
            </header>

            <section>
              <p><small>Invoices</small><b>{dailySummary.invoice_count}</b></p>
              <p><small>Products</small><b>{dailySummary.product_count}</b></p>
              <p><small>Qty Sold</small><b>{Number(dailySummary.quantity || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</b></p>
              <p><small>Sales Value</small><b>{money(dailySummary.total_amount)}</b></p>
            </section>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Category</th>
                    <th>Qty</th>
                    <th>Sales Value</th>
                    <th>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyItems.map((item) => (
                    <tr key={item.product_id}>
                      <td><b>{item.product_name}</b></td>
                      <td><small>{item.sku || "No SKU"}{item.category ? ` / ${item.category}` : ""}</small></td>
                      <td>{formatQty(item.quantity || 0, item.unit || "Unit")}</td>
                      <td>{money(item.total_amount || 0)}</td>
                      <td>{Number(item.invoice_count || 0)}</td>
                    </tr>
                  ))}
                  {!dailyItems.length && !itemSummaryLoading && (
                    <tr>
                      <td colSpan={5}>No selling items found for {dailySummary.date}.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                      {cols.inv && <td><b>{invoiceNo(sale.id, settings)}</b></td>}
                      {cols.date && <td>{new Date(sale.created_at).toLocaleString()}</td>}
                      {cols.cashier && <td>{sale.cashier_name || "Admin"}</td>}
                      {cols.cust && <td>{sale.customer_name || "Walk-in Customer"}</td>}
                      {cols.pay && <td>{sale.payment_method || "Cash"}</td>}
                      {cols.items && <td>{sale.item_count || 0}</td>}
                      {cols.total && <td>{money(sale.total_amount)}</td>}
                      {cols.status && <td><em className={sale.status === "refunded" ? "refund" : sale.status === "cancelled" || sale.status === "voided" ? "cancel" : ""}>{sale.status || "completed"}</em></td>}
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
                <h3>
                  {previewBrand.primary}
                  {previewBrand.accent && <> <b>{previewBrand.accent}</b></>}
                </h3>
                <p>
                  <span>Oil &amp; Spare Parts Store<br /></span>
                  {(settings.store_address || defaultInvoiceSettings.store_address).split(/\r?\n/).map((line, index) => (
                    <span key={`${line}-${index}`}>{line}<br /></span>
                  ))}
                  {settings.store_phone && <span>Phone: {settings.store_phone}<br /></span>}
                </p>
              </div>
              <dl>
                {[
                  ["Invoice No.", invoiceNo(selected.id, settings)],
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
                      <td>{formatQty(item.quantity, item.unit || "Unit")}</td>
                      <td>{money(item.price_at_time)}</td>
                      <td>{money(Number(item.price_at_time) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="preview-total">
                <p>Subtotal <b>{money(selected.subtotal_amount || selected.total_amount)}</b></p>
                <p>Discount ({Number(selected.discount_rate || 0)}%) <b>- {money(selected.discount_amount || 0)}</b></p>
                {selected.payment_method === "Cash" && (
                  <>
                    <p>Cash Received <b>{money(selected.cash_received || 0)}</b></p>
                    <p>Balance Returned <b>{money(selected.cash_balance || 0)}</b></p>
                  </>
                )}
                <h3>Total <b>{money(selected.total_amount)}</b></h3>
              </div>
              {selectedLogs.length > 0 && (
                <section className="invoice-audit-note">
                  <h3>Revocation Log</h3>
                  {selectedLogs.map((log) => (
                    <article key={log.id}>
                      <b>{actionLabel(log.action_type)}</b>
                      <p>{log.reason}</p>
                      <small>
                        {new Date(log.created_at).toLocaleString()} / Cashier: {log.cashier_name || "Unknown"}
                        {log.approver_name ? ` / Approved by: ${log.approver_name}` : ""}
                      </small>
                    </article>
                  ))}
                </section>
              )}
              <p className="thanks">{settings.invoice_footer || defaultInvoiceSettings.invoice_footer}</p>
            </div>
            <footer>
              <button onClick={() => void printReceipt()}><Printer size={15} aria-hidden="true" /> Print</button>
              <button onClick={() => void downloadReceipt()}><Download size={15} aria-hidden="true" /> Download Receipt</button>
              <button className="danger" onClick={refundInvoice} disabled={selected.status === "refunded" || selected.status === "voided" || selected.status === "cancelled"}><RotateCcw size={15} aria-hidden="true" /> Refund</button>
            </footer>
          </aside>
        )}
      </div>
      ) : (
        <section className="transaction-log-panel">
          <header>
            <div>
              <h2>Transaction Logs</h2>
              <p>Void, refund, payment, discount, and cart correction audit records</p>
            </div>
            <button onClick={() => void loadTransactionLogs()} disabled={logsLoading}>
              {logsLoading ? "Loading..." : "Refresh Logs"}
            </button>
          </header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Invoice</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>Cashier</th>
                  <th>Approver</th>
                  <th>Affected Amount</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {transactionLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.sale_id ? invoiceNo(Number(log.sale_id), settings) : "Draft Sale"}</td>
                    <td><em className={log.action_type.includes("void") ? "cancel" : log.action_type.includes("refund") ? "refund" : ""}>{actionLabel(log.action_type)}</em></td>
                    <td className="log-reason">{log.reason}</td>
                    <td>{log.cashier_name || "Unknown"}</td>
                    <td>{log.approver_name || "Not required"}</td>
                    <td>{money(log.affected_amount || 0)}</td>
                    <td>{log.sale_status || "draft"}</td>
                    <td><small>{metadataSummary(log.metadata) || `${log.payment_method || "No payment"}${log.customer_name ? ` / ${log.customer_name}` : ""}`}</small></td>
                  </tr>
                ))}
                {!transactionLogs.length && !logsLoading && (
                  <tr>
                    <td colSpan={9}>No transaction logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {refundApprovalOpen && selected && (
        <div className="management-modal">
          <form className="approval-modal-form" onSubmit={confirmRefundInvoice}>
            <header>
              <h2>Approve Refund</h2>
              <button type="button" onClick={() => setRefundApprovalOpen(false)}>x</button>
            </header>
            <p className="approval-context">
              {invoiceNo(selected.id, settings)} will be refunded and stock will be returned. This action remains in the audit log.
            </p>
            <label>
              Reason
              <select value={refundReason} onChange={(event) => setRefundReason(event.target.value)} required>
                {refundReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            <label>
              Notes
              <textarea value={refundNotes} onChange={(event) => setRefundNotes(event.target.value)} placeholder="Optional extra details" />
            </label>
            <div>
              <label>
                Supervisor/Admin Username
                <input value={approverUsername} onChange={(event) => setApproverUsername(event.target.value)} autoComplete="username" required />
              </label>
              <label>
                PIN / Password
                <input type="password" value={approverPin} onChange={(event) => setApproverPin(event.target.value)} autoComplete="current-password" required />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setRefundApprovalOpen(false)} disabled={refundSaving}>Cancel</button>
              <button className="gold-btn" disabled={refundSaving}>{refundSaving ? "Approving..." : "Approve Refund"}</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
