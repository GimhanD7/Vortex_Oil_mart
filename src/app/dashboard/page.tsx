"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { HelpSupportButton } from "@/components/HelpSupport";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ProductCategoryIcon } from "@/components/ProductCategoryIcon";
import { useToast } from "@/components/ToastProvider";
import {
  BadgePercent,
  Banknote,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  CircleDot,
  ClipboardList,
  CreditCard,
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
  RotateCcw,
  ScanBarcode,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Star,
  Replace,
  Trash2,
  TrendingUp,
  X,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const PERMISSION_MAP: Record<string, string> = {
  "/admin/sales": "view_sales",
  "/admin/products": "manage_products",
  "/admin/inventory": "view_inventory",
  "/admin/customers": "manage_customers",
  "/admin/reports": "view_reports",
  "/admin/dashboard": "view_reports",
  "/admin/users": "manage_users",
  "/admin/purchases": "manage_inventory",
  "/admin/settings": "manage_settings",
  "/dashboard": "pos_billing",
};

type Product = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  product_type?: "packaged" | "loose_oil" | string;
  unit?: string;
  barrel_capacity_liters?: number | string | null;
  category?: string;
  sub_category?: string;
  sku?: string;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  customer_type: string;
  status?: string;
  credit_limit?: string | number;
  outstanding_balance?: string | number;
  total_purchases?: string | number;
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
  tax_rate: "0",
  invoice_prefix: "INV",
  invoice_footer: "Thank you for your visit. Drive safe. Stay protected.",
  invoice_logo_text: "OM",
  invoice_print_style: "Dot Matrix",
  payment_methods: ["Cash", "Card", "Bank Transfer", "Credit"],
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
  creditOutstanding?: number;
  creditAvailable?: number;
};

type RevocationApproval = {
  approver_username?: string;
  approver_pin?: string;
};

type PendingRevocation = {
  kind: string;
  title: string;
  message: string;
  affectedAmount: number;
  reasons: string[];
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
  onConfirm: (reason: string, approval?: RevocationApproval) => Promise<void> | void;
};

type SaleSummaryRow = {
  id: number;
  subtotal_amount?: string | number;
  discount_rate?: string | number;
  discount_amount?: string | number;
  tax_rate?: string | number;
  tax_amount?: string | number;
  cash_received?: string | number | null;
  cash_balance?: string | number | null;
  total_amount: string | number;
  payment_method: string;
  status: string;
  created_at: string;
  item_count: string | number;
  sales_cycle_id?: string | null;
  customer_name?: string | null;
  cashier_name?: string | null;
  returned_amount?: string | number;
};

type ReturnableItem = {
  sale_item_id: number;
  product_id: number;
  product_name: string;
  quantity: string | number;
  returned_quantity: string | number;
  price_at_time: string | number;
  unit?: string;
};

type InvoiceDetail = { sale: SaleSummaryRow; items: ReturnableItem[] };

type SummaryTotals = {
  invoiceCount: number;
  itemCount: number;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  bankSales: number;
  creditSales: number;
  discount: number;
  tax: number;
};

type CreditCollectionTotals = {
  Cash: number;
  Card: number;
  "Bank Transfer": number;
};

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function formatQty(value: string | number, unit = "Unit") {
  const quantity = Number(value || 0);
  const formatted = Number.isInteger(quantity)
    ? quantity.toLocaleString("en-IN")
    : quantity.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return `${formatted} ${unit || "Unit"}`;
}

function isLooseOil(product: Pick<Product, "product_type" | "unit">) {
  return product.product_type === "loose_oil" || (product.unit || "").toLowerCase() === "l";
}

function saleStep(product: Product) {
  return isLooseOil(product) ? 0.25 : 1;
}

