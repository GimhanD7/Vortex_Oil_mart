"use client";

import { useEffect, useState } from "react";
import { Download, PackageCheck, Receipt, Wallet } from "lucide-react";

type ReportData = {
  daily: { date: string; total: string; orders: number }[];
  monthly: { month: string; total: string; orders: number }[];
  yearly: { year: number; total: string; orders: number }[];
  brands: { brand: string; total: string; items_sold: string }[];
  categories: { category: string; total: string; items_sold: string }[];
  staff: { cashier: string; total: string; orders: number }[];
};

type TimelineRow = {
  date?: string;
  month?: string;
  year?: number;
  total: string;
  orders: number;
};

function Panel({ title, action, children, className = "", style }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`dash-panel ${className}`} style={style}>
      <header>
        <h2>{title}</h2>
        {action && action}
      </header>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [timelineView, setTimelineView] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', color: '#64748b' }}>Loading comprehensive reports...</div>;
  }

  if (!data) {
    return <div style={{ padding: '2rem', color: '#ef4444' }}>Failed to load report data.</div>;
  }

  // Calculate top-level stats
  const totalRevenue = data.yearly.reduce((sum, item) => sum + Number(item.total), 0);
  const totalOrders = data.yearly.reduce((sum, item) => sum + Number(item.orders), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const currentTimelineData = data[timelineView] || [];
  const maxTimelineTotal = Math.max(...(currentTimelineData as TimelineRow[]).map((row) => Number(row.total)), 1);

  const exportCSV = () => {
    if (!data) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Revenue Timeline (Current View)
    csvContent += `--- ${timelineView.toUpperCase()} SALES ---\n`;
    csvContent += timelineView === 'daily' ? "Date,Total Revenue,Orders\n" : timelineView === 'monthly' ? "Month,Total Revenue,Orders\n" : "Year,Total Revenue,Orders\n";
    (currentTimelineData as TimelineRow[]).forEach((row) => {
      csvContent += `${row.date || row.month || row.year},${row.total},${row.orders}\n`;
    });
    
    // Brands
    csvContent += "\n--- SALES BY BRAND ---\n";
    csvContent += "Brand,Total Revenue,Items Sold\n";
    data.brands.forEach(row => {
      csvContent += `${row.brand},${row.total},${row.items_sold}\n`;
    });

    // Categories
    csvContent += "\n--- SALES BY CATEGORY ---\n";
    csvContent += "Category,Total Revenue,Items Sold\n";
    data.categories.forEach(row => {
      csvContent += `${row.category},${row.total},${row.items_sold}\n`;
    });

    // Staff
    csvContent += "\n--- STAFF PERFORMANCE ---\n";
    csvContent += "Cashier,Total Revenue,Orders\n";
    data.staff.forEach(row => {
      csvContent += `${row.cashier || 'Admin'},${row.total},${row.orders}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `oil_mart_reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-grid">
      <section className="metric-row">
        <article className="metric-card">
          <span className="green"><Wallet size={22} aria-hidden="true" /></span>
          <div>
            <small>All-Time Revenue</small>
            <strong>Rs. {totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
          </div>
        </article>
        <article className="metric-card">
          <span className="blue"><Receipt size={22} aria-hidden="true" /></span>
          <div>
            <small>Total Orders</small>
            <strong>{totalOrders}</strong>
          </div>
        </article>
        <article className="metric-card">
          <span className="purple"><PackageCheck size={22} aria-hidden="true" /></span>
          <div>
            <small>Average Order Value</small>
            <strong>Rs. {avgOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
          </div>
        </article>
      </section>

      <Panel 
        title="Revenue Timeline" 
        className="sales-chart-panel" 
        style={{ gridColumn: '1 / -1' }}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportCSV} style={{ padding: '6px 12px', background: 'var(--brand)', color: 'var(--brand-text)', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
              <Download size={14} aria-hidden="true" /> Export CSV
            </button>
            <select value={timelineView} onChange={(e) => setTimelineView(e.target.value as "daily" | "monthly" | "yearly")} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
              <option value="daily">Daily (Last 30 Days)</option>
              <option value="monthly">Monthly (Last 12 Months)</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        }
      >
        <div className="report-timeline-bars">
          {currentTimelineData.length === 0 ? (
            <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', alignSelf: 'center' }}>No sales data available for this period.</div>
          ) : (
            (currentTimelineData as TimelineRow[]).map((item) => {
              const val = Number(item.total);
              const heightPct = Math.max((val / maxTimelineTotal) * 100, 2);
              const label = item.date || item.month || item.year;
              return (
                <div key={label} style={{ flex: '1', minWidth: '46px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div className="report-bar-track">
                    <i title={`Rs. ${val.toLocaleString("en-IN")} (${item.orders} orders)`} style={{ height: `${heightPct}%` }} />
                  </div>
                  <small style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {String(label).split('-').slice(-2).join('/')}
                  </small>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      <Panel title="Sales by Brand" className="store-panel">
        <div className="store-bars" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {data.brands.length === 0 && <p style={{ color: '#94a3b8' }}>No brand data available.</p>}
          {data.brands.map(brand => {
            const val = Number(brand.total);
            const pct = totalRevenue > 0 ? (val / totalRevenue) * 100 : 0;
            return (
              <div key={brand.brand} style={{ marginBottom: '16px' }}>
                <p>{brand.brand} <b>Rs. {val.toLocaleString("en-IN")} <small>({pct.toFixed(1)}%)</small></b></p>
                <i><span style={{ width: `${pct}%`, background: '#3b82f6' }} /></i>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Sales by Category" className="store-panel">
        <div className="store-bars" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {data.categories.length === 0 && <p style={{ color: '#94a3b8' }}>No category data available.</p>}
          {data.categories.map(cat => {
            const val = Number(cat.total);
            const pct = totalRevenue > 0 ? (val / totalRevenue) * 100 : 0;
            return (
              <div key={cat.category} style={{ marginBottom: '16px' }}>
                <p>{cat.category} <b>Rs. {val.toLocaleString("en-IN")} <small>({pct.toFixed(1)}%)</small></b></p>
                <i><span style={{ width: `${pct}%`, background: '#8b5cf6' }} /></i>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Staff Performance" className="recent-sales-panel">
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 500 }}>Cashier</th>
              <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 500 }}>Total Orders</th>
              <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 500 }}>Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.staff.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No staff data available.</td></tr>
            )}
            {data.staff.map(s => (
              <tr key={s.cashier} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{s.cashier || "Admin"}</td>
                <td style={{ padding: '12px 8px' }}>{s.orders}</td>
                <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>Rs. {Number(s.total).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
