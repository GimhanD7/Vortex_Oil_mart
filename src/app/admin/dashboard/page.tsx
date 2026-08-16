"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Filter,
  Gauge,
  PackagePlus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type DashboardData = {
  metrics: {
    revenue: number;
    orders: number;
    items_sold: number;
    average_order_value: number;
    gross_profit: number;
    customers: number;
    today_revenue: number;
    today_orders: number;
    month_revenue: number;
    month_orders: number;
    discount_total: number;
    voided_count: number;
    voided_amount: number;
    refund_count: number;
    refund_amount: number;
    revocation_records: number;
    revocation_amount: number;
  };
  inventory: {
    total_products: number;
    total_skus: number;
    in_stock: number;
    out_of_stock: number;
    low_stock: number;
    stock_value: number;
  };
  customers: {
    outstanding_balance: number;
    credit_limit: number;
    credit_customers: number;
    active_customers: number;
  };
  purchases: {
    purchase_count: number;
    purchase_value: number;
    today_purchase_value: number;
  };
  low_stock: Array<{ id: number; name: string; sku: string | null; category: string | null; stock_quantity: number }>;
  recent_orders: Array<{ id: number; total_amount: string | number; status: string | null; created_at: string; customer_name: string | null; item_count: number }>;
  top_products: Array<{ name: string; category: string | null; quantity: string | number; total: string | number }>;
  payment_methods: Array<{ method: string; orders: number; total: string | number }>;
  categories: Array<{ category: string | null; total: string | number }>;
  daily: Array<{ date: string; total: string | number; orders: number }>;
  cashiers: Array<{ cashier: string; orders: number; total: string | number; items: string | number }>;
  selected_sales?: { day: string; month: string };
};

type MetricKey = "revenue" | "orders" | "items" | "average" | "profit" | "customers";

const metricIcons: Record<MetricKey, LucideIcon> = {
  revenue: Receipt,
  orders: ClipboardList,
  items: PackagePlus,
  average: Gauge,
  profit: TrendingUp,
  customers: Users,
};

const metricDefs: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: "revenue", label: "Total Revenue", color: "orange" },
  { key: "orders", label: "Total Orders", color: "green" },
  { key: "items", label: "Total Items Sold", color: "purple" },
  { key: "average", label: "Average Order Value", color: "blue" },
  { key: "profit", label: "Gross Profit", color: "green" },
  { key: "customers", label: "Total Customers", color: "purple" },
];

const productIcons: Record<string, LucideIcon> = {
  oil: PackagePlus,
  filter: Filter,
  battery: BatteryCharging,
  spark: Zap,
  air: SlidersHorizontal,
  brake: Wrench,
};

const quickIcons: Record<string, LucideIcon> = {
  "Add Product": PackagePlus,
  "Add Customer": UserPlus,
  "New Purchase": ShoppingCart,
  "POS Billing": Receipt,
  "Stock Adjustment": SlidersHorizontal,
  "Expense Entry": FileBarChart,
  "Add User": UserPlus,
  "View Reports": FileBarChart,
};

const quickTargets: Record<string, string> = {
  "Add Product": "/admin/products",
  "Add Customer": "/admin/customers",
  "New Purchase": "/admin/purchases",
  "POS Billing": "/dashboard",
  "Stock Adjustment": "/admin/inventory",
  "Expense Entry": "/admin/reports",
  "Add User": "/admin/users",
  "View Reports": "/admin/reports",
};

const fallbackData: DashboardData = {
  metrics: {
    revenue: 0,
    orders: 0,
    items_sold: 0,
    average_order_value: 0,
    gross_profit: 0,
    customers: 0,
    today_revenue: 0,
    today_orders: 0,
    month_revenue: 0,
    month_orders: 0,
    discount_total: 0,
    voided_count: 0,
    voided_amount: 0,
    refund_count: 0,
    refund_amount: 0,
    revocation_records: 0,
    revocation_amount: 0,
  },
  inventory: { total_products: 0, total_skus: 0, in_stock: 0, out_of_stock: 0, low_stock: 0, stock_value: 0 },
  customers: { outstanding_balance: 0, credit_limit: 0, credit_customers: 0, active_customers: 0 },
  purchases: { purchase_count: 0, purchase_value: 0, today_purchase_value: 0 },
  low_stock: [],
  recent_orders: [],
  top_products: [],
  payment_methods: [],
  categories: [],
  daily: [],
  cashiers: [],
};

