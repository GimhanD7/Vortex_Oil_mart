"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ sales: 0, inventory: 0, pending: 0 });

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Admin Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "var(--text-muted)" }}>Welcome, Admin</span>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "#fff" }}>
            A
          </div>
        </div>
      </header>

      {/* Stats Widgets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Total Sales Today</h3>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--text-primary)" }}>$4,250</p>
        </div>
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Active Inventory</h3>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--text-primary)" }}>1,204 L</p>
        </div>
        <div className="glass-panel" style={{ padding: "1.5rem" }}>
          <h3 style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Pending Orders</h3>
          <p style={{ fontSize: "2rem", fontWeight: "bold", color: "var(--text-primary)" }}>12</p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel" style={{ padding: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>Recent Transactions</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
              <th style={{ padding: "1rem" }}>Transaction ID</th>
              <th style={{ padding: "1rem" }}>Cashier</th>
              <th style={{ padding: "1rem" }}>Amount</th>
              <th style={{ padding: "1rem" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td style={{ padding: "1rem" }}>#TXN-10023</td>
              <td style={{ padding: "1rem" }}>John Doe</td>
              <td style={{ padding: "1rem" }}>$120.00</td>
              <td style={{ padding: "1rem" }}><span style={{ color: "#4ade80", backgroundColor: "rgba(74, 222, 128, 0.1)", padding: "0.25rem 0.5rem", borderRadius: "1rem", fontSize: "0.75rem" }}>Completed</span></td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td style={{ padding: "1rem" }}>#TXN-10024</td>
              <td style={{ padding: "1rem" }}>Jane Smith</td>
              <td style={{ padding: "1rem" }}>$45.50</td>
              <td style={{ padding: "1rem" }}><span style={{ color: "#4ade80", backgroundColor: "rgba(74, 222, 128, 0.1)", padding: "0.25rem 0.5rem", borderRadius: "1rem", fontSize: "0.75rem" }}>Completed</span></td>
            </tr>
            <tr>
              <td style={{ padding: "1rem" }}>#TXN-10025</td>
              <td style={{ padding: "1rem" }}>Mike Johnson</td>
              <td style={{ padding: "1rem" }}>$210.00</td>
              <td style={{ padding: "1rem" }}><span style={{ color: "#facc15", backgroundColor: "rgba(250, 204, 21, 0.1)", padding: "0.25rem 0.5rem", borderRadius: "1rem", fontSize: "0.75rem" }}>Pending</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
