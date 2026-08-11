"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CircleDot,
  CreditCard,
  Filter,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Minus,
  Package,
  PackageCheck,
  Plus,
  Printer,
  Receipt,
  ScanBarcode,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Trash2,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

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

type Product = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  category?: string;
  sku?: string;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  customer_type: string;
};

type CartItem = Product & { cartQuantity: number };

type NavItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", Icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", Icon: Package },
  { label: "Inventory", href: "/admin/inventory", Icon: Boxes },
  { label: "Customers", href: "/admin/customers", Icon: Users },
  { label: "Sales", href: "/admin/sales", Icon: TrendingUp },
  { label: "Purchases", href: "/admin/purchases", Icon: PackageCheck },
  { label: "Reports", href: "/admin/reports", Icon: Gauge },
  { label: "Users", href: "/admin/users", Icon: UserCog },
  { label: "Settings", href: "/admin/settings", Icon: Settings },
];

const paymentIcons: Record<string, LucideIcon> = {
  Cash: Wallet,
  Card: CreditCard,
  UPI: ScanBarcode,
  Wallet,
  "Bank Transfer": CreditCard,
  Credit: Wallet,
};

type PosSettings = {
  store_name: string;
  store_address: string;
  store_phone: string;
  gst_number: string;
  tax_rate: string;
  invoice_prefix: string;
  invoice_footer: string;
  payment_methods: string[];
};

const defaultPosSettings: PosSettings = {
  store_name: "Oil Mart",
  store_address: "123, Industrial Area, New Delhi",
  store_phone: "",
  gst_number: "",
  tax_rate: "18",
  invoice_prefix: "INV",
  invoice_footer: "Thank you for your visit. Drive safe. Stay protected.",
  payment_methods: ["Cash", "Card", "UPI"],
};

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function ProductIcon({ product, className = "" }: { product: Product; className?: string }) {
  const label = `${product.category || ""} ${product.name}`.toLowerCase();
  const Icon = label.includes("batter")
    ? BatteryCharging
    : label.includes("filter")
      ? Filter
      : label.includes("spark") || label.includes("plug")
        ? Zap
        : label.includes("brake")
          ? Wrench
          : Package;

  return <Icon className={`pos-product-icon ${className}`} aria-hidden="true" strokeWidth={1.8} />;
}

