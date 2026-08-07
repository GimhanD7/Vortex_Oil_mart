"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const navLinkStyle = (path: string) => ({
    padding: "0.75rem", 
    borderRadius: "var(--radius-all)", 
    textDecoration: "none", 
    fontWeight: "500",
    transition: "all 0.2s",
    backgroundColor: pathname === path ? "var(--bg-primary-light)" : "transparent",
    color: pathname === path ? "var(--accent-primary)" : "var(--text-secondary)",
  });

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-base)" }}>
      {/* Sidebar */}
      <aside style={{ width: "250px", backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)", padding: "1.5rem", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--accent-primary)" }}>Oil Mart</h2>
          <ThemeToggle />
        </div>
        
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Link href="/admin/dashboard" style={navLinkStyle("/admin/dashboard")}>Dashboard Overview</Link>
          <Link href="/admin/inventory" style={navLinkStyle("/admin/inventory")}>Manage Inventory</Link>
          <Link href="/admin/sales" style={navLinkStyle("/admin/sales")}>Sales Reports</Link>
          <Link href="/admin/users" style={navLinkStyle("/admin/users")}>User Management</Link>
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
           <button 
            onClick={() => router.push("/")}
            className="btn-primary" 
            style={{ width: "100%", backgroundColor: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", background: "none" }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto", maxHeight: "100vh", backgroundColor: "var(--bg-base)" }}>
        {children}
      </main>
    </div>
  );
}
