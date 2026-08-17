"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  ShieldCheck,
  ShoppingCart,
  Star,
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
  total_amount: string | number;
  discount_amount?: string | number;
  tax_amount?: string | number;
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
  const currentCycleRows = cashCycle ? rows.filter((row) => row.sales_cycle_id === cashCycle.id) : rows;
  const sourceRows = currentCycleRows.length ? currentCycleRows : rows;
  return sourceRows.reduce(
    (totals, row) => {
      if (row.status === "cancelled" || row.status === "voided") return totals;
      const totalAmount = Math.max(0, Number(row.total_amount || 0) - Number(row.returned_amount || 0));
      totals.invoiceCount += 1;
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
  const [returnInvoice, setReturnInvoice] = useState<InvoiceDetail | null>(null);
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
    if (!user || user.role === "admin") return [];
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

  const openReturn = async (saleId: number) => {
    try {
      const detail = await loadInvoiceDetail(saleId);
      setReturnInvoice(detail);
      setReturnQuantities({});
      setReturnResolution(detail.sale.payment_method === "Credit" ? "Credit Adjustment" : detail.sale.payment_method || "Cash");
      setReturnDisposition("resellable");
      setReturnReason("");
      setReturnNotes("");
    } catch (error) {
      showToast({ type: "error", title: "Invoice unavailable", message: error instanceof Error ? error.message : "Unable to load invoice." });
    }
  };

  const submitReturn = async (event: FormEvent) => {
    event.preventDefault();
    if (!returnInvoice || !returnReason.trim()) return;
    const items = returnInvoice.items.map((item) => ({ sale_item_id: item.sale_item_id, quantity: Number(returnQuantities[item.sale_item_id] || 0), disposition: returnDisposition })).filter((item) => item.quantity > 0);
    if (!items.length) {
      showToast({ type: "warning", title: "Select returned items", message: "Enter a return quantity for at least one item." });
      return;
    }
    setReturnSaving(true);
    try {
      const response = await fetch(`/api/sales/${returnInvoice.sale.id}/returns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, resolution: returnResolution, reason: returnReason, notes: returnNotes, sales_cycle_id: cashCycle?.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to record return");
      if (returnResolution === "Exchange") {
        setExchangeOriginalId(returnInvoice.sale.id);
        showToast({ type: "success", title: `${data.return_number} recorded`, message: `Add replacement items to the cart. The next invoice will reference ${settings.invoice_prefix}-${String(returnInvoice.sale.id).padStart(6, "0")}.` });
      } else {
        showToast({ type: "success", title: `${data.return_number} recorded`, message: `${money(Number(data.refund_amount))} recorded by ${returnResolution}.` });
      }
      setReturnInvoice(null);
      setInvoiceDetail(null);
      setProducts(await fetchProducts());
      await loadCashierSummary();
    } catch (error) {
      showToast({ type: "error", title: "Return failed", message: error instanceof Error ? error.message : "Unable to record return." });
    } finally { setReturnSaving(false); }
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

  const filteredNav = navItems.filter((item) => {
    if (isAdmin) return true;
    const req = PERMISSION_MAP[item.href];
    return !req || user.permissions.includes(req);
  });

  return (
    <div className={`pos-shell${sidebarCollapsed ? " sidebar-collapsed" : ""} ${isCashier ? "cashier-pos-shell" : ""} ${mobileNavOpen ? " sidebar-mobile-open" : ""}`}>
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
            <button className="pos-status-pill">
              <ShoppingCart size={16} aria-hidden="true" />
              <span>{shiftLabel}</span>
            </button>
            <button className="pos-status-pill">
              <CalendarDays size={16} aria-hidden="true" />
              <span>{displayDate} / {displayTime}</span>
              <em><CircleDot size={12} aria-hidden="true" /> Online</em>
            </button>
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
              {isAdmin ? (
                <button onClick={() => router.push("/admin/customers")}><Plus size={16} aria-hidden="true" /> Manage Customers</button>
              ) : (
                <span className="cashier-shift-chip"><Banknote size={15} aria-hidden="true" /> Opening Cash {money(cashCycle?.openingBalance || 0)}</span>
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

            {isCashier && (
              <section className="cashier-summary-card">
                <header>
                  <div>
                    <h2><BarChart3 size={18} aria-hidden="true" /> Sales Summary</h2>
                    <p>{activeSummaryRange.label} / {cashCycle?.id}</p>
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
              <section className="cash-modal cycle-invoices-modal">
                <h2>Current Cycle Invoices</h2>
                <p>{cashCycle?.id} · invoices remain listed after cancellation or return.</p>
                <div className="cycle-invoice-list">
                  {summaryRows.filter((sale) => !cashCycle || sale.sales_cycle_id === cashCycle.id).map((sale) => (
                    <article key={sale.id}>
                      <div><b>{settings.invoice_prefix}-{String(sale.id).padStart(6, "0")}</b><small>{new Date(sale.created_at).toLocaleString()} · {sale.customer_name || "Walk-in Customer"}</small></div>
                      <span>{money(Number(sale.total_amount))}<small>{sale.status || "completed"}</small></span>
                      <aside>
                        <button type="button" onClick={() => void loadInvoiceDetail(sale.id)}>View</button>
                        {!['cancelled', 'returned'].includes(sale.status) && <button type="button" onClick={() => void openReturn(sale.id)}>Return / Exchange</button>}
                        {sale.status === 'completed' && <button type="button" className="danger" onClick={() => cancelCompletedSale(sale)}>Cancel Bill</button>}
                      </aside>
                    </article>
                  ))}
                  {!summaryRows.filter((sale) => !cashCycle || sale.sales_cycle_id === cashCycle.id).length && <p>No invoices in this cycle.</p>}
                </div>
                {invoiceDetail && (
                  <div className="cycle-invoice-detail">
                    <b>{settings.invoice_prefix}-{String(invoiceDetail.sale.id).padStart(6, "0")} · {invoiceDetail.sale.status}</b>
                    {invoiceDetail.items.map((item) => <p key={item.sale_item_id}><span>{item.product_name} × {formatQty(item.quantity, item.unit)}</span><b>{money(Number(item.price_at_time) * Number(item.quantity))}</b></p>)}
                  </div>
                )}
                <footer><button type="button" onClick={() => { setShowCycleInvoices(false); setInvoiceDetail(null); }}>Close</button></footer>
              </section>
            </div>
          )}
          {returnInvoice && (
            <div className="cash-modal-backdrop">
              <form className="cash-modal return-sale-modal" onSubmit={submitReturn}>
                <h2>Return / Exchange</h2>
                <p>Original invoice: {settings.invoice_prefix}-{String(returnInvoice.sale.id).padStart(6, "0")}. A new return document will be created.</p>
                <div className="return-item-list">
                  {returnInvoice.items.map((item) => {
                    const available = Math.max(0, Number(item.quantity) - Number(item.returned_quantity || 0));
                    return <label key={item.sale_item_id}><span><b>{item.product_name}</b><small>Available to return: {formatQty(available, item.unit)}</small></span><input type="number" min="0" max={available} step={item.unit?.toLowerCase() === 'l' ? '0.25' : '1'} value={returnQuantities[item.sale_item_id] || ''} onChange={(event) => setReturnQuantities((current) => ({ ...current, [item.sale_item_id]: event.target.value }))} placeholder="Qty" /></label>;
                  })}
                </div>
                <label>Resolution<select value={returnResolution} onChange={(event) => setReturnResolution(event.target.value)}><option>Cash</option><option>Card</option><option>Bank Transfer</option><option>Credit Adjustment</option><option>Exchange</option></select></label>
                <label>Stock condition<select value={returnDisposition} onChange={(event) => setReturnDisposition(event.target.value)}><option value="resellable">Resellable — restore stock</option><option value="damaged">Damaged / opened — do not restore stock</option></select></label>
                <label>Reason<input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} required placeholder="Why is the item being returned?" /></label>
                <label>Notes<textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Replacement details or refund reference" /></label>
                <footer><button type="button" onClick={() => setReturnInvoice(null)}>Close</button><button type="submit" disabled={returnSaving}>{returnSaving ? "Recording..." : returnResolution === 'Exchange' ? "Create Return & Start Exchange" : "Create Return Document"}</button></footer>
              </form>
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
                <footer>
                  <button type="button" onClick={() => setShowCloseModal(false)}>Cancel</button>
                  <button type="submit" disabled={checking || !hasValidClosingBalance}>
                    <X size={16} aria-hidden="true" /> Close Cycle
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
    </div>
  );
}
