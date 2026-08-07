"use client";

import { useEffect, useState } from "react";

type Sale = {
  id: number;
  total_amount: string;
  created_at: string;
  cashier_name: string;
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = async () => {
    try {
      const res = await fetch("/api/sales");
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch sales");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Sales Reports</h1>
      </header>

      <div className="glass-panel" style={{ padding: "1.5rem" }}>
        {loading ? (
          <p>Loading sales data...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "1rem" }}>Sale ID</th>
                <th style={{ padding: "1rem" }}>Cashier</th>
                <th style={{ padding: "1rem" }}>Date & Time</th>
                <th style={{ padding: "1rem" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "1rem" }}>#SALE-{sale.id.toString().padStart(5, '0')}</td>
                  <td style={{ padding: "1rem", color: "var(--text-primary)" }}>{sale.cashier_name || 'Unknown'}</td>
                  <td style={{ padding: "1rem" }}>{new Date(sale.created_at).toLocaleString()}</td>
                  <td style={{ padding: "1rem", fontWeight: "bold", color: "#4ade80" }}>
                    ${parseFloat(sale.total_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No sales recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
