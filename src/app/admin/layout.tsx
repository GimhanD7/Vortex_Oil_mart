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
  ClipboardList,
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
  ["cycles", "Sales Cycles", "/admin/sales-cycles"],
  ["products", "Products", "/admin/products"],
  ["inventory", "Inventory", "/admin/inventory"],
  ["customers", "Customers", "/admin/customers"],
  ["reports", "Reports", "/admin/reports"],
  ["users", "Users", "/admin/users"],
  ["purchases", "Purchases", "/admin/purchases"],
  ["settings", "Settings", "/admin/settings"],
] as const;

const PERMISSION_MAP: Record<string, string> = {
  "/admin/sales": "view_sales",
  "/admin/sales-cycles": "view_sales",
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
  cycles: ClipboardList,
  products: Package,
  inventory: Boxes,
  customers: Users,
  reports: BarChart3,
  users: UserCog,
  purchases: PackageCheck,
  settings: Settings,
};

function AdminNavIcon({ name }: { name: NavIcon }) {
  const Icon = navIcons[name];
  return <Icon className="admin-nav-icon" aria-hidden="true" strokeWidth={1.9} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string; permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationSummary, setNotificationSummary] = useState({ lowStock: 0, recentOrders: 0, outOfStock: 0 });

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

  useEffect(() => {
    if (!user) return;
    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setNotificationSummary({
          lowStock: Number(data?.inventory?.low_stock || data?.low_stock?.length || 0),
          recentOrders: Number(data?.recent_orders?.length || 0),
          outOfStock: Number(data?.inventory?.out_of_stock || 0),
        });
      })
      .catch(() => {});
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f8fafc" }}>
        Loading Secure Workspace...
      </div>
    );
  }

  const nav = allNav.filter((item) => {
    if (user.role === "admin") return true;
    const req = PERMISSION_MAP[item[2]];
    return !req || user.permissions.includes(req);
  });

  const signOut = () => {
    document.cookie = "auth_token=; Max-Age=0; path=/";
    router.push("/");
  };
  const notificationCount = notificationSummary.lowStock + notificationSummary.recentOrders + notificationSummary.outOfStock;

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

          <div className="topbar-actions">
            <div className="notification-control">
              <button
                className="bell"
                aria-label="Notifications"
                aria-expanded={showNotifications}
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowProfile(false);
                }}
              >
                <Bell aria-hidden="true" size={22} strokeWidth={1.9} />
                <i>{notificationCount || 0}</i>
              </button>
              {showNotifications && (
                <div className="notification-menu">
                  <header>
                    <b>Notifications</b>
                    <small>Live admin alerts</small>
                  </header>
                  {(user.role === "admin" || user.permissions.includes("manage_inventory")) && (
                    <button onClick={() => router.push("/admin/inventory")}>
                      <PackageCheck size={16} aria-hidden="true" />
                      <span><b>{notificationSummary.lowStock} low stock items</b><small>Open inventory reorder alerts</small></span>
                    </button>
                  )}
                  {(user.role === "admin" || user.permissions.includes("view_sales")) && (
                    <button onClick={() => router.push("/admin/sales")}>
                      <TrendingUp size={16} aria-hidden="true" />
                      <span><b>{notificationSummary.recentOrders} recent orders</b><small>Review sales and invoices</small></span>
                    </button>
                  )}
                  {(user.role === "admin" || user.permissions.includes("manage_products")) && (
                    <button onClick={() => router.push("/admin/products")}>
                      <Package size={16} aria-hidden="true" />
                      <span><b>{notificationSummary.outOfStock} out of stock items</b><small>Update unavailable products</small></span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="profile-control">
              <button
                className="admin-profile"
                aria-label="Open profile menu"
                aria-expanded={showProfile}
                onClick={() => {
                  setShowProfile(!showProfile);
                  setShowNotifications(false);
                }}
              >
                <span>{user.username.charAt(0).toUpperCase()}</span>
                <p>
                  <b>{user.username}</b>
                  <small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small>
                </p>
                <ChevronDown className="profile-chevron" aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              {showProfile && (
                <div className="profile-menu">
                  <div>
                    <span>{user.username.charAt(0).toUpperCase()}</span>
                    <p>
                      <b>{user.username}</b>
                      <small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small>
                    </p>
                  </div>
                  {user.role === "admin" && (
                    <button onClick={() => router.push("/admin/settings")}>
                      <Settings size={16} aria-hidden="true" /> Settings
                    </button>
                  )}
                  <button onClick={() => router.push("/dashboard")}>
                    <ShoppingCart size={16} aria-hidden="true" /> POS Billing
                  </button>
                  <button className="danger" onClick={signOut}>
                    <LogOut size={16} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
