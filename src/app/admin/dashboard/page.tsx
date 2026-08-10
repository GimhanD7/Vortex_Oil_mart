"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BatteryCharging,
  ClipboardList,
  FileBarChart,
  Filter,
  Gauge,
  PackagePlus,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
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
  };
  inventory: {
    total_products: number;
    total_skus: number;
    in_stock: number;
    out_of_stock: number;
    low_stock: number;
    stock_value: number;
  };
  low_stock: Array<{ id: number; name: string; sku: string | null; category: string | null; stock_quantity: number }>;
  recent_orders: Array<{ id: number; total_amount: string | number; status: string | null; created_at: string; customer_name: string | null; item_count: number }>;
  top_products: Array<{ name: string; category: string | null; quantity: string | number; total: string | number }>;
  payment_methods: Array<{ method: string; orders: number; total: string | number }>;
  categories: Array<{ category: string | null; total: string | number }>;
  daily: Array<{ date: string; total: string | number; orders: number }>;
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
  metrics: { revenue: 0, orders: 0, items_sold: 0, average_order_value: 0, gross_profit: 0, customers: 0 },
  inventory: { total_products: 0, total_skus: 0, in_stock: 0, out_of_stock: 0, low_stock: 0, stock_value: 0 },
  low_stock: [],
  recent_orders: [],
  top_products: [],
  payment_methods: [],
  categories: [],
  daily: [],
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
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function compactMoney(value: number | string) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

function donutBackground(values: number[]) {
  const colors = ["#ffbd00", "#3f434b", "#79a93d", "#9a56d5", "#4c82d4", "#b3b5b8"];
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return undefined;
  let cursor = 0;
  const stops = values.map((value, index) => {
    const start = cursor;
    cursor += (value / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(fallbackData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => response.json())
      .then((next) => setData({ ...fallbackData, ...next }))
      .catch(() => setData(fallbackData))
      .finally(() => setLoading(false));
  }, []);

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
  const dailyPoints = useMemo(() => {
    const rows = data.daily.slice(-7);
    const maxRevenue = Math.max(1, ...rows.map((row) => Number(row.total || 0)));
    const maxOrders = Math.max(1, ...rows.map((row) => Number(row.orders || 0)));
    const xStep = rows.length > 1 ? 504 / (rows.length - 1) : 0;
    return rows.map((row, index) => ({
      x: 48 + index * xStep,
      revenueY: 204 - (Number(row.total || 0) / maxRevenue) * 150,
      orderY: 204 - (Number(row.orders || 0) / maxOrders) * 150,
      label: new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    }));
  }, [data.daily]);

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
      </section>

      <Panel title="Sales Overview" action="By Day" className="sales-chart-panel">
        <div className="chart-key"><i className="gold" />Revenue (Rs.) <i className="black" /> Orders</div>
        <svg className="line-chart" viewBox="0 0 600 235" role="img" aria-label="Sales and order trend for seven days">
          {[30, 75, 120, 165, 210].map((y) => <line key={y} x1="45" y1={y} x2="575" y2={y} className="gridline" />)}
          {dailyPoints.length ? (
            <>
              <polyline points={dailyPoints.map((point) => `${point.x},${point.revenueY}`).join(" ")} className="revenue-line" />
              <polyline points={dailyPoints.map((point) => `${point.x},${point.orderY}`).join(" ")} className="orders-line" />
              {dailyPoints.map((point) => (
                <g key={`${point.x}-${point.label}`}>
                  <circle cx={point.x} cy={point.revenueY} r="5" className="revenue-dot" />
                  <circle cx={point.x} cy={point.orderY} r="4" className="order-dot" />
                  <text x={point.x} y="231">{point.label}</text>
                </g>
              ))}
            </>
          ) : (
            <text x="300" y="130">No sales yet</text>
          )}
        </svg>
      </Panel>

      <Panel title="Revenue by Category" className="category-panel">
        <div className="donut-wrap">
          <div className="donut large" style={{ background: donutBackground(data.categories.map((item) => Number(item.total || 0))) }} />
          <ul>
            {(data.categories.length ? data.categories : [{ category: "No sales yet", total: 0 }]).slice(0, 6).map((item, index) => (
              <li key={`${item.category || "Other"}-${index}`}><i className={`c${index + 1}`} />{item.category || "Others"} <b>{percent(Number(item.total || 0), categoryTotal)}%</b></li>
            ))}
          </ul>
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
        <div className="donut-wrap compact">
          <div className="donut small" style={{ background: donutBackground(data.payment_methods.map((item) => Number(item.total || 0))) }} />
          <ul>
            {(data.payment_methods.length ? data.payment_methods : [{ method: "No sales yet", total: 0, orders: 0 }]).slice(0, 5).map((item, index) => (
              <li key={item.method}><i className={`c${index + 1}`} />{item.method} <b>{percent(Number(item.total || 0), paymentTotal)}%</b></li>
            ))}
          </ul>
        </div>
      </Panel>

      <Panel title="Sales by Store" action="This Week" className="store-panel">
        <div className="store-bars">
          <div><p>Main Store <b>{compactMoney(data.metrics.revenue)} <small>(100%)</small></b></p><i><span style={{ width: data.metrics.revenue ? "100%" : "0%" }} /></i></div>
          <div><p>Purchase Value <b>{compactMoney(data.inventory.stock_value)} <small>inventory</small></b></p><i><span style={{ width: data.inventory.stock_value ? "72%" : "0%" }} /></i></div>
          <div><p>Low Stock Items <b>{data.inventory.low_stock} <small>needs reorder</small></b></p><i><span style={{ width: `${Math.min(100, data.inventory.low_stock * 8)}%` }} /></i></div>
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
              <em>{Number(item.quantity || 0)}</em>
              <strong>{money(item.total)}</strong>
            </div>
          ))}
          {!data.top_products.length && <p className="empty-movement">No top products yet.</p>}
        </div>
      </Panel>

      <Panel title="Recent Sales" action="View All" onAction={() => router.push("/admin/sales")} className="recent-sales-panel">
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
