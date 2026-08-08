"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const allNav = [
  ["▦", "Dashboard", "/admin/dashboard"],
  ["↗", "Sales", "/admin/sales"],
  ["◇", "Products", "/admin/products"],
  ["▣", "Inventory", "/admin/inventory"],
  ["♙", "Customers", "/admin/customers"],
  ["▥", "Reports", "/admin/reports"],
  ["♙", "Users", "/admin/users"],
  ["⚙", "Settings", "#"],
  ["▧", "POS Billing", "/dashboard"],
];

const PERMISSION_MAP: Record<string, string> = {
  "/admin/sales": "view_sales",
  "/admin/products": "manage_products",
  "/admin/inventory": "manage_inventory",
  "/admin/customers": "manage_customers",
  "/admin/reports": "view_reports",
  "/admin/dashboard": "view_reports",
  "/admin/users": "manage_users",
  "/dashboard": "pos_billing",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [showShift, setShowShift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [user, setUser] = useState<{ username: string, role: string, permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 6);
  
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextWeek);
  
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  useEffect(() => {
    if (loading || !user) return;
    
    // Check access
    if (user.role === 'admin') return; // Admin has full access

    // Check specific permission
    const requiredPermission = PERMISSION_MAP[pathname];
    if (requiredPermission && !user.permissions.includes(requiredPermission)) {
      // Redirect to first available page or home
      const available = allNav.find(item => {
        const req = PERMISSION_MAP[item[2]];
        return !req || user.permissions.includes(req);
      });
      if (available && available[2] !== '#') {
        router.push(available[2]);
      } else {
        router.push('/');
      }
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>Loading Secure Workspace...</div>;
  }

  // Filter Nav
  const nav = allNav.filter(item => {
    if (user.role === 'admin') return true;
    if (item[1] === "Settings") return true; // Let settings always show for now
    const req = PERMISSION_MAP[item[2]];
    return !req || user.permissions.includes(req);
  });
  
  const formatDate = (d: Date) => {
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo"><span>◒</span><div><b>OIL <em>MART</em> <i>POS</i></b><small>Oil &amp; Spare Parts Store</small></div></div>
        <nav className="admin-nav">
          {nav.map(([icon,label,href]) => <Link key={label} href={href} className={pathname === href || (label === "Dashboard" && pathname === "/admin/dashboard") ? "active" : ""}><span>{icon}</span>{label}</Link>)}
        </nav>
        <div className="sidebar-promo"><h3>Powering<br/>Performance.<br/><span>Every Time.</span></h3><div className="promo-bottles">▰ ◼ ◉</div><Link href="/admin/inventory">View Products</Link></div>
        <div className="sidebar-bottom"><a href="#">♢ <span>Help &amp; Support</span></a><button onClick={() => { document.cookie = 'auth_token=; Max-Age=0; path=/'; router.push("/"); }}>↪ <span>Logout</span></button></div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="menu-button" aria-label="Toggle menu">☰</button>
          <div className="page-title"><h1>{pathname.includes("products") ? "Product Management" : pathname.includes("inventory") ? "Inventory" : pathname.includes("customers") ? "Customers" : pathname.includes("sales") ? "Sales" : pathname.includes("users") ? "Users" : pathname.includes("reports") ? "Reports & Analytics" : "Dashboard"}</h1><p>Welcome back, {user.username}</p></div>
          <div className="topbar-actions">
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowDatePicker(!showDatePicker)}>{formatDate(startDate)}&nbsp;&nbsp;–&nbsp;&nbsp;{formatDate(endDate)}　▣</button>
              {showDatePicker && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '4px', color: '#0f172a' }}>
                    Start Date
                    <input type="date" value={startDate.toISOString().split('T')[0]} onChange={(e) => setStartDate(new Date(e.target.value))} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                  </label>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '4px', color: '#0f172a' }}>
                    End Date
                    <input type="date" value={endDate.toISOString().split('T')[0]} onChange={(e) => setEndDate(new Date(e.target.value))} style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                  </label>
                  <button onClick={() => setShowDatePicker(false)} style={{ marginTop: '4px', background: 'var(--brand, #1e293b)', color: 'var(--brand-text, white)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Apply</button>
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowShift(!showShift)}>Shift #CSH-001　⌄</button>
              {showShift && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '150px', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '14px' }} onClick={() => setShowShift(false)}>Shift #CSH-001 (Active)</div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '14px' }} onClick={() => setShowShift(false)}>Shift #CSH-002</div>
                  <div style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: '#ef4444' }} onClick={() => setShowShift(false)}>Close Shift</div>
                </div>
              )}
            </div>
            <button className="bell">♧<i>6</i></button>
            <div className="admin-profile"><span>{user.username.charAt(0).toUpperCase()}</span><p><b>{user.username}</b><small>{user.role === 'admin' ? 'Super Admin' : 'Cashier'}</small></p><i>⌄</i></div>
          </div>
        </header>
        <main className="admin-content">{children}</main>
        <footer className="admin-footer"><span>© 2026 Oil Mart POS. All rights reserved.</span><p><b>◆</b> Secure　<i/> Reliable　<i/> Efficient</p><nav>Privacy Policy　　Terms of Service　　Help &amp; Support</nav></footer>
      </div>
    </div>
  );
}
