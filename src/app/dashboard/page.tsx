"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  BadgePercent,
  Banknote,
  BarChart3,
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
  X,
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
  Wallet,
  "Bank Transfer": Banknote,
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
  invoice_logo_text: string;
  invoice_print_style: string;
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
  invoice_logo_text: "OM",
  invoice_print_style: "Dot Matrix",
  payment_methods: ["Cash", "Card", "Bank Transfer"],
};

type CashCycle = {
  id: string;
  openedAt: string;
  openedDate: string;
  openingBalance: number;
};

type LastInvoice = {
  id: number;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountRate: number;
  tax: number;
  total: number;
  customerName: string;
  paymentMethod: string;
  cashReceived?: number;
  cashBalance?: number;
  cycleId?: string;
};

type SummaryScope = "day" | "month" | "year";

type SaleSummaryRow = {
  id: number;
  total_amount: string | number;
  discount_amount?: string | number;
  tax_amount?: string | number;
  payment_method: string;
  status: string;
  created_at: string;
  item_count: string | number;
  sales_cycle_id?: string | null;
};

type SummaryTotals = {
  invoiceCount: number;
  itemCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  bankSales: number;
  discount: number;
  tax: number;
};

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function businessDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cashierCycleKey(userId: number) {
  return `oil-mart-cash-cycle-${userId}-${businessDate(new Date())}`;
}

function localDateTimeValue(date: Date) {
  const datePart = businessDate(date);
  const timePart = date.toTimeString().slice(0, 8);
  return `${datePart} ${timePart}`;
}

function cycleIdFor(date: Date, userId: number) {
  const day = businessDate(date).replace(/-/g, "");
  const time = date.toTimeString().slice(0, 8).replace(/:/g, "");
  return `CSH-${day}-${String(userId).padStart(3, "0")}-${time}`;
}

function summaryRange(scope: SummaryScope, date: Date) {
  const start = new Date(date);
  const end = new Date(date);
  if (scope === "day") {
    return { from: businessDate(start), to: businessDate(end), label: "Today" };
  }
  if (scope === "month") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
    return { from: businessDate(start), to: businessDate(end), label: date.toLocaleString("en-IN", { month: "long", year: "numeric" }) };
  }
  start.setMonth(0, 1);
  end.setMonth(11, 31);
  return { from: businessDate(start), to: businessDate(end), label: String(date.getFullYear()) };
}

function calculateSummary(rows: SaleSummaryRow[], cashCycle: CashCycle | null, scope: SummaryScope): SummaryTotals {
  const currentCycleRows = cashCycle ? rows.filter((row) => row.sales_cycle_id === cashCycle.id) : rows;
  const sourceRows = scope === "day" && currentCycleRows.length ? currentCycleRows : rows;
  return sourceRows.reduce(
    (totals, row) => {
      const totalAmount = Number(row.total_amount || 0);
      totals.invoiceCount += 1;
      totals.itemCount += Number(row.item_count || 0);
      totals.totalSales += totalAmount;
      totals.discount += Number(row.discount_amount || 0);
      totals.tax += Number(row.tax_amount || 0);
      if (row.payment_method === "Cash") totals.cashSales += totalAmount;
      if (row.payment_method === "Card") totals.cardSales += totalAmount;
      if (row.payment_method === "Bank Transfer") totals.bankSales += totalAmount;
      return totals;
    },
    { invoiceCount: 0, itemCount: 0, totalSales: 0, cashSales: 0, cardSales: 0, bankSales: 0, discount: 0, tax: 0 }
  );
}