export default function PosBilling() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string; role: string; permissions: string[] } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Items");
  const [payment, setPayment] = useState("Cash");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [settings, setSettings] = useState<PosSettings>(defaultPosSettings);
  const [lastInvoice, setLastInvoice] = useState<{ id: number; date: string; items: CartItem[]; total: number; tax: number; subtotal: number; customerName: string } | null>(null);
  const [shiftState, setShiftState] = useState<"loading" | "unstarted" | "active" | "closing">("loading");
  const [cashAmount, setCashAmount] = useState("");

  const fetchProducts = async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (Array.isArray(data)) {
      return (data as Product[]).map((product) => ({
        ...product,
        category: product.category || "Uncategorized",
        sku: product.sku || `SKU-${String(product.id).padStart(3, "0")}`,
      }));
    }
    return [];
  };

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Not logged in");
        return res.json();
      })
      .then((data) => {
        if (data.role !== "admin" && !data.permissions.includes("pos_billing")) {
          router.push("/");
        } else {
          setUser(data);
          const saved = localStorage.getItem(`pos_shift_${data.id}`);
          if (saved) {
            setShiftState("active");
          } else {
            setShiftState("unstarted");
          }
          setLoadingAuth(false);
        }
      })
      .catch(() => router.push("/"));

    fetchProducts()
      .then((items) => setProducts(items))
      .catch(() => console.error("Error loading products"));
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCustomers(d))
      .catch(() => console.error("Error loading customers"));
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const next = { ...defaultPosSettings, ...data };
        setSettings(next);
        setPayment((current) => Array.isArray(next.payment_methods) && next.payment_methods.includes(current) ? current : next.payment_methods[0] || "Cash");
      })
      .catch(() => setSettings(defaultPosSettings));
  }, [router]);

  const shown = useMemo(() => {
    return products.filter((product) => {
      const matchCategory = category === "All Items" || product.category === category;
      const matchQuery = !query || `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [products, category, query]);

  const productCategories = useMemo(() => {
    const values = Array.from(new Set(products.map((product) => product.category || "Uncategorized")));
    return ["All Items", ...values];
  }, [products]);
  const paymentMethods = settings.payment_methods.length ? settings.payment_methods : defaultPosSettings.payment_methods;
  const taxRate = Number(settings.tax_rate || 0);
  const lowStockCount = products.filter((product) => product.stock_quantity > 0 && product.stock_quantity < 10).length;
  const outOfStockCount = products.filter((product) => product.stock_quantity === 0).length;
  const notificationCount = lowStockCount + outOfStockCount;
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.cartQuantity, 0);
  const tax = subtotal * (Number.isFinite(taxRate) ? taxRate / 100 : 0);
  const total = subtotal + tax;

  const add = (product: Product) => {
    if (product.stock_quantity <= 0) {
      alert("This item is out of stock.");
      return;
    }
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) {
        return current.map((item) =>
          item.id === product.id ? { ...item, cartQuantity: Math.min(item.cartQuantity + 1, product.stock_quantity) } : item
        );
      }
      return [...current, { ...product, cartQuantity: 1 }];
    });
    setLastInvoice(null);
    setNotice("");
  };

  const qty = (id: number, nextQuantity: number) => {
    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, cartQuantity: Math.max(1, Math.min(item.stock_quantity, nextQuantity)) } : item
      )
    );
  };

  const checkout = async () => {
    if (!cart.length) return;
    setChecking(true);
    setNotice("");
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashier_id: user?.id || 1,
          customer_id: customerId === "" ? null : customerId,
          payment_method: payment,
          items: cart.map((item) => ({ product_id: item.id, quantity: item.cartQuantity })),
        }),
      });
      const data = await response.json();

      if (response.ok) {
        const selectedCustomer = customers.find((customer) => customer.id === customerId);
        setLastInvoice({
          id: data.saleId,
          date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          items: [...cart],
          subtotal,
          tax,
          total,
          customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        });
        setNotice("Sale completed successfully.");
        setCart([]);
        setProducts(await fetchProducts());
      } else {
        setNotice(data.error || "Could not complete sale. Please check stock.");
      }
    } catch {
      setNotice("Unable to connect to sales service.");
    } finally {
      setChecking(false);
    }
  };

  const initiateSignOut = () => {
    setShiftState("closing");
    setCashAmount("");
    setShowProfile(false);
  };

  const confirmSignOut = () => {
    if (!cashAmount) return;
    if (user) localStorage.removeItem(`pos_shift_${user.id}`);
    document.cookie = "auth_token=; Max-Age=0; path=/";
    router.push("/");
  };

  if (loadingAuth || !user || shiftState === "loading") {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading POS...</div>;
  }

  if (shiftState === "unstarted" || shiftState === "closing") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }}>
        <div style={{ background: "white", padding: "32px", borderRadius: "12px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
          <h2 style={{ marginTop: 0, marginBottom: "16px", fontSize: "22px", color: "#0f172a" }}>
            {shiftState === "unstarted" ? "Open Cash Drawer" : "Close Cash Drawer"}
          </h2>
          <p style={{ marginBottom: "24px", color: "#64748b", fontSize: "15px", lineHeight: 1.5 }}>
            {shiftState === "unstarted" 
              ? "Please enter the starting cash amount in the drawer to begin your shift."
              : "Please enter the final cash amount in the drawer before logging out."}
          </p>
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 600, color: "#334155" }}>Cash Amount (Rs.)</label>
            <input 
              type="number" 
              value={cashAmount} 
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="e.g. 5000"
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "2px solid #e2e8f0", fontSize: "16px", outline: "none", transition: "border-color 0.2s" }}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            {shiftState === "closing" && (
              <button onClick={() => setShiftState("active")} style={{ padding: "10px 18px", border: "1px solid #cbd5e1", background: "white", color: "#475569", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
            )}
            <button 
              onClick={() => {
                if (!cashAmount) return;
                if (shiftState === "unstarted") {
                  localStorage.setItem(`pos_shift_${user.id}`, JSON.stringify({ status: "active", openingCash: Number(cashAmount), startTime: Date.now() }));
                  setShiftState("active");
                  setCashAmount("");
                } else {
                  confirmSignOut();
                }
              }} 
              disabled={!cashAmount}
              style={{ padding: "10px 18px", background: cashAmount ? "#2563eb" : "#94a3b8", color: "white", border: "none", borderRadius: "6px", cursor: cashAmount ? "pointer" : "not-allowed", fontWeight: 600, transition: "background 0.2s" }}
            >
              {shiftState === "unstarted" ? "Start Shift" : "Confirm & Logout"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredNav = navItems.filter((item) => {
    if (user.role === "admin") return true;
    const req = PERMISSION_MAP[item.href];
    return !req || user.permissions.includes(req);
  });

  return (
    <div className="pos-shell">
      {user.role === "admin" && (
        <aside className="pos-sidebar">
          <div className="pos-logo">
            <span className="admin-logo-mark" aria-hidden="true"><i /></span>
            <div>
              <b>OIL <em>MART</em> <i>POS</i></b>
              <small>Oil &amp; Spare Parts Store</small>
            </div>
          </div>
          <nav>
            {filteredNav.map(({ Icon, label, href }) => (
              <button className={href === "/dashboard" ? "active" : ""} key={href} onClick={() => href !== "/dashboard" && router.push(href)}>
                <Icon className="pos-nav-icon" aria-hidden="true" strokeWidth={1.9} />
                {label}
              </button>
            ))}
          </nav>
          <div className="pos-side-bottom">
            <button><CircleHelp className="pos-nav-icon" aria-hidden="true" /> Help &amp; Support</button>
            <button onClick={initiateSignOut}>
              <LogOut className="pos-nav-icon" aria-hidden="true" /> Logout
            </button>
          </div>
        </aside>
      )}

      <div className="pos-workspace" style={user.role !== "admin" ? { marginLeft: 0, width: "100%" } : {}}>
        <header className="pos-topbar admin-mode-bar">
          <button className="pos-menu" aria-label="Menu"><Menu aria-hidden="true" size={22} /></button>
          <div className="page-title pos-page-title">
            <h1>POS Billing</h1>
            <p>Cashier workspace / Welcome back, {user.username}</p>
          </div>
          <div className="pos-top-actions">
            <button className="pos-status-pill">
              <ShoppingCart size={16} aria-hidden="true" />
              <span>Shift #CSH-001</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            <button className="pos-status-pill">
              <CalendarDays size={16} aria-hidden="true" />
              <span>{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <em><CircleDot size={12} aria-hidden="true" /> Online</em>
            </button>
            <div className="pos-topbar-popover pos-notification-control">
              <button
                className="pos-bell"
                aria-label="Notifications"
                aria-expanded={showNotifications}
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowProfile(false);
                }}
              >
                <Bell aria-hidden="true" size={20} />
                <i>{notificationCount}</i>
              </button>
              {showNotifications && (
                <div className="pos-notification-menu">
                  <header>
                    <b>Notifications</b>
                    <small>Today</small>
                  </header>
                  {(user.role === "admin" || user.permissions.includes("manage_inventory")) && (
                    <button onClick={() => router.push("/admin/inventory")}>
                      <PackageCheck size={16} aria-hidden="true" />
                      <span><b>Low stock alert</b><small>{lowStockCount} items need reorder</small></span>
                    </button>
                  )}
                  {(user.role === "admin" || user.permissions.includes("view_sales")) && (
                    <button onClick={() => router.push("/admin/sales")}>
                      <Receipt size={16} aria-hidden="true" />
                      <span><b>Sales history</b><small>Review latest invoices</small></span>
                    </button>
                  )}
                  {(user.role === "admin" || user.permissions.includes("manage_inventory")) && (
                    <button onClick={() => router.push("/admin/purchases")}>
                      <ShoppingCart size={16} aria-hidden="true" />
                      <span><b>Out of stock</b><small>{outOfStockCount} items need purchase stock</small></span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="pos-topbar-popover pos-profile-control">
              <button
                className="cashier"
                aria-label="Open cashier profile"
                aria-expanded={showProfile}
                onClick={() => {
                  setShowProfile((current) => !current);
                  setShowNotifications(false);
                }}
              >
                <span>{user.username.charAt(0).toUpperCase()}</span>
                <p><b>{user.username}</b><small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small></p>
                <ChevronDown className="cashier-chevron" size={15} aria-hidden="true" />
              </button>
              {showProfile && (
                <div className="profile-menu pos-profile-menu">
                  <div>
                    <span>{user.username.charAt(0).toUpperCase()}</span>
                    <p>
                      <b>{user.username}</b>
                      <small>{user.role === "admin" ? "Super Admin" : "Cashier"}</small>
                    </p>
                  </div>
                  {user.role === "admin" && (
                    <>
                      <button onClick={() => router.push("/admin/dashboard")}>
                        <LayoutDashboard size={16} aria-hidden="true" /> Admin Dashboard
                      </button>
                      <button onClick={() => router.push("/admin/settings")}>
                        <Settings size={16} aria-hidden="true" /> Settings
                      </button>
                    </>
                  )}
                  <button className="danger" onClick={initiateSignOut}>
                    <LogOut size={16} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="pos-main">
          <section className="catalog">
            <div className="product-search">
              <Search className="catalog-icon" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Scan barcode, SKU, part number, or product name" />
              <button aria-label="Scan barcode"><ScanBarcode size={18} aria-hidden="true" /></button>
            </div>

            <div className="category-tabs" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
              {productCategories.map((item) => (
                <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>
                  {item}
                </button>
              ))}
            </div>

            <div className="product-grid">
              {shown.map((product) => (
                <article key={product.id} onClick={() => add(product)} style={{ opacity: product.stock_quantity <= 0 ? 0.5 : 1 }}>
                  <button className="favorite" aria-label={`Favorite ${product.name}`}><Star size={18} aria-hidden="true" /></button>
                  <div className="product-visual"><ProductIcon product={product} className="large" /></div>
                  <h3>{product.name}</h3>
                  <small>Stock: {product.stock_quantity}</small>
                  <p>SKU: {product.sku}</p>
                  <strong>{money(Number(product.price))}</strong>
                </article>
              ))}
              {!shown.length && <div className="no-products">No matching products found.</div>}
            </div>

            <div className="catalog-pagination">
              <span>Showing 1 to {shown.length} of {products.length} items</span>
            </div>

            <div className="customer-bar">
              <div>
                <Users className="catalog-icon" aria-hidden="true" />
                <p>
                  <small>Customer</small>
                  <select value={customerId} onChange={(event) => setCustomerId(event.target.value ? Number(event.target.value) : "")}>
                    <option value="">Walk-in Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `(${customer.phone})` : ""}</option>
                    ))}
                  </select>
                </p>
              </div>
              <button onClick={() => router.push("/admin/customers")}><Plus size={16} aria-hidden="true" /> Manage Customers</button>
              <aside>
                <button className="clear" onClick={() => setCart([])}><Trash2 size={16} aria-hidden="true" /> Clear Cart</button>
              </aside>
            </div>
          </section>

          <aside className="cart-pane">
            <div className="cart-title">
              <h2>Current Cart <small>({cart.length} Items)</small></h2>
            </div>

            <div className="cart-items">
              {cart.map((item) => (
                <article key={item.id}>
                  <div className="cart-thumb"><ProductIcon product={item} /></div>
                  <p>
                    <b>{item.name}</b>
                    <small>SKU: {item.sku}</small>
                  </p>
                  <button className="trash" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.id !== item.id))} aria-label={`Remove ${item.name}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                  <div className="quantity">
                    <button onClick={() => qty(item.id, item.cartQuantity - 1)} aria-label={`Decrease ${item.name}`}><Minus size={14} aria-hidden="true" /></button>
                    <span>{item.cartQuantity}</span>
                    <button onClick={() => qty(item.id, item.cartQuantity + 1)} aria-label={`Increase ${item.name}`}><Plus size={14} aria-hidden="true" /></button>
                  </div>
                  <strong>{money(Number(item.price) * item.cartQuantity)}</strong>
                </article>
              ))}
              {!cart.length && <div className="empty-cart">Your cart is empty<br /><small>Select a product to begin</small></div>}
            </div>

            <div className="totals">
              <p>Subtotal ({cart.length} Items)<b>{money(subtotal)}</b></p>
              <p>Tax ({Number.isFinite(taxRate) ? taxRate : 0}% GST)<b>{money(tax)}</b></p>
              <h3>Total Payable <b>{money(total)}</b></h3>
            </div>

            <div className="payments">
              <h3>Payment Methods</h3>
              <div>
                {paymentMethods.map((method) => {
                  const Icon = paymentIcons[method] || Wallet;
                  return (
                    <button onClick={() => setPayment(method)} className={payment === method ? "active" : ""} key={method}>
                      <span><Icon size={19} aria-hidden="true" /></span>{method}
                    </button>
                  );
                })}
              </div>
              <button className="complete-sale" onClick={checkout} disabled={!cart.length || checking}>
                <Receipt size={17} aria-hidden="true" /> {checking ? "Processing Sale..." : "Complete Sale"}
              </button>
              {notice && <p className="sale-notice" style={{ marginTop: "12px", fontSize: "13px", color: notice.includes("success") ? "#16a34a" : "#dc2626", background: notice.includes("success") ? "#dcfce7" : "#fff1f1", padding: "8px", borderRadius: "4px", textAlign: "center", fontWeight: "bold" }}>{notice}</p>}
            </div>

            {lastInvoice && (
              <div className="invoice" style={{ marginTop: "20px", padding: "16px", border: "2px dashed #cbd5e1", borderRadius: "8px" }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ fontSize: "16px", margin: 0 }}>INVOICE</h2>
                  <b style={{ fontSize: "14px" }}>#{settings.invoice_prefix}-{String(lastInvoice.id).padStart(6, "0")}</b>
                </header>
                <div className="invoice-brand" style={{ marginBottom: "16px", fontSize: "12px" }}>
                  <p>
                    <b style={{ fontSize: "14px", display: "block" }}>{settings.store_name}</b>
                    <small>{settings.store_address}</small>
                    {settings.store_phone && <small style={{ display: "block" }}>Phone: {settings.store_phone}</small>}
                    {settings.gst_number && <small style={{ display: "block" }}>GST: {settings.gst_number}</small>}
                  </p>
                  <aside style={{ textAlign: "right", marginTop: "8px" }}>
                    Date: {lastInvoice.date}<br />
                    Cashier: {user.username}<br />
                    Customer: {lastInvoice.customerName}
                  </aside>
                </div>
                <table style={{ width: "100%", fontSize: "12px", marginBottom: "16px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                      <th style={{ paddingBottom: "4px" }}>Item</th>
                      <th style={{ paddingBottom: "4px" }}>Qty</th>
                      <th style={{ paddingBottom: "4px", textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastInvoice.items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 0" }}>{item.name}</td>
                        <td style={{ padding: "6px 0" }}>{item.cartQuantity}</td>
                        <td style={{ padding: "6px 0", textAlign: "right" }}>{money(Number(item.price) * item.cartQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="invoice-total" style={{ fontSize: "13px", borderTop: "2px solid #e2e8f0", paddingTop: "8px" }}>
                  <p style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>Subtotal <b>{money(lastInvoice.subtotal)}</b></p>
                  <p style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>Tax ({Number.isFinite(taxRate) ? taxRate : 0}% GST) <b>{money(lastInvoice.tax)}</b></p>
                  <h3 style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 0 0", fontSize: "16px" }}>Total <b>{money(lastInvoice.total)}</b></h3>
                </div>
                <small className="thanks" style={{ display: "block", textAlign: "center", marginTop: "16px", color: "#64748b" }}>
                  {settings.invoice_footer}
                </small>
                <div style={{ textAlign: "center", marginTop: "16px" }}>
                  <button onClick={() => window.print()} style={{ background: "#3b82f6", color: "white", padding: "6px 12px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Printer size={15} aria-hidden="true" /> Print Invoice
                  </button>
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