function normalizeSaleQuantity(product: Product, nextQuantity: number) {
  const step = saleStep(product);
  const minimum = isLooseOil(product) ? step : 1;
  const clamped = Math.max(minimum, Math.min(Number(product.stock_quantity || 0), nextQuantity));
  return Number(clamped.toFixed(3));
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

function summaryRange(date: Date) {
  return { from: businessDate(date), to: businessDate(date), label: "Today" };
}

function calculateSummary(rows: SaleSummaryRow[], cashCycle: CashCycle | null): SummaryTotals {
  const sourceRows = cashCycle ? rows.filter((row) => row.sales_cycle_id === cashCycle.id) : rows;
  return sourceRows.reduce(
    (totals, row) => {
      totals.invoiceCount += 1;
      if (row.status === "cancelled" || row.status === "voided") return totals;
      const totalAmount = Math.max(0, Number(row.total_amount || 0) - Number(row.returned_amount || 0));
      totals.itemCount += Number(row.item_count || 0);
      totals.totalSales += totalAmount;
      totals.discount += Number(row.discount_amount || 0);
      totals.tax += Number(row.tax_amount || 0);
      if (row.payment_method === "Cash") totals.cashSales += totalAmount;
      if (row.payment_method === "Card") totals.cardSales += totalAmount;
      if (row.payment_method === "Bank Transfer") totals.bankSales += totalAmount;
      if (row.payment_method === "Credit") totals.creditSales += totalAmount;
      return totals;
    },
    { invoiceCount: 0, itemCount: 0, totalSales: 0, cashSales: 0, cardSales: 0, bankSales: 0, creditSales: 0, discount: 0, tax: 0 }
  );
}

function normalizePaymentMethods(methods: string[]) {
  const normalized = methods.map((method) => method === "UPI" ? "Bank Transfer" : method);
  return Array.from(new Set(normalized)).filter((method) => method !== "UPI");
}

const revokeReasons = {
  item: ["Wrong product selected", "Incorrect quantity entered", "Duplicate item added", "Customer changed item", "Other correction"],
  discount: ["Wrong discount applied", "Customer not eligible for discount", "Discount entered by mistake", "Other correction"],
  payment: ["Wrong payment method selected", "Incorrect amount entered", "Customer changes from cash to card", "Customer changes payment method", "Other correction"],
  sale: ["Sale was completed accidentally", "Duplicate transaction was created", "Payment succeeded but the wrong items were billed", "Customer cancelled before payment", "Other correction"],
  return: ["Wrong return item selected", "Incorrect refund quantity or amount", "Customer decides not to return the product", "Other correction"],
  held: ["Customer does not return", "Duplicate held order exists", "Order is no longer required", "Other correction"],
};

export default function PosBilling() {
  const { showToast } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<{ id: number; username: string; role: string; permissions: string[] } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Returns & Exchanges panel
  const [showReturnsPanel, setShowReturnsPanel] = useState(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState("");
  const [returnSearchLoading, setReturnSearchLoading] = useState(false);
  const [returnInvoice, setReturnInvoice] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnIsPastDate, setReturnIsPastDate] = useState(false);
  const [returnSelectedItems, setReturnSelectedItems] = useState<Record<number, { quantity: number, disposition: string }>>({});
  const [returnAdminModalOpen, setReturnAdminModalOpen] = useState(false);
  const [returnAdminUsername, setReturnAdminUsername] = useState("");
  const [returnAdminPassword, setReturnAdminPassword] = useState("");
  const [returnVerifyingAdmin, setReturnVerifyingAdmin] = useState(false);
  const [returnResolutionType, setReturnResolutionType] = useState<"Cash" | "Exchange">("Cash");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  // Sales list for returns browse
  const [returnSalesList, setReturnSalesList] = useState<any[]>([]);
  const [returnSalesLoading, setReturnSalesLoading] = useState(false);
  const [returnDateFrom, setReturnDateFrom] = useState("");
  const [returnDateTo, setReturnDateTo] = useState("");
  const [returnDirectMode, setReturnDirectMode] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Items");
  const [subCategory, setSubCategory] = useState("All");
  const [payment, setPayment] = useState("Cash");
  const [customerId, setCustomerId] = useState<number | "">("");
  const [checking, setChecking] = useState(false);
  const [, setNotice] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [settings, setSettings] = useState<PosSettings>(defaultPosSettings);
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null);
  const [cashCycle, setCashCycle] = useState<CashCycle | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [discountRate, setDiscountRate] = useState("0");
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [summaryRows, setSummaryRows] = useState<SaleSummaryRow[]>([]);
  const [summaryRefresh, setSummaryRefresh] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingBalance, setClosingBalance] = useState("");
  const [, setClosingNotice] = useState("");
  const [revocationModal, setRevocationModal] = useState<PendingRevocation | null>(null);
  const [revocationReason, setRevocationReason] = useState("");
  const [revocationNotes, setRevocationNotes] = useState("");
  const [approverUsername, setApproverUsername] = useState("");
  const [approverPin, setApproverPin] = useState("");
  const [revocationSaving, setRevocationSaving] = useState(false);
  const [creditCollectionTotals, setCreditCollectionTotals] = useState<CreditCollectionTotals>({ Cash: 0, Card: 0, "Bank Transfer": 0 });
  const [showCreditPaymentModal, setShowCreditPaymentModal] = useState(false);
  const [creditPaymentAmount, setCreditPaymentAmount] = useState("");
  const [creditPaymentMethod, setCreditPaymentMethod] = useState("Cash");
  const [creditPaymentReference, setCreditPaymentReference] = useState("");
  const [creditPaymentNotes, setCreditPaymentNotes] = useState("");
  const [creditPaymentSaving, setCreditPaymentSaving] = useState(false);
  const [showCycleInvoices, setShowCycleInvoices] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [returnResolution, setReturnResolution] = useState("Cash");
  const [returnDisposition, setReturnDisposition] = useState("resellable");
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [exchangeOriginalId, setExchangeOriginalId] = useState<number | null>(null);

  const fetchProducts = async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    const data = await response.json();
    if (Array.isArray(data)) {
      return (data as Product[]).map((product) => ({
        ...product,
        category: product.category || "Uncategorized",
        sub_category: product.sub_category || "General",
        product_type: product.product_type || "packaged",
        unit: product.unit || "Unit",
        sku: product.sku || `SKU-${String(product.id).padStart(3, "0")}`,
      }));
    }
    return [];
  };
  const currentBusinessDate = businessDate(currentTime);

  const loadCashierSummary = useCallback(async () => {
    if (!user) return [];
    const range = summaryRange(new Date(`${currentBusinessDate}T00:00:00`));
    const params = new URLSearchParams({
      cashier: user.username,
      date_from: range.from,
      date_to: range.to,
    });
    const response = await fetch(`/api/sales?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    const rows = Array.isArray(data) ? data as SaleSummaryRow[] : [];
    setSummaryRows(rows);
    const collectionParams = new URLSearchParams({ date: currentBusinessDate });
    if (cashCycle?.id) collectionParams.set("sales_cycle_id", cashCycle.id);
    try {
      const collectionResponse = await fetch(`/api/customers/credit-collections?${collectionParams.toString()}`, { cache: "no-store" });
      const collectionData = await collectionResponse.json();
      if (collectionResponse.ok && collectionData.totals) {
        setCreditCollectionTotals({
          Cash: Number(collectionData.totals.Cash || 0),
          Card: Number(collectionData.totals.Card || 0),
          "Bank Transfer": Number(collectionData.totals["Bank Transfer"] || 0),
        });
      }
    } catch {
      setCreditCollectionTotals({ Cash: 0, Card: 0, "Bank Transfer": 0 });
    }
    return rows;
  }, [cashCycle, currentBusinessDate, user]);

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

  const autoCloseExpiredCycle = useCallback(async (cycle: CashCycle) => {
    if (!user) return;
    try {
      const endOfDayTimestamp = `${cycle.openedDate} 23:59:59`;
      const params = new URLSearchParams({
        cashier: user.username,
        date_from: cycle.openedDate,
        date_to: cycle.openedDate,
      });
      const response = await fetch(`/api/sales?${params.toString()}`, { cache: "no-store" });
      const rows = await response.json();
      const cycleRows = Array.isArray(rows) ? rows.filter((r: any) => r.sales_cycle_id === cycle.id) : [];
      const totals = calculateSummary(cycleRows, cycle);
      const expectedClosingCash = (cycle.openingBalance || 0) + totals.cashSales;

      await fetch("/api/sales/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cycle.id,
          cashier_id: user.id,
          opened_at: localDateTimeValue(new Date(cycle.openedAt)),
          opened_date: cycle.openedDate,
          opening_balance: cycle.openingBalance,
          closing_balance: expectedClosingCash,
          closed_at: endOfDayTimestamp,
        }),
      });

      const prefix = `oil-mart-cash-cycle-${user.id}-`;
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          window.localStorage.removeItem(key);
        }
      }
      setCashCycle(null);
      setCart([]);
      setLastInvoice(null);
      showToast({
        type: "info",
        title: "Shift Auto-Closed at 11:59 PM",
        message: `Shift ${cycle.id} from ${cycle.openedDate} was automatically closed at 11:59:59 PM (End of Day).`,
      });
    } catch (err) {
      console.error("Auto close failed", err);
    }
  }, [user, showToast]);

  useEffect(() => {
    if (!user) return;
    const prefix = `oil-mart-cash-cycle-${user.id}-`;
    let foundCycle: CashCycle | null = null;

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const item = JSON.parse(window.localStorage.getItem(key) || "");
          if (item && item.openedDate) {
            foundCycle = item;
            break;
          }
        } catch { }
      }
    }

    if (foundCycle) {
      if (foundCycle.openedDate !== currentBusinessDate) {
        void autoCloseExpiredCycle(foundCycle);
      } else {
        setCashCycle(foundCycle);
      }
    }
  }, [user, currentBusinessDate, autoCloseExpiredCycle]);

  useEffect(() => {
    if (cashCycle && cashCycle.openedDate !== currentBusinessDate) {
      void autoCloseExpiredCycle(cashCycle);
    }
  }, [cashCycle, currentBusinessDate, autoCloseExpiredCycle]);

  useEffect(() => {
    if (!user) return;
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
      const matchSubCategory = subCategory === "All" || product.sub_category === subCategory;
      const matchQuery = !query || `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase());
      return matchCategory && matchSubCategory && matchQuery;
    });
  }, [products, category, subCategory, query]);

  const productCategories = useMemo(() => {
    const values = Array.from(new Set(products.map((product) => product.category || "Uncategorized")));
    return ["All Items", ...values];
  }, [products]);

  const productSubCategories = useMemo(() => {
    const values = Array.from(new Set(products.filter((p) => p.category === category || category === "All Items").map((p) => p.sub_category).filter(Boolean)));
    return ["All", ...values];
  }, [products, category]);
  const paymentMethods = normalizePaymentMethods(settings.payment_methods.length ? settings.payment_methods : defaultPosSettings.payment_methods);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.cartQuantity, 0);
  const normalizedDiscountRate = Math.min(100, Math.max(0, Number(discountRate || 0)));
  const discount = subtotal * (Number.isFinite(normalizedDiscountRate) ? normalizedDiscountRate / 100 : 0);
  const total = Math.max(0, subtotal - discount);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const customerCreditLimit = Number(selectedCustomer?.credit_limit || 0);
  const customerOutstanding = Number(selectedCustomer?.outstanding_balance || 0);
  const customerAvailableCredit = Math.max(0, customerCreditLimit - customerOutstanding);
  const summaryTotals = useMemo(() => {
    return calculateSummary(summaryRows, cashCycle);
  }, [cashCycle, summaryRows]);

  const add = (product: Product) => {
    if (product.stock_quantity <= 0) {
      showToast({ type: "warning", title: "Out of stock", message: "This item is out of stock." });
      return;
    }
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) {
        return current.map((item) =>
          item.id === product.id ? { ...item, cartQuantity: normalizeSaleQuantity(item, item.cartQuantity + saleStep(item)) } : item
        );
      }
      return [...current, { ...product, cartQuantity: normalizeSaleQuantity(product, isLooseOil(product) ? 1 : 1) }];
    });
    setLastInvoice(null);
    setNotice("");
  };

  const openRevocation = (revocation: PendingRevocation) => {
    setRevocationModal(revocation);
    setRevocationReason(revocation.reasons[0] || "");
    setRevocationNotes("");
    setApproverUsername("");
    setApproverPin("");
  };

  const closeRevocation = () => {
    if (revocationSaving) return;
    setRevocationModal(null);
    setRevocationReason("");
    setRevocationNotes("");
    setApproverUsername("");
    setApproverPin("");
  };

  const fullRevocationReason = () => {
    return revocationNotes.trim() ? `${revocationReason} - ${revocationNotes.trim()}` : revocationReason;
  };

  const confirmRevocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!revocationModal) return;
    const reason = fullRevocationReason();
    if (!revocationReason) {
      showToast({ type: "warning", title: "Reason required", message: "Select a reason before continuing." });
      return;
    }
    if (revocationModal.requiresApproval && (!approverUsername.trim() || !approverPin)) {
      showToast({ type: "warning", title: "Approval required", message: "Enter supervisor/admin username and PIN." });
      return;
    }

    setRevocationSaving(true);
    try {
      await revocationModal.onConfirm(reason, revocationModal.requiresApproval ? {
        approver_username: approverUsername.trim(),
        approver_pin: approverPin,
      } : undefined);
      showToast({ type: "success", title: "Revocation recorded", message: "The correction was saved in the audit log." });
      setRevocationModal(null);
      setRevocationReason("");
      setRevocationNotes("");
      setApproverUsername("");
      setApproverPin("");
    } catch (error) {
      showToast({ type: "error", title: "Revocation failed", message: error instanceof Error ? error.message : "Unable to complete revocation." });
    } finally {
      setRevocationSaving(false);
    }
  };

  const qty = (id: number, nextQuantity: number) => {
    const item = cart.find((cartItem) => cartItem.id === id);
    if (!item) return;
    const normalizedQuantity = normalizeSaleQuantity(item, nextQuantity);
    if (normalizedQuantity === item.cartQuantity) return;
    setCart((current) =>
      current.map((cartItem) =>
        cartItem.id === id ? { ...cartItem, cartQuantity: normalizedQuantity } : cartItem
      )
    );
  };

  const removeCartItem = (item: CartItem) => {
    setCart((current) => current.filter((cartItem) => cartItem.id !== item.id));
  };

  const clearCurrentCart = () => {
    if (!cart.length) return;
    setCart([]);
    setDiscountRate("0");
    setCashReceived("");
    setLastInvoice(null);
  };

  const cancelDiscount = () => {
    if (!normalizedDiscountRate) return;
    setDiscountRate("0");
  };

  const selectPaymentMethod = (method: string) => {
    if (method === payment) return;
    setPayment(method);
    setCashReceived("");
  };

  const cancelCashPayment = () => {
    setCashReceived("");
    setShowCashModal(false);
  };

  const loadInvoiceDetail = async (saleId: number) => {
    const response = await fetch(`/api/sales/${saleId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load invoice");
    const detail = data as InvoiceDetail;
    setInvoiceDetail(detail);
    return detail;
  };

  const openReturn = async (saleId: number) => {
    try {
      const detailsRes = await fetch(`/api/sales/${saleId}`, { cache: "no-store" });
      if (!detailsRes.ok) throw new Error("Failed to fetch invoice details");
      const detailsData = await detailsRes.json();

      const today = new Date().toLocaleDateString('en-CA');
      const invoiceDate = (detailsData.sale.business_date || detailsData.sale.created_at).split(' ')[0];
      setReturnIsPastDate(invoiceDate !== today);

      setReturnInvoice(detailsData.sale);
      setReturnItems(detailsData.items);
      setReturnSelectedItems({});
      setReturnDirectMode(true);
      setShowReturnsPanel(true);
      loadReturnsSalesList("", "", "");
    } catch (error) {
      showToast({ type: "error", title: "Invoice unavailable", message: error instanceof Error ? error.message : "Unable to load invoice." });
    }
  };

  const loadReturnsSalesList = async (q: string, df: string, dt: string) => {
    setReturnSalesLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.append("search", q.trim());
      if (df) params.append("date_from", df);
      if (dt) params.append("date_to", dt);
      const url = `/api/sales${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      setReturnSalesList(Array.isArray(data) ? data : []);
    } catch {
      setReturnSalesList([]);
    } finally {
      setReturnSalesLoading(false);
    }
  };

  const cancelCompletedSale = (sale: Pick<SaleSummaryRow, "id" | "total_amount" | "payment_method">) => {
    openRevocation({
      kind: "completed_sale_cancelled",
      title: "Cancel Bill",
      message: `${settings.invoice_prefix}-${String(sale.id).padStart(6, "0")} will remain in history as cancelled. Its stock and financial values will be reversed.`,
      affectedAmount: Number(sale.total_amount),
      reasons: revokeReasons.sale,
      metadata: { sale_id: sale.id, payment_method: sale.payment_method },
      onConfirm: async (reason) => {
        const response = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", reason, sales_cycle_id: cashCycle?.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to cancel bill.");
        if (lastInvoice?.id === sale.id) setLastInvoice(null);
        setInvoiceDetail(null);
        setProducts(await fetchProducts());
        await loadCashierSummary();
        setSummaryRefresh((current) => current + 1);
      },
    });
  };

  const startCashCycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const balance = Number(openingBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      const message = "Enter a valid opening cash balance.";
      setNotice(message);
      showToast({ type: "warning", title: "Opening balance needed", message });
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
      showToast({ type: "success", title: "Sales cycle opened", message: "POS billing is ready." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open sales cycle.";
      setNotice(message);
      showToast({ type: "error", title: "Sales cycle failed", message });
    } finally {
      setChecking(false);
    }
  };

  const closeCashCycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !cashCycle) return;
    const balance = Number(closingBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      const message = "Enter a valid closing cash balance.";
      setClosingNotice(message);
      showToast({ type: "warning", title: "Closing balance needed", message });
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
      const message = `Sales cycle closed. Closing cash: ${money(balance)}.`;
      setNotice(message);
      showToast({ type: "success", title: "Sales cycle closed", message });
      signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to close sales cycle.";
      setClosingNotice(message);
      showToast({ type: "error", title: "Close cycle failed", message });
    } finally {
      setChecking(false);
    }
  };

  const openCloseCycle = async () => {
    if (!cashCycle) return;
    setClosingNotice("");
    try {
      const rows = await loadCashierSummary();
      const latestTotals = calculateSummary(rows, cashCycle);
      setClosingBalance(((cashCycle.openingBalance || 0) + latestTotals.cashSales).toFixed(2));
    } catch {
      setClosingBalance(expectedClosingCash.toFixed(2));
    } finally {
      setShowCloseModal(true);
    }
  };

  const openCreditPayment = () => {
    if (!selectedCustomer || customerOutstanding <= 0) return;
    setCreditPaymentAmount(customerOutstanding.toFixed(2));
    setCreditPaymentMethod("Cash");
    setCreditPaymentReference("");
    setCreditPaymentNotes("");
    setShowCreditPaymentModal(true);
  };

  const receiveCreditPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(creditPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > customerOutstanding) {
      showToast({ type: "warning", title: "Invalid payment", message: `Enter an amount up to ${money(customerOutstanding)}.` });
      return;
    }
    setCreditPaymentSaving(true);
    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          payment_method: creditPaymentMethod,
          reference_number: creditPaymentReference,
          notes: creditPaymentNotes,
          sales_cycle_id: cashCycle?.id || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to receive credit payment");

      const customerResponse = await fetch("/api/customers", { cache: "no-store" });
      const customerData = await customerResponse.json();
      if (Array.isArray(customerData)) setCustomers(customerData);
      setShowCreditPaymentModal(false);
      await loadCashierSummary();
      showToast({
        type: "success",
        title: "Credit payment received",
        message: `${money(amount)} received by ${creditPaymentMethod}. Receipt PAY-${data.payment_id}.`,
      });
    } catch (error) {
      showToast({ type: "error", title: "Payment failed", message: error instanceof Error ? error.message : "Unable to receive credit payment." });
    } finally {
      setCreditPaymentSaving(false);
    }
  };

  const completeSale = () => {
    if (!cart.length) return;
    setNotice("");
    if (payment === "Credit") {
      if (!selectedCustomer) {
        const message = "Select a customer before using Credit payment.";
        showToast({ type: "warning", title: "Customer required", message });
        return;
      }
      if ((selectedCustomer.status || "Active").toLowerCase() !== "active") {
        const message = "Credit is available only for active customers.";
        showToast({ type: "warning", title: "Credit unavailable", message });
        return;
      }
      if (customerCreditLimit <= 0) {
        const message = "This customer does not have an approved credit limit.";
        showToast({ type: "warning", title: "Credit unavailable", message });
        return;
      }
      if (total > customerAvailableCredit) {
        const message = `Available customer credit is ${money(customerAvailableCredit)}.`;
        showToast({ type: "warning", title: "Insufficient credit", message });
        return;
      }
    }
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
      const message = "Cash received must be equal to or greater than total payable.";
      setNotice(message);
      showToast({ type: "warning", title: "Cash amount invalid", message });
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
          tax_rate: 0,
          tax_amount: 0,
          business_date: currentBusinessDate,
          cash_received: payment === "Cash" ? cashAmount : null,
          cash_balance: payment === "Cash" && cashAmount !== undefined ? cashAmount - total : null,
          sales_cycle_id: cashCycle?.id || null,
          opening_cash_balance: cashCycle?.openingBalance || null,
          original_sale_id: exchangeOriginalId,
          items: cart.map((item) => ({ product_id: item.id, quantity: item.cartQuantity })),
        }),
      });
      const data = await response.json();

      if (response.ok) {
        const invoiceCustomer = customers.find((customer) => customer.id === customerId);
        setLastInvoice({
          id: data.saleId,
          date: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          items: [...cart],
          subtotal,
          discount,
          discountRate: normalizedDiscountRate,
          tax: 0,
          total,
          customerName: invoiceCustomer ? invoiceCustomer.name : "Walk-in Customer",
          paymentMethod: payment,
          cashReceived: payment === "Cash" ? cashAmount : undefined,
          cashBalance: payment === "Cash" && cashAmount !== undefined ? cashAmount - total : undefined,
          cycleId: cashCycle?.id,
          creditOutstanding: data.customer_credit?.outstanding_balance,
          creditAvailable: data.customer_credit?.available_credit,
        });
        setNotice("Sale completed successfully.");
        showToast({ type: "success", title: "Sale completed", message: "Sale completed successfully." });
        setCart([]);
        setExchangeOriginalId(null);
        setShowCashModal(false);
        setCashReceived("");
        if (data.customer_credit) {
          setCustomers((current) => current.map((customer) => customer.id === data.customer_credit.customer_id ? {
            ...customer,
            outstanding_balance: data.customer_credit.outstanding_balance,
            total_purchases: Number(customer.total_purchases || 0) + total,
          } : customer));
        }
        setProducts(await fetchProducts());
        await loadCashierSummary();
        setSummaryRefresh((current) => current + 1);
      } else {
        const message = data.error || "Could not complete sale. Please check stock.";
        setNotice(message);
        showToast({ type: "error", title: "Sale failed", message });
      }
    } catch {
      const message = "Unable to connect to sales service.";
      setNotice(message);
      showToast({ type: "error", title: "Sales service failed", message });
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
  const activeSummaryRange = summaryRange(new Date(`${currentBusinessDate}T00:00:00`));
  const expectedClosingCash = (cashCycle?.openingBalance || 0) + summaryTotals.cashSales + creditCollectionTotals.Cash;
  const closingBalanceAmount = Number(closingBalance);
  const hasValidClosingBalance = Number.isFinite(closingBalanceAmount);
  const closingDifference = hasValidClosingBalance ? closingBalanceAmount - expectedClosingCash : 0;

  const navItems = [
    { Icon: ShoppingCart, label: "POS Billing", href: "/dashboard" },
    { Icon: RotateCcw, label: "Returns", href: "/dashboard/returns-exchanges" },
    { Icon: ClipboardList, label: "Sales Cycles", href: "/admin/sales-cycles" },
    { Icon: TrendingUp, label: "Sales", href: "/admin/sales" },
    { Icon: Boxes, label: "Inventory", href: "/admin/inventory" },
    { Icon: Package, label: "Products", href: "/admin/products" },
    { Icon: Users, label: "Customers", href: "/admin/customers" },
    { Icon: BarChart3, label: "Reports", href: "/admin/reports" },
  ];

  const filteredNav = navItems.filter((item) => {
    if (isAdmin) return true;
    if (item.href === "/dashboard/returns-exchanges") {
      return user.permissions.includes("pos_billing"); // Cashiers have pos_billing
    }
    const req = PERMISSION_MAP[item.href];
    if (!req) return false;
    if (req === "view_inventory") {
      return user.permissions.includes("view_inventory") || user.permissions.includes("manage_inventory") || user.permissions.includes("pos_billing");
    }
    return user.permissions.includes(req);
  });

  return (
    <div className={`pos-shell${sidebarCollapsed ? " sidebar-collapsed" : ""} ${isCashier ? "cashier-pos-shell" : ""} ${mobileNavOpen ? " sidebar-mobile-open" : ""}`}>
      <div className="mobile-backdrop" aria-hidden="true" onClick={() => setMobileNavOpen(false)} />
      {isAdmin && (
        <aside className="pos-sidebar">
          <div className="pos-logo">
            <Image
              src="/logo.png"
              alt="Oil Mart POS Logo"
              width={40}
              height={40}
              className="admin-logo-img pos-logo-img"
              priority
            />
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
            <HelpSupportButton iconClassName="pos-nav-icon" />
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
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!sidebarCollapsed}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= 560) {
                  setMobileNavOpen(!mobileNavOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
            >
              <Menu aria-hidden="true" size={22} />
            </button>
          )}
          <div className="page-title pos-page-title">
            <h1>POS Billing</h1>
            <p>{isCashier ? "Cashier workspace" : "Admin billing workspace"} / Welcome back, {user.username}</p>
          </div>
          <div className="pos-top-actions">
            {cashCycle && (
              <div className="pos-status-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                <Banknote size={16} aria-hidden="true" style={{ color: '#16a34a' }} />
                <span>O/C: <b style={{ fontWeight: 700 }}>{money(cashCycle.openingBalance || 0)}</b></span>
              </div>
            )}
            <button className="pos-status-pill">
              <ShoppingCart size={16} aria-hidden="true" />
              <span>{shiftLabel}</span>
            </button>
            <button className="pos-status-pill">
              <CalendarDays size={16} aria-hidden="true" />
              <span>{displayDate} / {displayTime}</span>
            </button>

            {cashCycle && (
              <button
                type="button"
                onClick={() => void openCloseCycle()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#991b1b',
                  color: '#ffffff',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#7f1d1d')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#991b1b')}
              >
                <span>Close Sale Cycle</span>
              </button>
            )}
            <NotificationCenter variant="pos" />
            <div className="pos-topbar-popover pos-profile-control">
              <button
                className="cashier"
                aria-label="Open cashier profile"
                aria-expanded={showProfile}
                onClick={() => setShowProfile((current) => !current)}
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
                  <button onClick={() => { setShowProfile(false); router.push("/cashier/returns"); }}>
                    <RotateCcw size={16} aria-hidden="true" /> Returns &amp; Exchanges
                  </button>
                  <button onClick={() => { router.push("/cashier/inventory"); setShowProfile(false); }}>
                    <Boxes size={16} aria-hidden="true" /> Inventory
                  </button>
                  <HelpSupportButton>
                    <CircleHelp size={16} aria-hidden="true" /> Help &amp; Support
                  </HelpSupportButton>
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
                  <button className={category === item ? "active" : ""} onClick={() => { setCategory(item); setSubCategory("All"); }} key={item}>
                    {item}
                  </button>
                ))}
              </div>

              {category !== "All Items" && productSubCategories.length > 1 && (
                <div className="category-tabs" style={{ paddingTop: 0, paddingBottom: 10, borderBottom: '1px solid #e3e6e9', marginBottom: 12, overflowX: "auto", whiteSpace: "nowrap" }}>
                  {productSubCategories.map((item) => (
                    <button
                      key={item as string}
                      className={subCategory === item ? "active" : ""}
                      onClick={() => setSubCategory(item as string)}
                      style={{ height: '30px', padding: '0 12px', fontSize: '12px', borderRadius: '15px' }}
                    >
                      {item as string}
                    </button>
                  ))}
                </div>
              )}

              <div className="product-grid">
                {shown.map((product) => (
                  <article key={product.id} onClick={() => add(product)} style={{ opacity: product.stock_quantity <= 0 ? 0.5 : 1 }}>
                    <button className="favorite" aria-label={`Favorite ${product.name}`}><Star size={18} aria-hidden="true" /></button>
                    <div className="product-visual"><ProductCategoryIcon category={product.category} productName={product.name} className="pos-product-icon large" /></div>
                    <h3>{product.name}</h3>
                    <small>Stock: {formatQty(product.stock_quantity, product.unit)}</small>
                    <p>SKU: {product.sku}</p>
                    <strong>{money(Number(product.price))}{isLooseOil(product) ? " / L" : ""}</strong>
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
                {isAdmin && (
                  <button onClick={() => router.push("/admin/customers")}><Plus size={16} aria-hidden="true" /> Manage Customers</button>
                )}
              </div>

              {selectedCustomer && (
                <div className={`customer-credit-strip${payment === "Credit" ? " active" : ""}`}>
                  <span><CreditCard size={16} aria-hidden="true" /> {selectedCustomer.name}</span>
                  <small>Credit limit <b>{money(customerCreditLimit)}</b></small>
                  <small>Outstanding <b>{money(customerOutstanding)}</b></small>
                  <small>Available <b>{money(customerAvailableCredit)}</b></small>
                  <button type="button" onClick={openCreditPayment} disabled={customerOutstanding <= 0}><Banknote size={14} aria-hidden="true" /> Receive Payment</button>
                </div>
              )}

              {(isCashier || cashCycle || summaryRows.length > 0) && (
                <section className="cashier-summary-card">
                  <header>
                    <div>
                      <h2><BarChart3 size={18} aria-hidden="true" /> Sales Summary</h2>
                      <p>{activeSummaryRange.label} / {cashCycle?.id}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', marginRight: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                      <Banknote size={16} aria-hidden="true" style={{ color: '#16a34a' }} />
                      <span>Opening Cash: <b style={{ fontWeight: 700 }}>{money(cashCycle?.openingBalance || 0)}</b></span>
                    </div>
                    <button type="button" onClick={() => setShowCycleInvoices(true)}><Receipt size={15} aria-hidden="true" /> Cycle Invoices</button>
                  </header>
                  <div className="summary-metrics">
                    <p><small>Invoices</small><b>{summaryTotals.invoiceCount}</b></p>
                    <p><small>Qty Sold</small><b>{Number(summaryTotals.itemCount).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</b></p>
                    <p><small>Total Sales</small><b>{money(summaryTotals.totalSales)}</b></p>
                    <p><small>Cash Sales</small><b>{money(summaryTotals.cashSales)}</b></p>
                    <p><small>Card</small><b>{money(summaryTotals.cardSales)}</b></p>
                    <p><small>Bank Transfer</small><b>{money(summaryTotals.bankSales)}</b></p>
                    <p><small>Credit Sales</small><b>{money(summaryTotals.creditSales)}</b></p>
                    <p><small>Credit Cash Collected</small><b>{money(creditCollectionTotals.Cash)}</b></p>
                    <p><small>Credit Card Collected</small><b>{money(creditCollectionTotals.Card)}</b></p>
                    <p><small>Credit Bank Collected</small><b>{money(creditCollectionTotals["Bank Transfer"])}</b></p>
                    <p><small>Discount</small><b>{money(summaryTotals.discount)}</b></p>
                    <p><small>Expected Cash</small><b>{money(expectedClosingCash)}</b></p>
                  </div>
                </section>
              )}
            </section>

            <aside className="cart-pane">
              <div className="cart-title">
                <h2>Current Cart <small>({cart.length} Items)</small></h2>
                <button type="button" onClick={clearCurrentCart} disabled={!cart.length}>
                  <Trash2 size={14} aria-hidden="true" /> Clear
                </button>
              </div>
              {exchangeOriginalId && <div className="exchange-reference">Exchange for {settings.invoice_prefix}-{String(exchangeOriginalId).padStart(6, "0")}<button type="button" onClick={() => setExchangeOriginalId(null)}>Cancel Exchange</button></div>}

              <div className="cart-items">
                {cart.map((item) => (
                  <article key={item.id}>
                    <div className="cart-thumb"><ProductCategoryIcon category={item.category} productName={item.name} className="pos-product-icon" /></div>
                    <p>
                      <b>{item.name}</b>
                      <small>SKU: {item.sku}{isLooseOil(item) ? " / Loose oil" : ""}</small>
                    </p>
                    <button className="trash" onClick={() => removeCartItem(item)} aria-label={`Remove ${item.name}`}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                    <div className="quantity">
                      <button onClick={() => qty(item.id, item.cartQuantity - saleStep(item))} aria-label={`Decrease ${item.name}`}><Minus size={14} aria-hidden="true" /></button>
                      {isLooseOil(item) ? (
                        <input
                          type="number"
                          min={saleStep(item)}
                          max={item.stock_quantity}
                          step={saleStep(item)}
                          value={item.cartQuantity}
                          onChange={(event) => qty(item.id, Number(event.target.value))}
                          aria-label={`${item.name} liters`}
                        />
                      ) : (
                        <span>{formatQty(item.cartQuantity, item.unit)}</span>
                      )}
                      <button onClick={() => qty(item.id, item.cartQuantity + saleStep(item))} aria-label={`Increase ${item.name}`}><Plus size={14} aria-hidden="true" /></button>
                    </div>
                    <strong>{money(Number(item.price) * item.cartQuantity)}</strong>
                  </article>
                ))}
                {!cart.length && <div className="empty-cart">Your cart is empty<br /><small>Select a product to begin</small></div>}
              </div>

              <div className="totals">
                <p>Subtotal ({cart.length} Lines)<b>{money(subtotal)}</b></p>
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
                {normalizedDiscountRate > 0 && (
                  <button type="button" className="revoke-inline" onClick={cancelDiscount}>
                    <RotateCcw size={14} aria-hidden="true" /> Cancel Discount
                  </button>
                )}
                <h3>Total Payable <b>{money(total)}</b></h3>
              </div>

              <div className="payments">
                <h3>Payment Methods</h3>
                <div>
                  {paymentMethods.map((method) => {
                    const Icon = paymentIcons[method] || Wallet;
                    return (
                      <button onClick={() => selectPaymentMethod(method)} className={payment === method ? "active" : ""} key={method}>
                        <span><Icon size={19} aria-hidden="true" /></span>{method}
                      </button>
                    );
                  })}
                </div>
                {payment === "Credit" && (
                  <p className={`credit-payment-note${selectedCustomer && total <= customerAvailableCredit && customerCreditLimit > 0 ? " valid" : ""}`}>
                    {selectedCustomer
                      ? `Available credit: ${money(customerAvailableCredit)} · After sale: ${money(Math.max(0, customerAvailableCredit - total))}`
                      : "Select an approved customer to complete a credit sale."}
                  </p>
                )}
                <button className="complete-sale" onClick={completeSale} disabled={!cart.length || checking}>
                  <Receipt size={17} aria-hidden="true" /> {checking ? "Processing Sale..." : "Complete Sale"}
                </button>
              </div>

              {lastInvoice && (
                <>
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
                            <td>{formatQty(item.cartQuantity, item.unit)}</td>
                            <td>{money(Number(item.price) * item.cartQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="invoice-total">
                      <p>Subtotal <b>{money(lastInvoice.subtotal)}</b></p>
                      <p>Discount ({lastInvoice.discountRate}%) <b>- {money(lastInvoice.discount)}</b></p>
                      {lastInvoice.paymentMethod === "Cash" && (
                        <>
                          <p>Cash Received <b>{money(lastInvoice.cashReceived || 0)}</b></p>
                          <p>Balance Returned <b>{money(lastInvoice.cashBalance || 0)}</b></p>
                        </>
                      )}
                      {lastInvoice.paymentMethod === "Credit" && (
                        <>
                          <p>Outstanding Balance <b>{money(lastInvoice.creditOutstanding || 0)}</b></p>
                          <p>Available Credit <b>{money(lastInvoice.creditAvailable || 0)}</b></p>
                        </>
                      )}
                      <h3>Total <b>{money(lastInvoice.total)}</b></h3>
                    </div>
                    <small className="thanks">
                      {settings.invoice_footer}
                    </small>
                  </div>
                  <div className="no-print invoice-print-actions">
                    <button onClick={() => {
                      const message = "Print command sent successfully.";
                      setNotice(message);
                      showToast({ type: "success", title: "Print started", message });
                      window.print();
                      setTimeout(() => setNotice(""), 4000);
                    }}>
                      <Printer size={15} aria-hidden="true" /> Print Invoice
                    </button>
                    <button onClick={() => void openReturn(lastInvoice.id)}>
                      <RotateCcw size={15} aria-hidden="true" /> Return / Exchange
                    </button>
                    <button className="danger" onClick={() => cancelCompletedSale({ id: lastInvoice.id, total_amount: lastInvoice.total, payment_method: lastInvoice.paymentMethod })}>
                      <X size={15} aria-hidden="true" /> Cancel Bill
                    </button>
                  </div>
                </>
              )}
            </aside>
            {showCycleInvoices && (
              <div className="cash-modal-backdrop">
                <section className="cash-modal cycle-invoices-modal" style={{ width: 'min(820px, calc(100vw - 30px))', maxWidth: '820px' }}>
                  <h2>Current Cycle Invoices</h2>
                  <p>{cashCycle?.id} · invoices remain listed after cancellation or return.</p>
                  <div className="cycle-invoice-list">
                    {(() => {
                      const cycleSales = summaryRows.filter((sale) => !cashCycle || sale.sales_cycle_id === cashCycle.id);
                      const latestSaleId = cycleSales.length > 0 ? Math.max(...cycleSales.map(s => s.id)) : -1;
                      return cycleSales.map((sale) => (
                        <article key={sale.id}>
                          <div><b>{settings.invoice_prefix}-{String(sale.id).padStart(6, "0")}</b><small>{new Date(sale.created_at).toLocaleString()} · {sale.customer_name || "Walk-in Customer"}</small></div>
                          <span>{money(Number(sale.total_amount))}<small>{sale.status || "completed"}</small></span>
                          <aside>
                            <button type="button" onClick={() => void loadInvoiceDetail(sale.id)}>View</button>
                            {!['cancelled', 'returned'].includes(sale.status) && <button type="button" onClick={() => void openReturn(sale.id)}>Return / Exchange</button>}
                            {sale.status === 'completed' && sale.id === latestSaleId && <button type="button" className="danger" onClick={() => cancelCompletedSale(sale)}>Cancel Bill</button>}
                          </aside>
                        </article>
                      ));
                    })()}
                    {!summaryRows.filter((sale) => !cashCycle || sale.sales_cycle_id === cashCycle.id).length && <p>No invoices in this cycle.</p>}
                  </div>
                  <footer><button type="button" onClick={() => { setShowCycleInvoices(false); setInvoiceDetail(null); }}>Close</button></footer>
                </section>
              </div>
            )}
            {invoiceDetail && (
              <div className="cash-modal-backdrop" style={{ zIndex: 1100 }}>
                <section className="cash-modal invoice-detail-modal" style={{ width: 'min(700px, calc(100vw - 30px))', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        Invoice Details: {settings.invoice_prefix}-{String(invoiceDetail.sale.id).padStart(6, "0")}
                      </h2>
                      <small style={{ color: '#64748b' }}>{new Date(invoiceDetail.sale.created_at).toLocaleString()}</small>
                    </div>
                    <span style={{ textTransform: 'uppercase', background: invoiceDetail.sale.status === 'cancelled' ? '#fee2e2' : '#dcfce7', color: invoiceDetail.sale.status === 'cancelled' ? '#dc2626' : '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                      {invoiceDetail.sale.status}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                    <p style={{ margin: 0 }}><small style={{ display: 'block', color: '#64748b' }}>Customer</small> <b>{invoiceDetail.sale.customer_name || "Walk-in Customer"}</b></p>
                    <p style={{ margin: 0 }}><small style={{ display: 'block', color: '#64748b' }}>Payment Method</small> <b>{invoiceDetail.sale.payment_method}</b></p>
                    <p style={{ margin: 0 }}><small style={{ display: 'block', color: '#64748b' }}>Cashier</small> <b>{invoiceDetail.sale.cashier_name || user?.username || "Cashier"}</b></p>
                    {invoiceDetail.sale.cash_received !== null && invoiceDetail.sale.cash_received !== undefined && (
                      <p style={{ margin: 0 }}><small style={{ display: 'block', color: '#64748b' }}>Cash Received / Balance</small> <b>{money(Number(invoiceDetail.sale.cash_received))} / {money(Number(invoiceDetail.sale.cash_balance || 0))}</b></p>
                    )}
                  </div>

                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>Purchased Items</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '13px' }}>
                    <thead style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <tr>
                        <th style={{ padding: '8px 0' }}>Item Description</th>
                        <th style={{ padding: '8px 0', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 0', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '8px 0', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDetail.items.map((item) => (
                        <tr key={item.sale_item_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 0' }}>
                            <b>{item.product_name}</b>
                            {Number(item.returned_quantity || 0) > 0 && <small style={{ display: 'block', color: '#ef4444' }}>Returned: {formatQty(item.returned_quantity, item.unit)}</small>}
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'center' }}>{formatQty(item.quantity, item.unit)}</td>
                          <td style={{ padding: '10px 0', textAlign: 'right' }}>{money(Number(item.price_at_time))}</td>
                          <td style={{ padding: '10px 0', textAlign: 'right' }}><b>{money(Number(item.price_at_time) * Number(item.quantity))}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ textAlign: 'right', borderTop: '2px solid #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
                    <p style={{ margin: 0, color: '#64748b' }}>Subtotal: <b>{money(Number(invoiceDetail.sale.total_amount) + Number(invoiceDetail.sale.discount_amount || 0))}</b></p>
                    {Number(invoiceDetail.sale.discount_amount || 0) > 0 && (
                      <p style={{ margin: 0, color: '#ef4444' }}>Discount ({invoiceDetail.sale.discount_rate}%): <b>-{money(Number(invoiceDetail.sale.discount_amount))}</b></p>
                    )}
                    <p style={{ margin: '6px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>Total Amount Paid: {money(Number(invoiceDetail.sale.total_amount))}</p>
                  </div>

                  <footer style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setInvoiceDetail(null)} style={{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Close Invoice View
                    </button>
                  </footer>
                </section>
              </div>
            )}

            {showCreditPaymentModal && selectedCustomer && (
              <div className="cash-modal-backdrop">
                <form className="cash-modal credit-collection-modal" onSubmit={receiveCreditPayment}>
                  <div className="cash-modal-icon"><CreditCard size={24} aria-hidden="true" /></div>
                  <h2>Receive Credit Payment</h2>
                  <p>Record a full or partial settlement for {selectedCustomer.name}.</p>
                  <div className="cash-modal-total"><span>Outstanding Balance</span><b>{money(customerOutstanding)}</b></div>
                  <label>Payment Amount<input type="number" min="0.01" max={customerOutstanding} step="0.01" value={creditPaymentAmount} onChange={(event) => setCreditPaymentAmount(event.target.value)} autoFocus /></label>
                  <label>Payment Method<select value={creditPaymentMethod} onChange={(event) => setCreditPaymentMethod(event.target.value)}><option>Cash</option><option>Card</option><option>Bank Transfer</option></select></label>
                  <label>Reference Number<input value={creditPaymentReference} onChange={(event) => setCreditPaymentReference(event.target.value)} placeholder="Receipt, card, or bank reference" /></label>
                  <label>Notes<input value={creditPaymentNotes} onChange={(event) => setCreditPaymentNotes(event.target.value)} placeholder="Optional notes" /></label>
                  <div className="cash-return"><span>Balance After Payment</span><b>{money(Math.max(0, customerOutstanding - Number(creditPaymentAmount || 0)))}</b></div>
                  <footer>
                    <button type="button" onClick={() => setShowCreditPaymentModal(false)}>Cancel</button>
                    <button type="submit" disabled={creditPaymentSaving || Number(creditPaymentAmount) <= 0 || Number(creditPaymentAmount) > customerOutstanding}><Receipt size={16} aria-hidden="true" /> {creditPaymentSaving ? "Recording..." : "Receive & Issue Receipt"}</button>
                  </footer>
                </form>
              </div>
            )}
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
                    <button type="button" onClick={cancelCashPayment}>Cancel</button>
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
                  <div className="cash-modal-icon"><LogOut size={24} aria-hidden="true" /></div>
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
                  <footer>
                    <button type="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
                    <button type="submit" disabled={checking || !hasValidClosingBalance}>
                      Close Cycle
                    </button>
                  </footer>
                </form>
              </div>
            )}
            {revocationModal && (
              <div className="cash-modal-backdrop">
                <form className="cash-modal revoke-modal" onSubmit={confirmRevocation}>
                  <div className="cash-modal-icon"><ShieldCheck size={24} aria-hidden="true" /></div>
                  <h2>{revocationModal.title}</h2>
                  <p>{revocationModal.message}</p>
                  <div className="cash-modal-total">
                    <span>Affected Amount</span>
                    <b>{money(revocationModal.affectedAmount)}</b>
                  </div>
                  <label>
                    Reason
                    <select value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} required>
                      {revocationModal.reasons.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={revocationNotes}
                      onChange={(event) => setRevocationNotes(event.target.value)}
                      placeholder="Optional extra details"
                    />
                  </label>
                  {revocationModal.requiresApproval && (
                    <div className="approval-grid">
                      <label>
                        Supervisor/Admin Username
                        <input value={approverUsername} onChange={(event) => setApproverUsername(event.target.value)} autoComplete="username" required />
                      </label>
                      <label>
                        PIN / Password
                        <input type="password" value={approverPin} onChange={(event) => setApproverPin(event.target.value)} autoComplete="current-password" required />
                      </label>
                    </div>
                  )}
                  <footer>
                    <button type="button" onClick={closeRevocation} disabled={revocationSaving}>Cancel</button>
                    <button type="submit" disabled={revocationSaving}>
                      <ShieldCheck size={16} aria-hidden="true" /> {revocationSaving ? "Recording..." : "Confirm Action"}
                    </button>
                  </footer>
                </form>
              </div>
            )}
          </main>
        )}
      </div>
      {/* ── Returns & Exchanges Modal Popup ── */}
      {showReturnsPanel && (
        <div className="cash-modal-backdrop" style={{ zIndex: 1200 }}>
          <section className="cash-modal returns-modal" style={{ width: 'min(840px, calc(100vw - 30px))', maxWidth: '840px', maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: '#fffbeb', color: '#a16207', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={20} style={{ color: '#f0ab00' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>Returns &amp; Exchanges</h2>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Process cash refunds or item exchanges for completed invoices</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReturnsPanel(false);
                  setReturnInvoice(null);
                  setReturnItems([]);
                  setReturnSelectedItems({});
                  setReturnSearchQuery("");
                  setReturnSalesList([]);
                  setReturnDateFrom("");
                  setReturnDateTo("");
                  setReturnDirectMode(false);
                }}
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
            {!returnInvoice ? (
              <>
                {/* Search & Date filters */}
                <div style={{ background: '#fff', padding: '20px 24px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
                  <form onSubmit={(e) => { e.preventDefault(); loadReturnsSalesList(returnSearchQuery, returnDateFrom, returnDateTo); }} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px auto', gap: '12px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Search Invoice / Customer</label>
                      <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input type="text" value={returnSearchQuery} onChange={(e) => setReturnSearchQuery(e.target.value)} placeholder="Invoice #, Name, Phone" style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Date From</label>
                      <input type="date" value={returnDateFrom} onChange={(e) => setReturnDateFrom(e.target.value)} style={{ width: '100%', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Date To</label>
                      <input type="date" value={returnDateTo} onChange={(e) => setReturnDateTo(e.target.value)} style={{ width: '100%', padding: '9px 10px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" disabled={returnSalesLoading} style={{ background: '#ffbd00', color: '#111827', padding: '9px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(255,189,0,0.25)' }}>
                        {returnSalesLoading ? 'Loading...' : 'Search'}
                      </button>
                      <button type="button" onClick={() => { setReturnSearchQuery(''); setReturnDateFrom(''); setReturnDateTo(''); loadReturnsSalesList('', '', ''); }} style={{ padding: '9px 14px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#64748b' }}>↺</button>
                    </div>
                  </form>
                </div>

                {/* Invoices list table */}
                <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>Previous Invoices ({returnSalesList.length})</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Click an invoice to select items for return</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice #</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cashier</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnSalesLoading ? (
                          <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading invoices...</td></tr>
                        ) : returnSalesList.length === 0 ? (
                          <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No invoices found. Try adjusting filters.</td></tr>
                        ) : returnSalesList.map((sale) => {
                          const today = new Date().toLocaleDateString('en-CA');
                          const invDate = (sale.business_date || sale.created_at || '').split(' ')[0];
                          const isPast = invDate !== today;
                          return (
                            <tr key={sale.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: '#f0ab00' }}>INV-{sale.id}</td>
                              <td style={{ padding: '12px 16px', color: '#475569' }}>
                                <div>{invDate}</div>
                                {isPast && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '3px', padding: '2px 7px', background: '#fffbeb', color: '#b45309', borderRadius: '20px', fontSize: '10px', fontWeight: 700, border: '1px solid #fde68a' }}><ShieldAlert size={9} /> Past Cycle</span>}
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{sale.customer_name || 'Walk-in'}</td>
                              <td style={{ padding: '12px 16px', color: '#64748b' }}>{sale.cashier_name || 'Cashier'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                Rs. {Number(sale.total_amount).toFixed(2)}
                                {Number(sale.returned_amount) > 0 && <div style={{ fontSize: '11px', color: '#ea580c', fontWeight: 500 }}>Returned: Rs. {Number(sale.returned_amount).toFixed(2)}</div>}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', background: sale.status === 'completed' ? '#dcfce7' : sale.status === 'partially_returned' ? '#fef9c3' : '#ffedd5', color: sale.status === 'completed' ? '#166534' : sale.status === 'partially_returned' ? '#854d0e' : '#c2410c' }}>{sale.status.replace('_', ' ')}</span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                <button
                                  onClick={async () => {
                                    setReturnSearchLoading(true);
                                    try {
                                      const detailsRes = await fetch(`/api/sales/${sale.id}`, { cache: "no-store" });
                                      if (!detailsRes.ok) throw new Error('Failed to fetch invoice details');
                                      const detailsData = await detailsRes.json();
                                      const today2 = new Date().toLocaleDateString('en-CA');
                                      const invoiceDate = (detailsData.sale.business_date || detailsData.sale.created_at).split(' ')[0];
                                      setReturnIsPastDate(invoiceDate !== today2);
                                      if (invoiceDate !== today2) showToast({ type: 'info', title: '', message: 'Past invoice — Admin authorization will be required.' });
                                      setReturnInvoice(detailsData.sale);
                                      setReturnItems(detailsData.items);
                                      setReturnSelectedItems({});
                                    } catch (err: any) {
                                      showToast({ type: 'error', title: 'Error', message: err.message });
                                    } finally {
                                      setReturnSearchLoading(false);
                                    }
                                  }}
                                  disabled={returnSearchLoading}
                                  style={{ background: '#ffbd00', color: '#111827', padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>

                {/* Invoice detail */}
                <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                  {!returnDirectMode && (
                    <button onClick={() => { setReturnInvoice(null); setReturnItems([]); setReturnSelectedItems({}); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#f0ab00', fontWeight: 700, fontSize: '13px', marginBottom: '16px', padding: 0 }}>
                      ← Back to Invoices List
                    </button>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Invoice #{settings.invoice_prefix}-{String(returnInvoice.id).padStart(6, "0")}</h2>
                      <p style={{ color: '#64748b', margin: 0, fontSize: '13px' }}>Date: {returnInvoice.business_date || returnInvoice.created_at}</p>
                      {returnIsPastDate && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', padding: '4px 10px', background: '#fffbeb', color: '#b45309', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: '1px solid #fde68a' }}>
                          <ShieldAlert size={12} /> Past cycle — Admin PIN required
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>{returnInvoice.customer_name || 'Walk-in Customer'}</p>
                      <span style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>Status: {returnInvoice.status}</span>
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        <th style={{ padding: '10px 0', width: '40px' }}></th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qty</th>
                        <th style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((item, i) => {
                        const remaining = Number(item.quantity) - Number(item.returned_quantity || 0);
                        const isSel = !!returnSelectedItems[item.sale_item_id];
                        const sel = returnSelectedItems[item.sale_item_id];
                        const df = returnInvoice.discount_rate ? Math.max(0, 1 - Number(returnInvoice.discount_rate) / 100) : 1;
                        const refundVal = isSel ? sel.quantity * Number(item.price_at_time) * df : 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f8fafc', opacity: remaining <= 0 ? 0.4 : 1 }}>
                            <td style={{ padding: '12px 0', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                disabled={remaining <= 0}
                                checked={isSel}
                                onChange={() => {
                                  setReturnSelectedItems(prev => {
                                    const next = { ...prev };
                                    if (next[item.sale_item_id]) delete next[item.sale_item_id];
                                    else next[item.sale_item_id] = { quantity: remaining, disposition: 'resellable' };
                                    return next;
                                  });
                                }}
                                style={{ width: '18px', height: '18px', cursor: remaining <= 0 ? 'not-allowed' : 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              <p style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 2px 0' }}>{item.product_name}</p>
                              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Max: {remaining} {item.unit}</p>
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                              {isSel ? (
                                <input
                                  type="number" min="0" max={remaining}
                                  value={sel.quantity}
                                  onChange={(e) => {
                                    let v = Number(e.target.value);
                                    if (v < 0) v = 0;
                                    if (v > remaining) v = remaining;
                                    setReturnSelectedItems(prev => ({ ...prev, [item.sale_item_id]: { ...prev[item.sale_item_id], quantity: v } }));
                                  }}
                                  style={{ width: '64px', textAlign: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px' }}
                                />
                              ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                            </td>
                            <td style={{ padding: '12px 8px' }}>
                              {isSel && (
                                <select
                                  value={sel.disposition}
                                  onChange={(e) => setReturnSelectedItems(prev => ({ ...prev, [item.sale_item_id]: { ...prev[item.sale_item_id], disposition: e.target.value } }))}
                                  style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: '#374151' }}
                                >
                                  <option value="resellable">Good / Resellable</option>
                                  <option value="damaged">Damaged / Defective</option>
                                </select>
                              )}
                            </td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', color: '#64748b' }}>Rs. {Number(item.price_at_time).toFixed(2)}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>Rs. {refundVal.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5} style={{ paddingTop: '20px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '16px' }}>Total Refund</td>
                        <td style={{ paddingTop: '20px', textAlign: 'right', fontWeight: 800, color: '#2563eb', fontSize: '22px' }}>
                          Rs. {returnItems.reduce((acc, item) => {
                            const sel = returnSelectedItems[item.sale_item_id];
                            if (sel && sel.quantity > 0) {
                              const df = returnInvoice.discount_rate ? Math.max(0, 1 - Number(returnInvoice.discount_rate) / 100) : 1;
                              return acc + sel.quantity * Number(item.price_at_time) * df;
                            }
                            return acc;
                          }, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      disabled={returnSubmitting}
                      onClick={() => {
                        if (Object.keys(returnSelectedItems).length === 0) { showToast({ type: 'info', title: '', message: 'Select at least one item.' }); return; }
                        setReturnResolutionType('Cash');
                        if (returnIsPastDate) setReturnAdminModalOpen(true);
                        else {
                          // submit directly
                          (async () => {
                            setReturnSubmitting(true);
                            try {
                              const rItems = Object.entries(returnSelectedItems).filter(([, d]) => d.quantity > 0).map(([id, d]) => ({ sale_item_id: Number(id), quantity: d.quantity, disposition: d.disposition }));
                              const res = await fetch(`/api/sales/${returnInvoice.id}/returns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: rItems, resolution: 'Cash', reason: 'Customer requested return' }) });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed');
                              setReturnInvoice(null); setReturnItems([]); setReturnSelectedItems({});
                              showToast({ type: 'success', title: 'Success', message: `Return processed (${data.return_number})` });
                            } catch (err: any) { showToast({ type: 'error', title: 'Error', message: err.message }); } finally { setReturnSubmitting(false); }
                          })();
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
                    >
                      <RotateCcw size={18} /> Process Return (Cash Refund)
                    </button>
                    <button
                      disabled={returnSubmitting}
                      onClick={() => {
                        if (Object.keys(returnSelectedItems).length === 0) { showToast({ type: 'info', title: '', message: 'Select at least one item.' }); return; }
                        setReturnResolutionType('Exchange');
                        if (returnIsPastDate) setReturnAdminModalOpen(true);
                        else {
                          (async () => {
                            setReturnSubmitting(true);
                            try {
                              const rItems = Object.entries(returnSelectedItems).filter(([, d]) => d.quantity > 0).map(([id, d]) => ({ sale_item_id: Number(id), quantity: d.quantity, disposition: d.disposition }));
                              const res = await fetch(`/api/sales/${returnInvoice.id}/returns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: rItems, resolution: 'Exchange', reason: 'Customer exchange' }) });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed');
                              setReturnInvoice(null); setReturnItems([]); setReturnSelectedItems({});
                              setShowReturnsPanel(false);
                              showToast({ type: 'success', title: 'Success', message: `Exchange initiated (${data.return_number}). Now bill the replacement item.` });
                            } catch (err: any) { showToast({ type: 'error', title: 'Error', message: err.message }); } finally { setReturnSubmitting(false); }
                          })();
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                    >
                      <Replace size={18} /> Process Exchange
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Admin Override Modal inside overlay */}
          {returnAdminModalOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!returnAdminUsername || !returnAdminPassword) { showToast({ type: 'info', title: '', message: 'Enter admin credentials.' }); return; }
                    setReturnVerifyingAdmin(true);
                    setReturnSubmitting(true);
                    try {
                      const rItems = Object.entries(returnSelectedItems).filter(([, d]) => d.quantity > 0).map(([id, d]) => ({ sale_item_id: Number(id), quantity: d.quantity, disposition: d.disposition }));
                      const res = await fetch(`/api/sales/${returnInvoice.id}/returns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: rItems, resolution: returnResolutionType, reason: 'Customer requested return/exchange', admin_username: returnAdminUsername, admin_password: returnAdminPassword }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed');
                      setReturnAdminModalOpen(false);
                      setReturnAdminUsername(''); setReturnAdminPassword('');
                      setReturnInvoice(null); setReturnItems([]); setReturnSelectedItems({});
                      if (returnResolutionType === 'Exchange') setShowReturnsPanel(false);
                      showToast({ type: 'success', title: 'Success', message: `${returnResolutionType} processed (${data.return_number})` });
                      if (returnResolutionType === 'Exchange') showToast({ type: 'info', title: '', message: 'Now bill the replacement items.' });
                    } catch (err: any) { showToast({ type: 'error', title: 'Error', message: err.message }); } finally { setReturnVerifyingAdmin(false); setReturnSubmitting(false); }
                  }}
                >
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      <ShieldAlert size={18} color="#dc2626" /> Admin Authorization
                    </h3>
                    <button type="button" onClick={() => setReturnAdminModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                  </div>
                  <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', margin: '0 0 20px 0' }}>Past-date {returnResolutionType.toLowerCase()} requires admin authorization.</p>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Admin Username</label>
                      <input type="text" value={returnAdminUsername} onChange={(e) => setReturnAdminUsername(e.target.value)} required style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Admin Password</label>
                      <input type="password" value={returnAdminPassword} onChange={(e) => setReturnAdminPassword(e.target.value)} required style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setReturnAdminModalOpen(false)} style={{ padding: '8px 20px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                    <button type="submit" disabled={returnVerifyingAdmin || returnSubmitting} style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, opacity: (returnVerifyingAdmin || returnSubmitting) ? 0.6 : 1 }}>
                      {(returnVerifyingAdmin || returnSubmitting) ? 'Authorizing...' : 'Authorize & Submit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </section>
        </div>
      )}
    </div>
  );
}


