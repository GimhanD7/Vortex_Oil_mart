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
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Cashier</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: "500", color: "var(--text-primary)" }}>#TXN-10023</td>
              <td>John Doe</td>
              <td>$120.00</td>
              <td><span className="badge bg-success-light text-success">Completed</span></td>
            </tr>
            <tr>
              <td style={{ fontWeight: "500", color: "var(--text-primary)" }}>#TXN-10024</td>
              <td>Jane Smith</td>
              <td>$45.50</td>
              <td><span className="badge bg-success-light text-success">Completed</span></td>
            </tr>
            <tr>
              <td style={{ fontWeight: "500", color: "var(--text-primary)" }}>#TXN-10025</td>
              <td>Mike Johnson</td>
              <td>$210.00</td>
              <td><span className="badge bg-warning-light text-warning">Pending</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