function Panel({ title, action, onAction, children, className = "" }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <section className={`dash-panel ${className}`}>
      <header>
        <h2>{title}</h2>
        {action && <button onClick={onAction}>{action}</button>}
      </header>
      {children}
    </section>
  );
}

function money(value: number | string) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactMoney(value: number | string) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function qty(value: number | string) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function inputDateToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function inputMonthToday() {
  return inputDateToday().slice(0, 7);
}

function readableDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

function readableMonth(value: string) {
  return value ? new Date(`${value}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "";
}

function categoryKey(category?: string | null) {
  const text = (category || "").toLowerCase();
  if (text.includes("filter")) return "filter";
  if (text.includes("batter")) return "battery";
  if (text.includes("spark")) return "spark";
  if (text.includes("brake")) return "brake";
  if (text.includes("air")) return "air";
  if (text.includes("oil")) return "oil";
  return "item";
}

function ProductMark({ category }: { category?: string | null }) {
  const Icon = productIcons[categoryKey(category)] || Sparkles;
  return <Icon className="product-mark" aria-hidden="true" strokeWidth={1.9} />;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

const chartColors = ["#ffbd00", "#3f434b", "#79a93d", "#9a56d5", "#4c82d4", "#b3b5b8"];

type PieDatum = {
  label: string;
  value: number;
  detail: string;
};

function polarToCartesian(center: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function donutSlicePath(center: number, outer: number, inner: number, start: number, end: number) {
  const safeEnd = end - start >= 359.99 ? start + 359.99 : end;
  const outerStart = polarToCartesian(center, outer, safeEnd);
  const outerEnd = polarToCartesian(center, outer, start);
  const innerStart = polarToCartesian(center, inner, start);
  const innerEnd = polarToCartesian(center, inner, safeEnd);
  const largeArc = safeEnd - start > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function PieChart({ data, selectedIndex, onSelect, label }: { data: PieDatum[]; selectedIndex: number | null; onSelect: (index: number) => void; label: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const center = 92;
  const outer = 78;
  const inner = 42;

  if (!total) {
    return (
      <svg className="interactive-pie" viewBox="0 0 184 184" role="img" aria-label={label}>
        <circle cx={center} cy={center} r={outer} className="pie-empty-ring" />
        <circle cx={center} cy={center} r={inner} className="pie-hole" />
        <text x={center} y={center + 4}>No data</text>
      </svg>
    );
  }

  const segments = data.map((item, index) => {
    const previousTotal = data.slice(0, index).reduce((sum, entry) => sum + entry.value, 0);
    const start = (previousTotal / total) * 360;
    const end = start + (item.value / total) * 360;
    return { item, index, start, end };
  });

  return (
    <svg className="interactive-pie" viewBox="0 0 184 184" role="img" aria-label={label}>
      {segments.map(({ item, index, start, end }) => {
        return (
          <path
            key={item.label}
            d={donutSlicePath(center, outer, inner, start, end)}
            fill={chartColors[index % chartColors.length]}
            className={selectedIndex === index ? "pie-slice active" : "pie-slice"}
            role="button"
            tabIndex={0}
            aria-label={`${item.label}, ${percent(item.value, total)} percent`}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(index);
            }}
          />
        );
      })}
      <circle cx={center} cy={center} r={inner} className="pie-hole" />
      <text x={center} y={center - 4}>{data.length}</text>
      <text x={center} y={center + 17}>types</text>
    </svg>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [salesDay, setSalesDay] = useState(inputDateToday);
  const [salesMonth, setSalesMonth] = useState(inputMonthToday);
  const [selectedDailyIndex, setSelectedDailyIndex] = useState<number | null>(null);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ sales_day: salesDay, sales_month: salesMonth });
    fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((next) => setData({ ...fallbackData, ...next }))
      .catch(() => setData(fallbackData))
      .finally(() => setLoading(false));
  }, [salesDay, salesMonth]);

  const metrics = metricDefs.map((metric) => {
    const raw = metric.key === "revenue"
      ? data.metrics.revenue
      : metric.key === "orders"
        ? data.metrics.orders
        : metric.key === "items"
          ? data.metrics.items_sold
          : metric.key === "average"
            ? data.metrics.average_order_value
            : metric.key === "profit"
              ? data.metrics.gross_profit
              : data.metrics.customers;
    return {
      ...metric,
      value: ["revenue", "average", "profit"].includes(metric.key) ? money(raw) : Number(raw || 0).toLocaleString("en-IN"),
    };
  });

  const categoryTotal = data.categories.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const paymentTotal = data.payment_methods.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const cashierMax = Math.max(1, ...data.cashiers.map((item) => Number(item.total || 0)));
  const stockTotal = Math.max(1, data.inventory.total_products);
  const stockHealth = Math.round((data.inventory.in_stock / stockTotal) * 100);
  const categoryChart = data.categories.slice(0, 6).map((item) => ({
    label: item.category || "Others",
    value: Number(item.total || 0),
    detail: money(item.total),
  }));
  const paymentChart = data.payment_methods.slice(0, 5).map((item) => ({
    label: item.method,
    value: Number(item.total || 0),
    detail: `${money(item.total)} / ${item.orders} invoices`,
  }));
  const activeCategoryIndex = selectedCategoryIndex !== null && categoryChart.length ? Math.min(selectedCategoryIndex, categoryChart.length - 1) : null;
  const activePaymentIndex = selectedPaymentIndex !== null && paymentChart.length ? Math.min(selectedPaymentIndex, paymentChart.length - 1) : null;
  const dailyPoints = useMemo(() => {
    const rows = data.daily.slice(-14);
    const maxRevenue = Math.max(1, ...rows.map((row) => Number(row.total || 0)));
    const maxOrders = Math.max(1, ...rows.map((row) => Number(row.orders || 0)));
    const xStep = rows.length > 1 ? 504 / (rows.length - 1) : 0;
    return rows.map((row, index) => ({
      x: 48 + index * xStep,
      revenueY: 204 - (Number(row.total || 0) / maxRevenue) * 150,
      orderY: 204 - (Number(row.orders || 0) / maxOrders) * 150,
      total: Number(row.total || 0),
      orders: Number(row.orders || 0),
      date: row.date,
      label: new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    }));
  }, [data.daily]);
  const activeDailyIndex = selectedDailyIndex !== null && dailyPoints.length ? Math.min(selectedDailyIndex, dailyPoints.length - 1) : -1;
  const activeDaily = activeDailyIndex >= 0 ? dailyPoints[activeDailyIndex] : null;

  return (
    <div className="dashboard-grid">
      <section className="metric-row">
        {metrics.map(({ key, label, value, color }) => {
          const Icon = metricIcons[key];
          return (
            <article className="metric-card" key={label}>
              <span className={color}>
                <Icon aria-hidden="true" size={24} strokeWidth={1.9} />
              </span>
              <div>
                <small>{label}</small>
                <strong>{loading ? "Loading..." : value}</strong>
                <em>
                  Live data <i>from sales & inventory</i>
                </em>
              </div>
            </article>
          );
        })}
        <article className="metric-card dashboard-alert-card" onClick={() => router.push("/admin/customers")} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") router.push("/admin/customers"); }}>
          <span className="purple">
            <CreditCard aria-hidden="true" size={24} strokeWidth={1.9} />
          </span>
          <div>
            <small>Customer Outstanding</small>
            <strong>{money(data.customers.outstanding_balance)}</strong>
            <em>{data.customers.credit_customers} customers with balance</em>
          </div>
        </article>
        <article className="metric-card dashboard-alert-card" onClick={() => router.push("/admin/sales")} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") router.push("/admin/sales"); }}>
          <span className="red">
            <RotateCcw aria-hidden="true" size={24} strokeWidth={1.9} />
          </span>
          <div>
            <small>Void / Refund Watch</small>
            <strong>{data.metrics.voided_count + data.metrics.refund_count}</strong>
            <em>{money(data.metrics.voided_amount + data.metrics.refund_amount)} affected</em>
          </div>
        </article>
      </section>

      <section className="sales-period-section">
        <header>
          <div>
            <h2>Sales Day/Month</h2>
            <p>Select a day or month to view the matching sales totals.</p>
          </div>
        </header>
        <div className="dashboard-insight-row">
        <article className="sales-picker-card">
          <span className="orange"><CalendarDays size={22} aria-hidden="true" /></span>
          <p><small>Day Sales</small><b>{money(data.metrics.today_revenue)}</b><em>{data.metrics.today_orders} invoices / {readableDate(salesDay)}</em></p>
          <label>
            Date
            <input type="date" value={salesDay} onChange={(event) => setSalesDay(event.target.value)} />
          </label>
        </article>
        <article className="sales-picker-card">
          <span className="blue"><CalendarRange size={22} aria-hidden="true" /></span>
          <p><small>Month Sales</small><b>{money(data.metrics.month_revenue)}</b><em>{data.metrics.month_orders} invoices / {readableMonth(salesMonth)}</em></p>
          <label>
            Month
            <input type="month" value={salesMonth} onChange={(event) => setSalesMonth(event.target.value)} />
          </label>
        </article>
        </div>
      </section>

      <Panel title="Sales Overview" action="By Day" className="sales-chart-panel">
        <div className="chart-key"><i className="gold" />Revenue (Rs.) <i className="black" /> Orders <span>last 14 days</span></div>
        <div className="interactive-chart-layout">
          <svg className="line-chart" viewBox="0 0 600 235" role="img" aria-label="Sales and order trend for fourteen days">
            {[30, 75, 120, 165, 210].map((y) => <line key={y} x1="45" y1={y} x2="575" y2={y} className="gridline" />)}
            {dailyPoints.length ? (
              <>
                <polyline points={dailyPoints.map((point) => `${point.x},${point.revenueY}`).join(" ")} className="revenue-line" />
                <polyline points={dailyPoints.map((point) => `${point.x},${point.orderY}`).join(" ")} className="orders-line" />
                {dailyPoints.map((point, index) => (
                  <g
                    key={`${point.x}-${point.label}`}
                    className={activeDailyIndex === index ? "chart-point active" : "chart-point"}
                    role="button"
                    tabIndex={0}
                    aria-label={`${point.label}, ${money(point.total)}, ${point.orders} orders`}
                    onClick={() => setSelectedDailyIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedDailyIndex(index);
                    }}
                  >
                    <circle cx={point.x} cy={point.revenueY} r="6" className="revenue-dot" />
                    <circle cx={point.x} cy={point.orderY} r="4" className="order-dot" />
                    <text x={point.x} y="231">{point.label}</text>
                  </g>
                ))}
              </>
            ) : (
              <text x="300" y="130">No sales yet</text>
            )}
          </svg>
          {activeDaily && (
            <div className="chart-click-detail">
              <small>Selected Day</small>
              <b>{activeDaily.label}</b>
              <p><span>Revenue</span><strong>{money(activeDaily.total)}</strong></p>
              <p><span>Invoices</span><strong>{activeDaily.orders}</strong></p>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Revenue by Category" className="category-panel">
        <div className="donut-wrap visual-donut-wrap">
          <PieChart data={categoryChart} selectedIndex={activeCategoryIndex} onSelect={setSelectedCategoryIndex} label="Revenue by category" />
          <ul className="clickable-legend">
            {(categoryChart.length ? categoryChart : [{ label: "No sales yet", value: 0, detail: money(0) }]).map((item, index) => (
              <li key={`${item.label}-${index}`}>
                <button className={activeCategoryIndex === index ? "active" : ""} onClick={() => setSelectedCategoryIndex(index)}>
                  <i className={`c${index + 1}`} />{item.label} <b>{percent(item.value, categoryTotal)}%</b>
                </button>
              </li>
            ))}
          </ul>
          {activeCategoryIndex !== null && (
            <div className="chart-click-detail pie-detail">
              <small>Selected Category</small>
              <b>{categoryChart[activeCategoryIndex]?.label}</b>
              <p><span>Revenue</span><strong>{categoryChart[activeCategoryIndex]?.detail}</strong></p>
              <p><span>Share</span><strong>{percent(categoryChart[activeCategoryIndex]?.value || 0, categoryTotal)}%</strong></p>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Low Stock Alerts" action="View All" onAction={() => router.push("/admin/inventory")} className="low-stock-panel">
        <div className="stock-list">
          {data.low_stock.map((item) => (
            <div key={item.id}>
              <ProductMark category={item.category} />
              <p><b>{item.name}</b><small>SKU: {item.sku || `SKU-${item.id}`}</small></p>
              <em>Stock: {item.stock_quantity}</em>
            </div>
          ))}
          {!data.low_stock.length && <p className="empty-movement">No low stock alerts.</p>}
        </div>
      </Panel>

      <Panel title="Sales by Payment Method" className="payment-panel">
        <div className="donut-wrap compact visual-donut-wrap">
          <PieChart data={paymentChart} selectedIndex={activePaymentIndex} onSelect={setSelectedPaymentIndex} label="Sales by payment method" />
          <ul className="clickable-legend">
            {(paymentChart.length ? paymentChart : [{ label: "No sales yet", value: 0, detail: money(0) }]).map((item, index) => (
              <li key={item.label}>
                <button className={activePaymentIndex === index ? "active" : ""} onClick={() => setSelectedPaymentIndex(index)}>
                  <i className={`c${index + 1}`} />{item.label} <b>{percent(item.value, paymentTotal)}%</b>
                </button>
              </li>
            ))}
          </ul>
          {activePaymentIndex !== null && (
            <div className="chart-click-detail pie-detail">
              <small>Selected Payment</small>
              <b>{paymentChart[activePaymentIndex]?.label}</b>
              <p><span>Total</span><strong>{paymentChart[activePaymentIndex]?.detail}</strong></p>
              <p><span>Share</span><strong>{percent(paymentChart[activePaymentIndex]?.value || 0, paymentTotal)}%</strong></p>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Sales by Store" action="This Week" className="store-panel">
        <div className="store-bars">
          <div><p>Stock Health <b>{stockHealth}% <small>items available</small></b></p><i><span style={{ width: `${stockHealth}%` }} /></i></div>
          <div><p>Purchase Value <b>{compactMoney(data.purchases.purchase_value)} <small>this month</small></b></p><i><span style={{ width: data.purchases.purchase_value ? "72%" : "0%" }} /></i></div>
          <div><p>Low Stock Items <b>{data.inventory.low_stock} <small>needs reorder</small></b></p><i><span style={{ width: `${Math.min(100, data.inventory.low_stock * 8)}%` }} /></i></div>
        </div>
      </Panel>

      <Panel title="Cashier Performance" action="30 Days" className="cashier-panel">
        <div className="cashier-bars">
          {data.cashiers.map((item) => (
            <div key={item.cashier}>
              <p><b>{item.cashier}</b><span>{money(item.total)} / {item.orders} invoices</span></p>
              <i><span style={{ width: `${Math.max(6, Math.round((Number(item.total || 0) / cashierMax) * 100))}%` }} /></i>
              <small>{qty(item.items)} items sold</small>
            </div>
          ))}
          {!data.cashiers.length && <p className="empty-movement">No cashier sales yet.</p>}
        </div>
      </Panel>

      <Panel title="Operations Snapshot" className="operations-panel">
        <div className="operations-grid">
          <div><span><Truck size={19} aria-hidden="true" /></span><small>Purchases</small><b>{data.purchases.purchase_count}</b><em>{money(data.purchases.purchase_value)}</em></div>
          <div><span><ShoppingCart size={19} aria-hidden="true" /></span><small>Today Stock In</small><b>{money(data.purchases.today_purchase_value)}</b><em>purchase value</em></div>
          <div><span><UserCheck size={19} aria-hidden="true" /></span><small>Active Customers</small><b>{data.customers.active_customers}</b><em>{money(data.customers.credit_limit)} credit limit</em></div>
          <div><span><RotateCcw size={19} aria-hidden="true" /></span><small>Audit Records</small><b>{data.metrics.revocation_records}</b><em>{money(data.metrics.revocation_amount)}</em></div>
        </div>
      </Panel>

      <Panel title="Recent Orders" action="View All" onAction={() => router.push("/admin/sales")} className="orders-panel">
        <div className="order-list">
          {data.recent_orders.map((order) => (
            <div key={order.id}>
              <b>INV-{String(order.id).padStart(6, "0")}</b>
              <span>{new Date(order.created_at).toLocaleString()}</span>
              <strong>{money(order.total_amount)}</strong>
              <em>{order.status || "Completed"}</em>
            </div>
          ))}
          {!data.recent_orders.length && <p className="empty-movement">No recent orders.</p>}
        </div>
      </Panel>

      <Panel title="Top Selling Products" action="This Week" className="products-panel">
        <div className="product-list">
          {data.top_products.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <i>{index + 1}</i>
              <ProductMark category={item.category} />
              <b>{item.name}</b>
              <em>{qty(item.quantity)}</em>
              <strong>{money(item.total)}</strong>
            </div>
          ))}
          {!data.top_products.length && <p className="empty-movement">No top products yet.</p>}
        </div>
      </Panel>

      <Panel title="Recent Sales" action="View All" onAction={() => router.push("/admin/sales")} className="recent-sales-panel">
        <div className="table-scroll">
          <table>
            <thead><tr><th>Invoice No.</th><th>Date &amp; Time</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.recent_orders.map((order) => (
                <tr key={order.id}>
                  <td>INV-{String(order.id).padStart(6, "0")}</td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                  <td>{order.customer_name || "Walk-in Customer"}</td>
                  <td>{Number(order.item_count || 0)}</td>
                  <td>{money(order.total_amount)}</td>
                  <td><span>{order.status || "Completed"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Quick Actions" className="quick-panel">
        <div className="quick-actions">
          {Object.keys(quickIcons).map((label) => {
            const Icon = quickIcons[label];
            return <button key={label} onClick={() => router.push(quickTargets[label])}><span><Icon aria-hidden="true" size={22} strokeWidth={1.9} /></span>{label}</button>;
          })}
        </div>
      </Panel>

      <Panel title="Inventory Summary" action="View All" onAction={() => router.push("/admin/inventory")} className="inventory-panel">
        <div className="inventory-stats">
          <div><small>Total Products</small><b>{data.inventory.total_products}</b></div>
          <div><small>Total SKUs</small><b>{data.inventory.total_skus}</b></div>
          <div className="good"><small>In Stock</small><b>{data.inventory.in_stock}</b></div>
          <div className="bad"><small>Out of Stock</small><b>{data.inventory.out_of_stock}</b></div>
          <div className="wide"><small>Stock Value</small><b>{money(data.inventory.stock_value)}</b></div>
          <div className="wide bad"><small>Low Stock Items</small><b>{data.inventory.low_stock}</b></div>
        </div>
      </Panel>
    </div>
  );
}
