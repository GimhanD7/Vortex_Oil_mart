"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HelpSupportButton } from "@/components/HelpSupport";
import { NotificationCenter } from "@/components/NotificationCenter";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  RotateCcw,
  Settings,
  ShoppingCart,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

const allNav = [
  ["pos", "POS Billing", "/dashboard"],
  ["dashboard", "Dashboard", "/admin/dashboard"],
  ["sales", "Sales", "/admin/sales"],
  ["cycles", "Sales Cycles", "/admin/sales-cycles"],
  ["products", "Products", "/admin/products"],
  ["returns", "Returns & Exchanges", "/cashier/returns"],
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
  "/admin/inventory": "view_inventory",
  "/cashier/inventory": "view_inventory",
  "/cashier/returns": "view_inventory",
  "/admin/customers": "manage_customers",
  "/admin/reports": "view_reports",
  "/admin/dashboard": "view_reports",
  "/admin/users": "manage_users",
  "/admin/purchases": "manage_inventory",
  "/admin/settings": "manage_settings",
  "/dashboard": "pos_billing",
};

type NavIcon = (typeof allNav)[number][0];

const navIcons: Record<NavIcon, LucideIcon> = {
  pos: ShoppingCart,
  dashboard: LayoutDashboard,
  sales: TrendingUp,
  cycles: ClipboardList,
  returns: RotateCcw,
  products: Package,
  inventory: Boxes,
  customers: Users,
  reports: BarChart3,
  users: UserCog,
  purchases: PackageCheck,
  settings: Settings,
};

function hasAccess(user: { permissions: string[] }, required?: string) {
  if (!required) return false;
  if (required === "view_inventory") {
    return user.permissions.includes("view_inventory") || user.permissions.includes("manage_inventory") || user.permissions.includes("pos_billing");
  }
  return user.permissions.includes(required);
}

function AdminNavIcon({ name }: { name: NavIcon }) {
  const Icon = navIcons[name];
  return <Icon className="admin-nav-icon" aria-hidden="true" strokeWidth={1.9} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [showProfile, setShowProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string; permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (requiredPermission && !hasAccess(user, requiredPermission)) {
      const available = allNav.find((item) => {
        const req = PERMISSION_MAP[item[2]];
        return req && hasAccess(user, req);
      });
      router.push(available ? available[2] : "/dashboard");
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
    const req = PERMISSION_MAP[item[2]];
    return req && hasAccess(user, req);
  }).map((item) => {
    // Rewrite admin/inventory to cashier/inventory for cashiers
    if (user.role !== "admin" && item[2] === "/admin/inventory") {
      return [item[0], item[1], "/cashier/inventory"] as const;
    }
    return item;
  });

  const signOut = () => {
    document.cookie = "auth_token=; Max-Age=0; path=/";
    router.push("/");
  };

  return (
    <div className={`admin-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileNavOpen ? " sidebar-mobile-open" : ""}`}>
      <div className="mobile-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
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
            <Link
              key={label}
              href={href}
              className={pathname === href || pathname.startsWith(href) || (label === "Dashboard" && pathname === "/admin/dashboard") || (label === "Inventory" && pathname.endsWith("/inventory")) ? "active" : ""}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= 520) {
                  setMobileNavOpen(false);
                }
              }}
            >
              <AdminNavIcon name={icon} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <HelpSupportButton iconClassName="sidebar-action-icon" />
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
            onClick={() => {
              if (typeof window !== 'undefined' && window.innerWidth <= 520) {
                setMobileNavOpen(!mobileNavOpen);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
          >
            <Menu aria-hidden="true" size={24} strokeWidth={2} />
          </button>

          <div className="topbar-actions">
            <NotificationCenter />

            <div className="profile-control">
              <button
                className="admin-profile"
                aria-label="Open profile menu"
                aria-expanded={showProfile}
                onClick={() => setShowProfile(!showProfile)}
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
