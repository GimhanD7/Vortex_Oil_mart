"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const nav = [
  ["▦", "Dashboard", "/admin/dashboard"],
  ["↗", "Sales", "/admin/sales"],
  ["◇", "Products", "/admin/products"],
  ["▣", "Inventory", "/admin/inventory"],
  ["♙", "Customers", "/admin/customers"],
  ["▥", "Reports", "/admin/sales"],
  ["♙", "Users", "/admin/users"],
  ["⚙", "Settings", "#"],
  ["▧", "POS Billing", "/dashboard"],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo"><span>◒</span><div><b>OIL <em>MART</em> <i>POS</i></b><small>Oil &amp; Spare Parts Store</small></div></div>
        <nav className="admin-nav">
          {nav.map(([icon,label,href]) => <Link key={label} href={href} className={pathname === href || (label === "Dashboard" && pathname === "/admin/dashboard") ? "active" : ""}><span>{icon}</span>{label}</Link>)}
        </nav>
        <div className="sidebar-promo"><h3>Powering<br/>Performance.<br/><span>Every Time.</span></h3><div className="promo-bottles">▰ ◼ ◉</div><Link href="/admin/inventory">View Products</Link></div>
        <div className="sidebar-bottom"><a href="#">♢ <span>Help &amp; Support</span></a><button onClick={() => router.push("/")}>↪ <span>Logout</span></button></div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="menu-button" aria-label="Toggle menu">☰</button>
          <div className="page-title"><h1>{pathname.includes("products") ? "Product Management" : pathname.includes("inventory") ? "Inventory" : pathname.includes("customers") ? "Customers" : pathname.includes("sales") ? "Sales" : pathname.includes("users") ? "Users" : "Dashboard"}</h1><p>Welcome back, Admin</p></div>
          <div className="topbar-actions"><button>07 Aug 2026&nbsp;&nbsp;–&nbsp;&nbsp;13 Aug 2026　▣</button><button>Shift #CSH-001　⌄</button><button className="bell">♧<i>6</i></button><div className="admin-profile"><span>A</span><p><b>Admin</b><small>Super Admin</small></p><i>⌄</i></div></div>
        </header>
        <main className="admin-content">{children}</main>
        <footer className="admin-footer"><span>© 2026 Oil Mart POS. All rights reserved.</span><p><b>◆</b> Secure　<i/> Reliable　<i/> Efficient</p><nav>Privacy Policy　　Terms of Service　　Help &amp; Support</nav></footer>
      </div>
    </div>
  );
}
