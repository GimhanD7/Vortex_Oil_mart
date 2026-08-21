"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  RotateCcw,
  Replace,
  X,
  ShieldAlert,
  Calendar,
  ArrowLeft,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export default function CashierReturnsExchanges() {
  const router = useRouter();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [salesList, setSalesList] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [isPastDate, setIsPastDate] = useState(false);

  const [selectedItems, setSelectedItems] = useState<Record<number, { quantity: number; disposition: string }>>({});

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [verifyingAdmin, setVerifyingAdmin] = useState(false);
  const [resolutionType, setResolutionType] = useState<"Cash" | "Exchange">("Cash");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async (overrideSearch?: string, overrideFrom?: string, overrideTo?: string) => {
    setIsLoadingList(true);
    try {
      const q = overrideSearch !== undefined ? overrideSearch : searchQuery;
      const df = overrideFrom !== undefined ? overrideFrom : dateFrom;
      const dt = overrideTo !== undefined ? overrideTo : dateTo;
      const params = new URLSearchParams();
      if (q.trim()) params.append("search", q.trim());
      if (df) params.append("date_from", df);
      if (dt) params.append("date_to", dt);
      const url = `/api/sales${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load invoices");
      const data = await res.json();
      setSalesList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addToast(err.message || "Failed to fetch invoices", "error");
    } finally {
      setIsLoadingList(false);
    }
  };

  const selectInvoiceForReturn = async (saleId: number) => {
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/sales/${saleId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch invoice details");
      const data = await res.json();
      const today = new Date().toLocaleDateString("en-CA");
      const invoiceDate = (data.sale.business_date || data.sale.created_at).split(" ")[0];
      setIsPastDate(invoiceDate !== today);
      setSelectedInvoice(data.sale);
      setItems(data.items || []);
      setSelectedItems({});
    } catch (err: any) {
      addToast(err.message || "Could not load invoice details", "error");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCheckbox = (item: any) => {
    const remaining = Number(item.quantity) - Number(item.returned_quantity || 0);
    if (remaining <= 0) return;
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[item.sale_item_id]) { delete next[item.sale_item_id]; }
      else { next[item.sale_item_id] = { quantity: remaining, disposition: "resellable" }; }
      return next;
    });
  };

  const updateQuantity = (itemId: number, val: number, max: number) => {
    if (val < 0) val = 0;
    if (val > max) val = max;
    setSelectedItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], quantity: val } }));
  };

  const updateDisposition = (itemId: number, val: string) => {
    setSelectedItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], disposition: val } }));
  };

  const initiateReturn = (type: "Cash" | "Exchange") => {
    const active = Object.entries(selectedItems).filter(([, d]) => d.quantity > 0);
    if (!active.length) { addToast("Please select at least one item with quantity > 0 to return.", "error"); return; }
    setResolutionType(type);
    if (isPastDate) { setAdminModalOpen(true); } else { submitReturn(); }
  };

  const submitReturn = async (adminUser?: string, adminPass?: string) => {
    setSubmittingReturn(true);
    try {
      const returnItems = Object.entries(selectedItems)
        .filter(([, d]) => d.quantity > 0)
        .map(([id, d]) => ({ sale_item_id: Number(id), quantity: d.quantity, disposition: d.disposition }));
      if (!returnItems.length) throw new Error("No items selected with quantity > 0");
      const payload: any = { items: returnItems, resolution: resolutionType, reason: "Customer requested return/exchange" };
      if (adminUser && adminPass) { payload.admin_username = adminUser; payload.admin_password = adminPass; }
      const res = await fetch(`/api/sales/${selectedInvoice.id}/returns`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process return");
      setAdminModalOpen(false); setAdminUsername(""); setAdminPassword("");
      setSelectedInvoice(null); setItems([]); setSelectedItems({});
      addToast(`Successfully processed ${resolutionType.toLowerCase()} (Return #${data.return_number})`, "success");
      fetchSales();
      if (resolutionType === "Exchange") {
        router.push("/dashboard");
        addToast("Return complete. Please start a new transaction for exchange items in POS.", "success");
      }
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) { addToast("Please enter both username and password.", "error"); return; }
    setVerifyingAdmin(true);
    await submitReturn(adminUsername, adminPassword);
    setVerifyingAdmin(false);
  };

  const totalRefund = items.reduce((acc, item) => {
    const sel = selectedItems[item.sale_item_id];
    if (sel && sel.quantity > 0) {
      const df = selectedInvoice?.discount_rate ? Math.max(0, 1 - Number(selectedInvoice.discount_rate) / 100) : 1;
      return acc + sel.quantity * Number(item.price_at_time) * df;
    }
    return acc;
  }, 0);

  const statusStyle = (status: string) => {
    if (status === "completed") return { background: "#dcfce7", color: "#15803d" };
    if (status === "partially_returned") return { background: "#fef9c3", color: "#a16207" };
    if (status === "returned") return { background: "#ffedd5", color: "#c2410c" };
    if (status === "cancelled" || status === "voided") return { background: "#fee2e2", color: "#b91c1c" };
    return { background: "#f1f5f9", color: "#475569" };
  };

  return (
    <div style={{ padding: "24px 28px", minHeight: "100%", background: "var(--bg-base, #f8fafc)" }}>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {selectedInvoice && (
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid #e2e8f0", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", color: "#475569", transition: "all 0.15s", flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                title="Back to Invoices"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary, #0f172a)", margin: 0, letterSpacing: "-0.3px" }}>
                Returns &amp; Exchanges
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-secondary, #475569)", margin: "3px 0 0", lineHeight: 1.4 }}>
                {selectedInvoice
                  ? `Processing invoice INV-${selectedInvoice.id} · ${selectedInvoice.customer_name || "Walk-in Customer"}`
                  : "Search previous sales to process a return or exchange"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!selectedInvoice ? (
        <>
          {/* Search & Filter Bar */}
          <div style={{ background: "#fff", border: "1px solid #e8edf2", borderRadius: 14, padding: "18px 22px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <form
              onSubmit={e => { e.preventDefault(); fetchSales(); }}
              style={{ display: "grid", gridTemplateColumns: "1fr 170px 170px auto", gap: 14, alignItems: "flex-end" }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
                  Search Invoice / Customer
                </label>
                <div style={{ position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Invoice #, Customer Name, Phone..."
                    style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: "1px solid #dfe4ea", borderRadius: 10, outline: "none", fontSize: 13, color: "#111827", boxSizing: "border-box", transition: "border-color 0.15s" }}
                    onFocus={e => { e.target.style.borderColor = "#f0ab00"; e.target.style.boxShadow = "0 0 0 3px rgba(240,171,0,0.15)"; }}
                    onBlur={e => { e.target.style.borderColor = "#dfe4ea"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{ width: "100%", padding: "9px 10px", border: "1px solid #dfe4ea", borderRadius: 10, outline: "none", fontSize: 13, color: "#111827", boxSizing: "border-box", transition: "border-color 0.15s" }}
                  onFocus={e => { e.target.style.borderColor = "#f0ab00"; e.target.style.boxShadow = "0 0 0 3px rgba(240,171,0,0.15)"; }}
                  onBlur={e => { e.target.style.borderColor = "#dfe4ea"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  style={{ width: "100%", padding: "9px 10px", border: "1px solid #dfe4ea", borderRadius: 10, outline: "none", fontSize: 13, color: "#111827", boxSizing: "border-box", transition: "border-color 0.15s" }}
                  onFocus={e => { e.target.style.borderColor = "#f0ab00"; e.target.style.boxShadow = "0 0 0 3px rgba(240,171,0,0.15)"; }}
                  onBlur={e => { e.target.style.borderColor = "#dfe4ea"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={isLoadingList}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "#ffbd00", color: "#111827", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 6px rgba(255,189,0,0.3)", transition: "all 0.15s", opacity: isLoadingList ? 0.65 : 1, whiteSpace: "nowrap" }}
                >
                  <Search size={14} />
                  {isLoadingList ? "Searching..." : "Search"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); fetchSales("", "", ""); }}
                  title="Reset Filters"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontSize: 13, transition: "all 0.15s" }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </form>
          </div>

          {/* Invoices Table */}
          <div style={{ background: "#fff", border: "1px solid #e8edf2", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafbfc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={16} style={{ color: "#f0ab00" }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                  Sales Invoices
                </span>
                <span style={{ background: "#fffbeb", color: "#a16207", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, border: "1px solid #fde68a" }}>
                  {salesList.length}
                </span>
              </div>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>
                Click "Select &amp; Return" on any invoice to begin
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fafbfc" }}>
                    {["Invoice #", "Date & Cycle", "Customer", "Cashier", "Total Amount", "Status", "Action"].map((h, i) => (
                      <th
                        key={h}
                        style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i >= 4 ? "right" : "left", whiteSpace: "nowrap" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "#94a3b8" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                          <RefreshCw size={17} style={{ color: "#f0ab00", animation: "spin 1s linear infinite" }} />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>Loading sales history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : salesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "56px 16px", textAlign: "center", color: "#94a3b8" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <FileText size={36} style={{ color: "#cbd5e1" }} />
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#64748b" }}>No invoices found</p>
                          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Try adjusting your date range or search query</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    salesList.map(sale => {
                      const today = new Date().toLocaleDateString("en-CA");
                      const invDate = (sale.business_date || sale.created_at || "").split(" ")[0];
                      const isPast = invDate !== today;
                      const st = statusStyle(sale.status);

                      return (
                        <tr
                          key={sale.id}
                          style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.1s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#f8fbff"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                        >
                          <td style={{ padding: "13px 16px" }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#e7a700" }}>INV-{sale.id}</span>
                          </td>
                          <td style={{ padding: "13px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", fontWeight: 500 }}>
                              <Calendar size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
                              {invDate}
                            </div>
                            {isPast && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
                                <ShieldAlert size={9} /> Past Cycle
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                            {sale.customer_name || "Walk-in Customer"}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "#475569" }}>
                            {sale.cashier_name || "Cashier"}
                          </td>
                          <td style={{ padding: "13px 16px", textAlign: "right" }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>Rs. {Number(sale.total_amount).toFixed(2)}</span>
                            {Number(sale.returned_amount) > 0 && (
                              <div style={{ fontSize: 11, color: "#ea580c", fontWeight: 500, marginTop: 2 }}>
                                Returned: Rs. {Number(sale.returned_amount).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "13px 16px", textAlign: "right" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: st.background, color: st.color }}>
                              {sale.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td style={{ padding: "13px 16px", textAlign: "right" }}>
                            <button
                              onClick={() => selectInvoiceForReturn(sale.id)}
                              disabled={isLoadingDetails}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#ffbd00", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: isLoadingDetails ? "not-allowed" : "pointer", opacity: isLoadingDetails ? 0.65 : 1, boxShadow: "0 1px 4px rgba(255,189,0,0.3)", transition: "all 0.15s", whiteSpace: "nowrap" }}
                            >
                              <RotateCcw size={12} /> Select &amp; Return
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ── Invoice Detail View ── */
        <div style={{ background: "#fff", border: "1px solid #e8edf2", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          {/* Invoice Header */}
          <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", background: "#fafbfc", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>
                Invoice #INV-{selectedInvoice.id}
              </h2>
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
                  {selectedInvoice.business_date || selectedInvoice.created_at}
                </span>
                {isPastDate && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
                    <ShieldAlert size={12} style={{ color: "#d97706" }} />
                    Past Billing Cycle — Admin Authorization Required
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#111827" }}>{selectedInvoice.customer_name || "Walk-in Customer"}</p>
              {(() => {
                const st = statusStyle(selectedInvoice.status);
                return (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 6, background: st.background, color: st.color }}>
                    {selectedInvoice.status.replace(/_/g, " ")}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Items Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fafbfc" }}>
                  <th style={{ padding: "11px 16px", width: 44 }}></th>
                  {["Product", "Return Qty", "Condition", "Unit Price", "Refund Value"].map((h, i) => (
                    <th
                      key={h}
                      style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: i >= 3 ? "right" : "left" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const remaining = Number(item.quantity) - Number(item.returned_quantity || 0);
                  const isSelected = !!selectedItems[item.sale_item_id];
                  const sel = selectedItems[item.sale_item_id];
                  const df = selectedInvoice.discount_rate ? Math.max(0, 1 - Number(selectedInvoice.discount_rate) / 100) : 1;
                  const refundValue = isSelected ? sel.quantity * Number(item.price_at_time) * df : 0;

                  return (
                    <tr
                      key={item.sale_item_id}
                      style={{ borderBottom: "1px solid #f8fafc", opacity: remaining <= 0 ? 0.45 : 1, transition: "background 0.1s" }}
                      onMouseEnter={e => { if (remaining > 0) (e.currentTarget as HTMLTableRowElement).style.background = "#f8fbff"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          disabled={remaining <= 0}
                          checked={isSelected}
                          onChange={() => handleCheckbox(item)}
                          style={{ width: 17, height: 17, cursor: remaining <= 0 ? "not-allowed" : "pointer", accentColor: "#f0ab00" }}
                        />
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#111827" }}>{item.product_name}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#94a3b8" }}>
                          Purchased: {item.quantity} {item.unit} · Max returnable: <strong style={{ color: remaining > 0 ? "#16a34a" : "#dc2626" }}>{remaining}</strong> {item.unit}
                        </p>
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "center" }}>
                        {isSelected ? (
                          <input
                            type="number"
                            min={1}
                            max={remaining}
                            value={sel.quantity}
                            onChange={e => updateQuantity(item.sale_item_id, Number(e.target.value), remaining)}
                            style={{ width: 72, textAlign: "center", border: "1.5px solid #f0ab00", borderRadius: 8, padding: "5px 4px", fontSize: 13, fontWeight: 700, color: "#92400e", outline: "none" }}
                          />
                        ) : (
                          <span style={{ color: "#cbd5e1", fontSize: 14 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        {isSelected && (
                          <select
                            value={sel.disposition}
                            onChange={e => updateDisposition(item.sale_item_id, e.target.value)}
                            style={{ border: "1px solid #dfe4ea", borderRadius: 8, padding: "5px 8px", fontSize: 12, color: "#374151", outline: "none", background: "#fff", cursor: "pointer" }}
                          >
                            <option value="resellable">✅ Resellable (Good)</option>
                            <option value="damaged">⚠️ Damaged / Defective</option>
                          </select>
                        )}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13, fontWeight: 500, color: "#475569" }}>
                        Rs. {Number(item.price_at_time).toFixed(2)}
                      </td>
                      <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 14, fontWeight: 800, color: isSelected && refundValue > 0 ? "#e7a700" : "#cbd5e1" }}>
                        Rs. {refundValue.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #e8edf2", background: "#fafbfc" }}>
                  <td colSpan={5} style={{ padding: "16px 16px", textAlign: "right", fontWeight: 700, fontSize: 13, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Total Refund Amount
                  </td>
                  <td style={{ padding: "16px 16px", textAlign: "right", fontWeight: 900, fontSize: 22, color: "#e7a700" }}>
                    Rs. {totalRefund.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action Buttons */}
          <div style={{ padding: "18px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 12, background: "#fafbfc" }}>
            <button
              onClick={() => initiateReturn("Cash")}
              disabled={submittingReturn}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: submittingReturn ? "not-allowed" : "pointer", opacity: submittingReturn ? 0.6 : 1, transition: "all 0.15s" }}
            >
              <RotateCcw size={15} />
              Process Return (Refund Cash)
            </button>
            <button
              onClick={() => initiateReturn("Exchange")}
              disabled={submittingReturn}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "#ffbd00", color: "#111827", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: submittingReturn ? "not-allowed" : "pointer", opacity: submittingReturn ? 0.6 : 1, boxShadow: "0 2px 8px rgba(255,189,0,0.3)", transition: "all 0.15s" }}
            >
              <Replace size={15} />
              Process Exchange
            </button>
          </div>
        </div>
      )}

      {/* Admin Authorization Modal */}
      {adminModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", width: "100%", maxWidth: 440, overflow: "hidden" }}>
            <form onSubmit={handleAdminSubmit}>
              <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ShieldAlert size={20} style={{ color: "#d97706" }} />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#92400e" }}>Admin Authorization Required</h3>
                </div>
                <button type="button" onClick={() => setAdminModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
                  Invoice <strong style={{ color: "#111827" }}>#INV-{selectedInvoice?.id}</strong> is from a <strong style={{ color: "#b45309" }}>previous billing cycle</strong>. An administrator must approve this {resolutionType.toLowerCase()}.
                </p>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Admin Username
                  </label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    placeholder="Enter admin username"
                    required
                    style={{ width: "100%", border: "1px solid #dfe4ea", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => { e.target.style.borderColor = "#f0ab00"; e.target.style.boxShadow = "0 0 0 3px rgba(240,171,0,0.15)"; }}
                    onBlur={e => { e.target.style.borderColor = "#dfe4ea"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Admin Password / PIN
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    required
                    style={{ width: "100%", border: "1px solid #dfe4ea", borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => { e.target.style.borderColor = "#f0ab00"; e.target.style.boxShadow = "0 0 0 3px rgba(240,171,0,0.15)"; }}
                    onBlur={e => { e.target.style.borderColor = "#dfe4ea"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>
              <div style={{ padding: "14px 22px", borderTop: "1px solid #f1f5f9", background: "#fafbfc", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, color: "#475569", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingAdmin || submittingReturn}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "#d97706", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: verifyingAdmin || submittingReturn ? "not-allowed" : "pointer", opacity: verifyingAdmin || submittingReturn ? 0.65 : 1, boxShadow: "0 2px 6px rgba(217,119,6,0.3)" }}
                >
                  {verifyingAdmin || submittingReturn ? "Authorizing..." : "Authorize & Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