function normalizePaymentMethods(methods: string[]) {
  const normalized = methods.map((method) => method === "UPI" ? "Bank Transfer" : method);
  return Array.from(new Set(normalized)).filter((method) => method !== "UPI");
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<{ id: number; username: string; role: string; permissions: string[] } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Items");
  const [payment, setPayment] = useState("Cash");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [settings, setSettings] = useState<PosSettings>(defaultPosSettings);
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null);
  const [cashCycle, setCashCycle] = useState<CashCycle | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [discountRate, setDiscountRate] = useState("0");
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [summaryScope, setSummaryScope] = useState<SummaryScope>("day");
  const [summaryRows, setSummaryRows] = useState<SaleSummaryRow[]>([]);
  const [summaryRefresh, setSummaryRefresh] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingBalance, setClosingBalance] = useState("");
  const [closingNotice, setClosingNotice] = useState("");

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
  const currentBusinessDate = businessDate(currentTime);

  const loadCashierSummary = useCallback(async (scope: SummaryScope = summaryScope) => {
    if (!user || user.role === "admin") return [];
    const range = summaryRange(scope, new Date(`${currentBusinessDate}T00:00:00`));
    const params = new URLSearchParams({
      cashier: user.username,
      date_from: range.from,
      date_to: range.to,
    });
    const response = await fetch(`/api/sales?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    const rows = Array.isArray(data) ? data as SaleSummaryRow[] : [];
    setSummaryRows(rows);
    return rows;
  }, [currentBusinessDate, summaryScope, user]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
        next.payment_methods = normalizePaymentMethods(Array.isArray(next.payment_methods) ? next.payment_methods : defaultPosSettings.payment_methods);
        setSettings(next);
        setPayment((current) => Array.isArray(next.payment_methods) && next.payment_methods.includes(current) ? current : next.payment_methods[0] || "Cash");
      })
      .catch(() => setSettings(defaultPosSettings));
  }, [router]);

  useEffect(() => {
    if (!user || user.role === "admin") return;
    const saved = window.localStorage.getItem(cashierCycleKey(user.id));
    if (saved) {
      try {
        const restoredCycle = JSON.parse(saved) as CashCycle;
        window.setTimeout(() => setCashCycle(restoredCycle), 0);
      } catch {
        window.localStorage.removeItem(cashierCycleKey(user.id));
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role === "admin" || !cashCycle) return;
    let active = true;
    const timer = window.setTimeout(() => {
      loadCashierSummary()
        .then((rows) => {
          if (!active) return;
          setSummaryRows(rows);
        })
        .catch(() => {
          if (active) setSummaryRows([]);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cashCycle, loadCashierSummary, summaryRefresh, user]);

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
  const paymentMethods = normalizePaymentMethods(settings.payment_methods.length ? settings.payment_methods : defaultPosSettings.payment_methods);
  const taxRate = Number(settings.tax_rate || 0);
  const lowStockCount = products.filter((product) => product.stock_quantity > 0 && product.stock_quantity < 10).length;
  const outOfStockCount = products.filter((product) => product.stock_quantity === 0).length;
  const notificationCount = lowStockCount + outOfStockCount;
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.cartQuantity, 0);
  const normalizedDiscountRate = Math.min(100, Math.max(0, Number(discountRate || 0)));
  const discount = subtotal * (Number.isFinite(normalizedDiscountRate) ? normalizedDiscountRate / 100 : 0);
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * (Number.isFinite(taxRate) ? taxRate / 100 : 0);
  const total = taxableAmount + tax;
  const summaryTotals = useMemo(() => {
    return calculateSummary(summaryRows, cashCycle, summaryScope);
  }, [cashCycle, summaryRows, summaryScope]);

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

  const startCashCycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const balance = Number(openingBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setNotice("Enter a valid opening cash balance.");
      return;
    }
    setChecking(true);
    setNotice("");
    const nextCycle: CashCycle = {
      id: cycleIdFor(currentTime, user.id),
      openedAt: currentTime.toISOString(),
      openedDate: businessDate(currentTime),
      openingBalance: balance,
    };
    try {
      const response = await fetch("/api/sales/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: nextCycle.id,
          cashier_id: user.id,
          opened_at: localDateTimeValue(currentTime),
          opened_date: nextCycle.openedDate,
          opening_balance: balance,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open sales cycle.");
      window.localStorage.setItem(cashierCycleKey(user.id), JSON.stringify(nextCycle));
      setCashCycle(nextCycle);
      setNotice("");
      setClosingNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to open sales cycle.");
    } finally {
      setChecking(false);
    }
  };

  const closeCashCycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !cashCycle) return;
    const balance = Number(closingBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      setClosingNotice("Enter a valid closing cash balance.");
      return;
    }
    setChecking(true);
    setClosingNotice("");
    try {
      const response = await fetch("/api/sales/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cashCycle.id,
          cashier_id: user.id,
          opened_at: localDateTimeValue(new Date(cashCycle.openedAt)),
          opened_date: cashCycle.openedDate,
          opening_balance: cashCycle.openingBalance,
          closing_balance: balance,
          closed_at: localDateTimeValue(currentTime),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to close sales cycle.");
      window.localStorage.removeItem(cashierCycleKey(user.id));
      setCashCycle(null);
      setCart([]);
      setLastInvoice(null);
      setOpeningBalance("");
      setClosingBalance("");
      setShowCloseModal(false);
      setSummaryRows([]);
      setSummaryRefresh((current) => current + 1);
      setNotice(`Sales cycle closed. Closing cash: ${money(balance)}.`);
      signOut();
    } catch (error) {
      setClosingNotice(error instanceof Error ? error.message : "Unable to close sales cycle.");
    } finally {
      setChecking(false);
    }
  };

  const openCloseCycle = async () => {
    if (!cashCycle) return;
    setClosingNotice("");
    try {
      const rows = await loadCashierSummary("day");
      const latestTotals = calculateSummary(rows, cashCycle, "day");
      setClosingBalance(((cashCycle.openingBalance || 0) + latestTotals.cashSales).toFixed(2));
    } catch {
      setClosingBalance(expectedClosingCash.toFixed(2));
    } finally {
      setShowCloseModal(true);
    }
  };

  const completeSale = () => {
    if (!cart.length) return;
    setNotice("");
    if (payment === "Cash") {
      setCashReceived(total ? total.toFixed(2) : "");
      setShowCashModal(true);
      return;
    }
    void checkout();
  };

  const checkout = async (cashAmount?: number) => {
    if (!cart.length) return;
    if (payment === "Cash" && (cashAmount === undefined || !Number.isFinite(cashAmount) || cashAmount < total)) {
      setNotice("Cash received must be equal to or greater than total payable.");
      return;
    }
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
          subtotal_amount: subtotal,
          discount_rate: normalizedDiscountRate,
          discount_amount: discount,
          tax_rate: taxRate,
          tax_amount: tax,
          business_date: currentBusinessDate,
          cash_received: payment === "Cash" ? cashAmount : null,
          cash_balance: payment === "Cash" && cashAmount !== undefined ? cashAmount - total : null,
          sales_cycle_id: cashCycle?.id || null,
          opening_cash_balance: cashCycle?.openingBalance || null,
          items: cart.map((item) => ({ product_id: item.id, quantity: item.cartQuantity })),
        }),
      });
      const data = await response.json();

      if (response.ok) {
        const selectedCustomer = customers.find((customer) => customer.id === customerId);
        setLastInvoice({
          id: data.saleId,
          date: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          items: [...cart],
          subtotal,
          discount,
          discountRate: normalizedDiscountRate,
          tax,
          total,
          customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
          paymentMethod: payment,
          cashReceived: payment === "Cash" ? cashAmount : undefined,
          cashBalance: payment === "Cash" && cashAmount !== undefined ? cashAmount - total : undefined,
          cycleId: cashCycle?.id,
        });
        setNotice("Sale completed successfully.");
        setCart([]);
        setShowCashModal(false);
        setCashReceived("");
        setProducts(await fetchProducts());
        await loadCashierSummary("day");
        setSummaryRefresh((current) => current + 1);
      } else {
        setNotice(data.error || "Could not complete sale. Please check stock.");
      }
    } catch {
      setNotice("Unable to connect to sales service.");
    } finally {
      setChecking(false);
    }
  };

  const signOut = () => {
    document.cookie = "auth_token=; Max-Age=0; path=/";
    router.push("/");
  };

  if (loadingAuth || !user) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading POS...</div>;
  }

  const isAdmin = user.role === "admin";
  const isCashier = !isAdmin;
  const shiftLabel = cashCycle?.id || "Open Shift";
  const displayDate = currentTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const displayTime = currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const cashReceivedAmount = Number(cashReceived);
  const hasValidCashReceived = Number.isFinite(cashReceivedAmount);
  const cashReturn = hasValidCashReceived ? cashReceivedAmount - total : -total;
  const activeSummaryRange = summaryRange(summaryScope, new Date(`${currentBusinessDate}T00:00:00`));
  const expectedClosingCash = (cashCycle?.openingBalance || 0) + summaryTotals.cashSales;
  const closingBalanceAmount = Number(closingBalance);
  const hasValidClosingBalance = Number.isFinite(closingBalanceAmount);
  const closingDifference = hasValidClosingBalance ? closingBalanceAmount - expectedClosingCash : 0;

  const filteredNav = navItems.filter((item) => {
    if (isAdmin) return true;
    const req = PERMISSION_MAP[item.href];
    return !req || user.permissions.includes(req);
  });

  return (
    <div className={`pos-shell ${isCashier ? "cashier-pos-shell" : ""} ${mobileNavOpen ? " sidebar-mobile-open" : ""}`}>
      <div className="mobile-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
      {isAdmin && (
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
              <button 
                className={href === "/dashboard" ? "active" : ""} 
                key={href} 
                onClick={() => {
                  if (href !== "/dashboard") router.push(href);
                  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
                    setMobileNavOpen(false);
                  }
                }}
              >
                <Icon className="pos-nav-icon" aria-hidden="true" strokeWidth={1.9} />
                {label}
              </button>
            ))}
          </nav>
          <div className="pos-side-bottom">
            <button><CircleHelp className="pos-nav-icon" aria-hidden="true" /> Help &amp; Support</button>
            <button onClick={signOut}>
              <LogOut className="pos-nav-icon" aria-hidden="true" /> Logout
            </button>
          </div>
        </aside>
      )}

      <div className="pos-workspace" style={user.role !== "admin" ? { marginLeft: 0, width: "100%" } : {}}>
        <header className="pos-topbar admin-mode-bar">
          {isAdmin && (
            <button 
              className="pos-menu" 
              aria-label="Menu"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              <Menu aria-hidden="true" size={22} />
            </button>
          )}
          <div className="page-title pos-page-title">
            <h1>POS Billing</h1>
            <p>{isCashier ? "Cashier workspace" : "Admin billing workspace"} / Welcome back, {user.username}</p>
          </div>
          <div className="pos-top-actions">
            <button className="pos-status-pill">
              <ShoppingCart size={16} aria-hidden="true" />
              <span>{shiftLabel}</span>
            </button>
            <button className="pos-status-pill">
              <CalendarDays size={16} aria-hidden="true" />
              <span>{displayDate} / {displayTime}</span>
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
                  <button onClick={() => isAdmin && router.push("/admin/inventory")}>
                    <PackageCheck size={16} aria-hidden="true" />
                    <span><b>Low stock alert</b><small>{lowStockCount} items need reorder</small></span>
                  </button>
                  <button onClick={() => isAdmin && router.push("/admin/sales")}>
                    <Receipt size={16} aria-hidden="true" />
                    <span><b>Sales history</b><small>Review latest invoices</small></span>
                  </button>
                  <button onClick={() => isAdmin && router.push("/admin/purchases")}>
                    <ShoppingCart size={16} aria-hidden="true" />
                    <span><b>Out of stock</b><small>{outOfStockCount} items need purchase stock</small></span>
                  </button>
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
                  {isAdmin && (
                    <>
                      <button onClick={() => router.push("/admin/dashboard")}>
                        <LayoutDashboard size={16} aria-hidden="true" /> Admin Dashboard
                      </button>
                      <button onClick={() => router.push("/admin/settings")}>
                        <Settings size={16} aria-hidden="true" /> Settings
                      </button>
                    </>
                  )}
                  <button>
                    <CircleHelp size={16} aria-hidden="true" /> Help &amp; Support
                  </button>
                  <button className="danger" onClick={signOut}>
                    <LogOut size={16} aria-hidden="true" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {isCashier && !cashCycle ? (
          <main className="cash-opening-shell">
            <section className="cash-opening-card">
              <div className="cash-opening-icon"><Banknote size={26} aria-hidden="true" /></div>
              <div>
                <h2>Open Cashier Shift</h2>
                <p>Enter the opening cash balance before starting POS billing.</p>
              </div>
              <dl>
                <div><dt>Cashier</dt><dd>{user.username}</dd></div>
                <div><dt>Date</dt><dd>{displayDate}</dd></div>
                <div><dt>Time</dt><dd>{displayTime}</dd></div>
                <div><dt>Sales Cycle</dt><dd>{cycleIdFor(currentTime, user.id)}</dd></div>
              </dl>
              <form onSubmit={startCashCycle}>
                <label>
                  Opening Cash Balance
                  <span>
                    <Banknote size={18} aria-hidden="true" />
                    <input
                      value={openingBalance}
                      onChange={(event) => setOpeningBalance(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      autoFocus
                    />
                  </span>
                </label>
                <button type="submit">Start POS Billing</button>
              </form>
              {notice && <p className="cash-opening-notice">{notice}</p>}
            </section>
          </main>
        ) : (
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
              {isAdmin ? (
                <button onClick={() => router.push("/admin/customers")}><Plus size={16} aria-hidden="true" /> Manage Customers</button>
              ) : (
                <span className="cashier-shift-chip"><Banknote size={15} aria-hidden="true" /> Opening Cash {money(cashCycle?.openingBalance || 0)}</span>
              )}
              <aside>
                <button className="clear" onClick={() => setCart([])}><Trash2 size={16} aria-hidden="true" /> Clear Cart</button>
              </aside>
            </div>

            {isCashier && (
              <section className="cashier-summary-card">
                <header>
                  <div>
                    <h2><BarChart3 size={18} aria-hidden="true" /> Sales Summary</h2>
                    <p>{activeSummaryRange.label} / {cashCycle?.id}</p>
                  </div>
                  <div className="summary-tabs">
                    {(["day", "month", "year"] as SummaryScope[]).map((scope) => (
                      <button
                        key={scope}
                        className={summaryScope === scope ? "active" : ""}
                        onClick={() => setSummaryScope(scope)}
                      >
                        {scope === "day" ? "Day" : scope === "month" ? "Month" : "Year"}
                      </button>
                    ))}
                  </div>
                </header>
                <div className="summary-metrics">
                  <p><small>Invoices</small><b>{summaryTotals.invoiceCount}</b></p>
                  <p><small>Items Sold</small><b>{summaryTotals.itemCount}</b></p>
                  <p><small>Total Sales</small><b>{money(summaryTotals.totalSales)}</b></p>
                  <p><small>Cash Sales</small><b>{money(summaryTotals.cashSales)}</b></p>
                  <p><small>Card</small><b>{money(summaryTotals.cardSales)}</b></p>
                  <p><small>Bank Transfer</small><b>{money(summaryTotals.bankSales)}</b></p>
                  <p><small>Discount</small><b>{money(summaryTotals.discount)}</b></p>
                  <p><small>Expected Cash</small><b>{money(expectedClosingCash)}</b></p>
                </div>
                <footer>
                  <span>Opening Cash: <b>{money(cashCycle?.openingBalance || 0)}</b></span>
                  <button onClick={() => void openCloseCycle()}>
                    <X size={16} aria-hidden="true" /> Close Sales Cycle
                  </button>
                </footer>
              </section>
            )}
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
              <label className="discount-row">
                <span><BadgePercent size={16} aria-hidden="true" /> Customer Discount</span>
                <input
                  value={discountRate}
                  onChange={(event) => setDiscountRate(event.target.value)}
                  inputMode="decimal"
                  aria-label="Discount percentage"
                />
                <em>%</em>
              </label>
              <p>Discount ({Number.isFinite(normalizedDiscountRate) ? normalizedDiscountRate : 0}%)<b>- {money(discount)}</b></p>
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
              <button className="complete-sale" onClick={completeSale} disabled={!cart.length || checking}>
                <Receipt size={17} aria-hidden="true" /> {checking ? "Processing Sale..." : "Complete Sale"}
              </button>
              {notice && <p className="sale-notice" style={{ marginTop: "12px", fontSize: "13px", color: notice.includes("success") ? "#16a34a" : "#dc2626", background: notice.includes("success") ? "#dcfce7" : "#fff1f1", padding: "8px", borderRadius: "4px", textAlign: "center", fontWeight: "bold" }}>{notice}</p>}
            </div>

            {lastInvoice && (
              <div className={`invoice printable-invoice ${settings.invoice_print_style === "Dot Matrix" ? "dot-matrix-invoice" : "standard-print-invoice"}`}>
                <header>
                  <div className="invoice-store-head">
                    <span className="invoice-logo-mark">{settings.invoice_logo_text || "OM"}</span>
                    <p>
                      <b>{settings.store_name}</b>
                      <small>{settings.store_address}</small>
                    </p>
                  </div>
                  <aside>
                    <h2>INVOICE</h2>
                    <b>#{settings.invoice_prefix}-{String(lastInvoice.id).padStart(6, "0")}</b>
                  </aside>
                </header>
                <div className="invoice-brand">
                  <p>
                    {settings.store_phone && <small>Phone: {settings.store_phone}</small>}
                    {settings.gst_number && <small>GST: {settings.gst_number}</small>}
                    {lastInvoice.cycleId && <small>Cycle: {lastInvoice.cycleId}</small>}
                  </p>
                  <aside>
                    Date: {lastInvoice.date}<br />
                    Cashier: {user.username}<br />
                    Customer: {lastInvoice.customerName}<br />
                    Payment: {lastInvoice.paymentMethod}
                  </aside>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastInvoice.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.cartQuantity}</td>
                        <td>{money(Number(item.price) * item.cartQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="invoice-total">
                  <p>Subtotal <b>{money(lastInvoice.subtotal)}</b></p>
                  <p>Discount ({lastInvoice.discountRate}%) <b>- {money(lastInvoice.discount)}</b></p>
                  <p>Tax ({Number.isFinite(taxRate) ? taxRate : 0}% GST) <b>{money(lastInvoice.tax)}</b></p>
                  {lastInvoice.paymentMethod === "Cash" && (
                    <>
                      <p>Cash Received <b>{money(lastInvoice.cashReceived || 0)}</b></p>
                      <p>Balance Returned <b>{money(lastInvoice.cashBalance || 0)}</b></p>
                    </>
                  )}
                  <h3>Total <b>{money(lastInvoice.total)}</b></h3>
                </div>
                <small className="thanks">
                  {settings.invoice_footer}
                </small>
                <div className="no-print invoice-print-actions">
                  <button onClick={() => {
                    setNotice("Print command sent successfully.");
                    window.print();
                    setTimeout(() => setNotice(""), 4000);
                  }}>
                    <Printer size={15} aria-hidden="true" /> Print Invoice
                  </button>
                </div>
              </div>
            )}
          </aside>
          {showCashModal && (
            <div className="cash-modal-backdrop">
              <form
                className="cash-modal"
                onSubmit={(event) => {
                  event.preventDefault();
                  void checkout(cashReceivedAmount);
                }}
              >
                <div className="cash-modal-icon"><Banknote size={24} aria-hidden="true" /></div>
                <h2>Cash Payment</h2>
                <p>Enter the amount received from the customer before generating the invoice.</p>
                <div className="cash-modal-total">
                  <span>Total Payable</span>
                  <b>{money(total)}</b>
                </div>
                <label>
                  Cash Received
                  <input
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                <div className={cashReturn < 0 ? "cash-return negative" : "cash-return"}>
                  <span>Balance Return</span>
                  <b>{money(Math.max(0, cashReturn))}</b>
                </div>
                <footer>
                  <button type="button" onClick={() => setShowCashModal(false)}>Cancel</button>
                  <button type="submit" disabled={checking || !hasValidCashReceived || cashReturn < 0}>
                    <Printer size={16} aria-hidden="true" /> Generate Invoice
                  </button>
                </footer>
              </form>
            </div>
          )}
          {showCloseModal && (
            <div className="cash-modal-backdrop">
              <form className="cash-modal close-cycle-modal" onSubmit={closeCashCycle}>
                <div className="cash-modal-icon"><X size={24} aria-hidden="true" /></div>
                <h2>Close Sales Cycle</h2>
                <p>Enter the closing cash balance to finish today&apos;s cashier cycle.</p>
                <div className="close-cycle-grid">
                  <p><small>Cycle</small><b>{cashCycle?.id}</b></p>
                  <p><small>Invoices</small><b>{summaryTotals.invoiceCount}</b></p>
                  <p><small>Total Sales</small><b>{money(summaryTotals.totalSales)}</b></p>
                  <p><small>Cash Sales</small><b>{money(summaryTotals.cashSales)}</b></p>
                  <p><small>Opening Cash</small><b>{money(cashCycle?.openingBalance || 0)}</b></p>
                  <p><small>Expected Cash</small><b>{money(expectedClosingCash)}</b></p>
                </div>
                <label>
                  Closing Cash Balance
                  <input
                    value={closingBalance}
                    onChange={(event) => setClosingBalance(event.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                <div className={closingDifference < 0 ? "cash-return negative" : "cash-return"}>
                  <span>Cash Difference</span>
                  <b>{money(closingDifference)}</b>
                </div>
                {closingNotice && <p className="cash-opening-notice">{closingNotice}</p>}
                <footer>
                  <button type="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
                  <button type="submit" disabled={checking || !hasValidClosingBalance}>
                    <X size={16} aria-hidden="true" /> Close Cycle
                  </button>
                </footer>
              </form>
            </div>
          )}
        </main>
        )}
      </div>
    </div>
  );
}
