"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Settings,
  ShoppingCart,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

const allNav = [
  ["dashboard", "Dashboard", "/admin/dashboard"],
  ["sales", "Sales", "/admin/sales"],
  ["products", "Products", "/admin/products"],
  ["inventory", "Inventory", "/admin/inventory"],
  ["customers", "Customers", "/admin/customers"],
  ["reports", "Reports", "/admin/reports"],
  ["users", "Users", "/admin/users"],
  ["purchases", "Purchases", "/admin/purchases"],
  ["settings", "Settings", "/admin/settings"],
  ["pos", "POS Billing", "/dashboard"],
] as const;

const PERMISSION_MAP: Record<string, string> = {
  "/admin/sales": "view_sales",
  "/admin/products": "manage_products",
  "/admin/inventory": "manage_inventory",
  "/admin/customers": "manage_customers",
  "/admin/reports": "view_reports",
  "/admin/dashboard": "view_reports",
  "/admin/users": "manage_users",
  "/admin/purchases": "manage_inventory",
  "/dashboard": "pos_billing",
};

type NavIcon = (typeof allNav)[number][0];

const navIcons: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  sales: TrendingUp,
  products: Package,
  inventory: Boxes,
  customers: Users,
  reports: BarChart3,
  users: UserCog,
  purchases: PackageCheck,
  settings: Settings,
  pos: ShoppingCart,
};

function AdminNavIcon({ name }: { name: NavIcon }) {
  const Icon = navIcons[name];
  return <Icon className="admin-nav-icon" aria-hidden="true" strokeWidth={1.9} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [showShift, setShowShift] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string; permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 6);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextWeek);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Not logged in");
        return res.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        router.push("/");
      });
  }, [router]);

  useEffect(() => {
    if (loading || !user || user.role === "admin") return;

    const requiredPermission = PERMISSION_MAP[pathname];
    if (requiredPermission && !user.permissions.includes(requiredPermission)) {
      const available = allNav.find((item) => {
        const req = PERMISSION_MAP[item[2]];
        return !req || user.permissions.includes(req);
      });
      router.push(available ? available[2] : "/");
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f8fafc" }}>
        Loading Secure Workspace...
      </div>
    );
  }

  const nav = allNav.filter((item) => {
    if (user.role === "admin") return true;
    if (item[1] === "Settings") return true;
    const req = PERMISSION_MAP[item[2]];
    return !req || user.permissions.includes(req);
  });

  const formatDate = (d: Date) => {
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const pageTitle = pathname.includes("products")
    ? "Product Management"
    : pathname.includes("purchases")
      ? "Purchase Management"
    : pathname.includes("inventory")
      ? "Inventory"
      : pathname.includes("customers")
        ? "Customers"
        : pathname.includes("sales")
          ? "Sales"
          : pathname.includes("users")
            ? "Users"
            : pathname.includes("reports")
              ? "Reports & Analytics"
              : pathname.includes("settings")
                ? "Settings"
                : "Dashboard";

  return (
    <div className={`admin-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="admin-logo-mark" aria-hidden="true">
            <i />
          </span>
          <div>
            <b>
              <span>OIL</span> <em>MART</em> <i>POS</i>
            </b>
            <small>Oil &amp; Spare Parts Store</small>
          </div>
        </div>

        <nav className="admin-nav">
          {nav.map(([icon, label, href]) => (
            <Link key={label} href={href} className={pathname === href || (label === "Dashboard" && pathname === "/admin/dashboard") ? "active" : ""}>
              <AdminNavIcon name={icon} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <a href="#">
            <CircleHelp className="sidebar-action-icon" aria-hidden="true" strokeWidth={1.9} />
            <span>Help &amp; Support</span>
          </a>
          <button
            onClick={() => {
              document.cookie = "auth_token=; Max-Age=0; path=/";
              router.push("/");
            }}
          >
            <LogOut className="sidebar-action-icon" aria-hidden="true" strokeWidth={1.9} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <button
            className="menu-button"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            <Menu aria-hidden="true" size={24} strokeWidth={2} />
          </button>
          <div className="page-title">
            <h1>{pageTitle}</h1>
            <p>Welcome back, {user.username}</p>
          </div>

          <div className="topbar-actions">
            <div className="topbar-control">
              <button onClick={() => setShowDatePicker(!showDatePicker)}>
                {formatDate(startDate)} - {formatDate(endDate)}
                <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              {showDatePicker && (
                <div className="topbar-menu date-menu">
                  <label>
                    Start Date
                    <input type="date" value={startDate.toISOString().split("T")[0]} onChange={(e) => setStartDate(new Date(e.target.value))} />
                  </label>
                  <label>
                    End Date
                    <input type="date" value={endDate.toISOString().split("T")[0]} onChange={(e) => setEndDate(new Date(e.target.value))} />
                  </label>
                  <button onClick={() => setShowDatePicker(false)}>Apply</button>
                </div>
              )}
            </div>

            <div className="topbar-control">
              <button onClick={() => setShowShift(!showShift)}>
                Shift #CSH-001
                <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              {showShift && (
                <div className="topbar-menu shift-menu">
                  <button onClick={() => setShowShift(false)}>Shift #CSH-001 (Active)</button>
                  <button onClick={() => setShowShift(false)}>Shift #CSH-002</button>
                  <button className="danger" onClick={() => setShowShift(false)}>Close Shift</button>
                </div>
              )}
            </div>

            <button className="bell" aria-label="Notifications">
              <Bell aria-hidden="true" size={22} strokeWidth={1.9} />
              <i>6</i>
            </button>

            <div className="admin-profile">
              <span>{user.username.charAt(0).toUpperCase()}</span>
              <p>
                <b>{user.username}</b>
                <small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small>
              </p>
              <ChevronDown className="profile-chevron" aria-hidden="true" size={16} strokeWidth={2} />
            </div>
          </div>
        </header>

        <main className="admin-content">{children}</main>
        <footer className="admin-footer">
          <span>Copyright 2026 Oil Mart POS. All rights reserved.</span>
          <p>
            <b /> Secure <i /> Reliable <i /> Efficient
          </p>
          <nav>Privacy Policy&nbsp;&nbsp; Terms of Service&nbsp;&nbsp; Help &amp; Support</nav>
        </footer>
      </div>
    </div>
  );
}
