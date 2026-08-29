"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HelpSupportButton } from "@/components/HelpSupport";
import { NotificationCenter } from "@/components/NotificationCenter";
import { logoutToLogin } from "@/lib/auth-session";
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
  ["dashboard", "Dashboard", "/admin/dashboard"],
  ["billing", "POS Billing", "/dashboard"],
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
  "/dashboard": "pos_billing",
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
};

type NavIcon = (typeof allNav)[number][0];

const navIcons: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  billing: ShoppingCart,
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

function normalizePath(path: string) {
  if (path === "/") return path;
  return path.replace(/\/+$/, "");
}

function isActiveNav(pathname: string, href: string) {
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(href);
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [showProfile, setShowProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<{ username: string; role: string; permissions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const profileControlRef = useRef<HTMLDivElement | null>(null);

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

    const requiredPermission = PERMISSION_MAP[normalizePath(pathname)];
    if (requiredPermission && !hasAccess(user, requiredPermission)) {
      const available = allNav.find((item) => {
        const req = PERMISSION_MAP[item[2]];
        return req && hasAccess(user, req);
      });
      router.push(available ? available[2] : "/dashboard");
    }
  }, [loading, pathname, router, user]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileControlRef.current && !profileControlRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    if (showProfile) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showProfile]);

  useEffect(() => {
    setShowProfile(false);
    setMobileNavOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f8fafc" }}>
        Loading Secure Workspace...
      </div>
    );
  }

  const nav = allNav.filter((item) => {
    if (user.role === "admin") return item[2] !== "/dashboard";
    const req = PERMISSION_MAP[item[2]];
    return req && hasAccess(user, req);
  }).map((item) => {
    // Rewrite admin/inventory to cashier/inventory for cashiers
    if (user.role !== "admin" && item[2] === "/admin/inventory") {
      return [item[0], item[1], "/cashier/inventory"] as const;
    }
    return item;
  });

  const activeNavItem = nav.find((item) => isActiveNav(pathname, item[2]));
  const currentTitle = activeNavItem ? activeNavItem[1] : (pathname.includes("settings") ? "Settings" : "Administration");

  const signOut = () => {
    void logoutToLogin();
  };

  return (
    <div className={`admin-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileNavOpen ? " sidebar-mobile-open" : ""}`}>
      <div className="mobile-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <Image
            src="/logo.png"
            alt="Oil Mart POS Logo"
            width={40}
            height={40}
            className="admin-logo-img"
            priority
          />
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
              className={isActiveNav(pathname, href) ? "active" : ""}
              aria-current={isActiveNav(pathname, href) ? "page" : undefined}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= 850) {
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
              void logoutToLogin();
            }}
          >
            <LogOut className="sidebar-action-icon" aria-hidden="true" strokeWidth={1.9} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-button"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= 850) {
                  setMobileNavOpen((prev) => !prev);
                } else {
                  setSidebarCollapsed((prev) => !prev);
                }
              }}
            >
              <Menu aria-hidden="true" size={20} strokeWidth={2} />
            </button>

            <div className="page-title">
              <h1>{currentTitle}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <NotificationCenter />

            <div className="profile-control" ref={profileControlRef}>
              <button
                type="button"
                className="admin-profile"
                aria-label="Open profile menu"
                aria-expanded={showProfile}
                onClick={() => setShowProfile((prev) => !prev)}
              >
                <span className="profile-avatar">{user.username.charAt(0).toUpperCase()}</span>
                <div className="profile-details">
                  <b>{user.username}</b>
                  <small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small>
                </div>
                <ChevronDown className="profile-chevron" aria-hidden="true" size={16} strokeWidth={2} />
              </button>
              {showProfile && (
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    <span className="profile-avatar">{user.username.charAt(0).toUpperCase()}</span>
                    <div>
                      <b>{user.username}</b>
                      <small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small>
                    </div>
                  </div>
                  {user.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfile(false);
                        router.push("/admin/settings");
                      }}
                    >
                      <Settings size={16} aria-hidden="true" />
                      <span>Settings</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setShowProfile(false);
                      signOut();
                    }}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>Logout</span>
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
