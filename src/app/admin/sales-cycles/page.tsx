"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Eye, RefreshCw, Search, X } from "lucide-react";

type SalesCycle = {
  cycle_id: string;
  cashier_name: string;
  opened_date: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_balance: string | number;
  closing_balance: string | number | null;
  invoice_count: string | number;
  item_count: string | number;
  total_sales: string | number;
  cash_sales: string | number;
  card_sales: string | number;
  bank_sales: string | number;
  discount_total: string | number;
  tax_total: string | number;
  expected_cash: string | number;
  cash_difference: string | number | null;
};

type Sale = {
  id: number;
  created_at: string;
  cashier_name: string | null;
  customer_name: string | null;
  payment_method: string;
  item_count: string | number;
  total_amount: string | number;
  status: string;
};

function money(value: string | number | null | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SalesCyclesPage() {
  const [cycles, setCycles] = useState<SalesCycle[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<SalesCycle | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCloseCycle, setShowCloseCycle] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [closingCycle, setClosingCycle] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", cashier: "All Cashiers", status: "All Status" });

  const cashiers = useMemo(() => ["All Cashiers", ...Array.from(new Set(cycles.map((cycle) => cycle.cashier_name)))], [cycles]);
  const totals = useMemo(() => cycles.reduce(
    (sum, cycle) => ({
      cycles: sum.cycles + 1,
      open: sum.open + (cycle.status === "open" ? 1 : 0),
      invoices: sum.invoices + Number(cycle.invoice_count || 0),
      sales: sum.sales + Number(cycle.total_sales || 0),
      cash: sum.cash + Number(cycle.cash_sales || 0),
    }),
    { cycles: 0, open: 0, invoices: 0, sales: 0, cash: 0 }
  ), [cycles]);

  const loadCycles = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("date_from", filters.from);
    if (filters.to) params.set("date_to", filters.to);
    if (filters.cashier !== "All Cashiers") params.set("cashier", filters.cashier);
    if (filters.status !== "All Status") params.set("status", filters.status);
    try {
      const response = await fetch(`/api/sales/cycles?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      const rows = Array.isArray(data) ? data as SalesCycle[] : [];
      setCycles(rows);
      setSelected((current) => rows.find((cycle) => cycle.cycle_id === current?.cycle_id) || rows[0] || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCycles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setSales([]);
      return;
    }
    fetch(`/api/sales?cycle_id=${encodeURIComponent(selected.cycle_id)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch(() => setSales([]));
  }, [selected]);

  const openCloseCycle = () => {
    if (!selected || selected.status !== "open") return;
    setClosingCash(Number(selected.expected_cash || 0).toFixed(2));
    setCloseError("");
    setShowCloseCycle(true);
  };

  const closeSelectedCycle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(closingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      setCloseError("Enter a valid closing cash amount.");
      return;
    }
    setClosingCycle(true);
    setCloseError("");
    try {
      const response = await fetch("/api/sales/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: selected.cycle_id,
          closing_balance: amount,
          admin_close: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to close the sales cycle.");
      setShowCloseCycle(false);
      await loadCycles();
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : "Unable to close the sales cycle.");
    } finally {
      setClosingCycle(false);
    }
  };

  return (
    <div className="management-page cycle-page">
      <div className="management-heading">
        <div>
          <h1>Sales Cycle History</h1>
          <p>Admin / Cashier cycles, daily sales logs and invoice records</p>
        </div>
        <aside>
          <button onClick={() => void loadCycles()}>
            <RefreshCw size={15} aria-hidden="true" /> {loading ? "Loading..." : "Refresh"}
          </button>
        </aside>
      </div>

      <section className="cycle-kpis">
        <article><small>Total Cycles</small><b>{totals.cycles}</b><em>All cashier sessions</em></article>
        <article><small>Open Cycles</small><b>{totals.open}</b><em>Currently active</em></article>
        <article><small>Total Invoices</small><b>{totals.invoices}</b><em>Recorded sales</em></article>
        <article><small>Total Sales</small><b>{money(totals.sales)}</b><em>Cycle revenue</em></article>
        <article><small>Cash Sales</small><b>{money(totals.cash)}</b><em>Expected in drawer</em></article>
      </section>

      <section className="cycle-filters">
        <label><CalendarDays size={18} aria-hidden="true" /> <input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label><CalendarDays size={18} aria-hidden="true" /> <input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
        <select value={filters.cashier} onChange={(event) => setFilters({ ...filters, cashier: event.target.value })}>{cashiers.map((cashier) => <option key={cashier}>{cashier}</option>)}</select>
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All Status</option><option>Open</option><option>Closed</option></select>
        <button className="gold-btn" onClick={() => void loadCycles()}><Search size={15} aria-hidden="true" /> Apply</button>
      </section>

      <div className="cycle-layout">
        <section className="management-table cycle-list">
          <header><h2>Cycle Records</h2><p>Showing {cycles.length} cycles</p></header>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Cycle No.</th><th>Cashier</th><th>Date</th><th>Sales</th><th>Invoices</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {cycles.map((cycle) => (
                  <tr key={cycle.cycle_id} className={selected?.cycle_id === cycle.cycle_id ? "selected-row" : ""}>
                    <td><b>{cycle.cycle_id}</b></td>
                    <td>{cycle.cashier_name}</td>
                    <td>{new Date(cycle.opened_date).toLocaleDateString("en-IN")}</td>
                    <td>{money(cycle.total_sales)}</td>
                    <td>{Number(cycle.invoice_count || 0)}</td>
                    <td><em className={cycle.status === "open" ? "low" : ""}>{cycle.status}</em></td>
                    <td className="table-actions-cell"><button onClick={() => setSelected(cycle)} aria-label={`View ${cycle.cycle_id}`}><Eye size={15} aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="cycle-detail">
          {selected ? (
            <>
              <header>
                <small>Selected Cycle</small>
                <h2>{selected.cycle_id}</h2>
                <span className={selected.status === "open" ? "open" : ""}>{selected.status}</span>
              </header>
              <dl>
                <div><dt>Cashier</dt><dd>{selected.cashier_name}</dd></div>
                <div><dt>Opened</dt><dd>{formatDate(selected.opened_at)}</dd></div>
                <div><dt>Closed</dt><dd>{formatDate(selected.closed_at)}</dd></div>
                <div><dt>Opening Cash</dt><dd>{money(selected.opening_balance)}</dd></div>
                <div><dt>Cash Sales</dt><dd>{money(selected.cash_sales)}</dd></div>
                <div><dt>Expected Cash</dt><dd>{money(selected.expected_cash)}</dd></div>
                <div><dt>Closing Cash</dt><dd>{selected.closing_balance === null ? "-" : money(selected.closing_balance)}</dd></div>
                <div><dt>Difference</dt><dd>{selected.cash_difference === null ? "-" : money(selected.cash_difference)}</dd></div>
                <div><dt>Card Sales</dt><dd>{money(selected.card_sales)}</dd></div>
                <div><dt>Bank Transfer</dt><dd>{money(selected.bank_sales)}</dd></div>
              </dl>
              {selected.status === "open" && (
                <button className="admin-close-cycle-btn" onClick={openCloseCycle}>
                  <CheckCircle2 size={16} aria-hidden="true" /> Close Sales Cycle
                </button>
              )}
            </>
          ) : <p>No cycle selected.</p>}
        </aside>
      </div>

      <section className="management-table">
        <header><h2>Sales Records in Selected Cycle</h2><p>{sales.length} invoices</p></header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Invoice No.</th><th>Date &amp; Time</th><th>Customer</th><th>Payment</th><th>Items</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td><b>INV-{String(sale.id).padStart(6, "0")}</b></td>
                  <td>{new Date(sale.created_at).toLocaleString("en-IN")}</td>
                  <td>{sale.customer_name || "Walk-in Customer"}</td>
                  <td>{sale.payment_method || "Cash"}</td>
                  <td>{Number(sale.item_count || 0)}</td>
                  <td>{money(sale.total_amount)}</td>
                  <td><em>{sale.status || "completed"}</em></td>
                </tr>
              ))}
              {!sales.length && <tr><td colSpan={7}>No sales recorded in this cycle.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showCloseCycle && selected && (
        <div className="management-modal" role="dialog" aria-modal="true" aria-labelledby="close-cycle-title">
          <form onSubmit={closeSelectedCycle}>
            <header>
              <h2 id="close-cycle-title">Close Sales Cycle</h2>
              <button type="button" onClick={() => setShowCloseCycle(false)} aria-label="Close"><X aria-hidden="true" /></button>
            </header>
            <p className="close-cycle-warning">
              You are closing <b>{selected.cycle_id}</b> for <b>{selected.cashier_name}</b>. The cashier will need to open a new cycle before making more sales.
            </p>
            <div className="close-cycle-summary">
              <span>Expected cash <b>{money(selected.expected_cash)}</b></span>
              <span>Cash sales <b>{money(selected.cash_sales)}</b></span>
            </div>
            <label>
              Actual closing cash
              <input value={closingCash} onChange={(event) => setClosingCash(event.target.value)} inputMode="decimal" autoFocus />
            </label>
            {closeError && <p className="close-cycle-error">{closeError}</p>}
            <footer>
              <button type="button" onClick={() => setShowCloseCycle(false)} disabled={closingCycle}>Cancel</button>
              <button className="gold-btn" type="submit" disabled={closingCycle}>
                <CheckCircle2 size={16} aria-hidden="true" /> {closingCycle ? "Closing..." : "Confirm Close"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
