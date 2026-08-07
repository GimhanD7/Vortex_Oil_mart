"use client";

const metrics = [
  ["◉","Total Revenue","Rs. 1,25,340.00","18.5%","orange"],
  ["▤","Total Orders","156","12.3%","green"],
  ["▢","Total Items Sold","342","15.8%","purple"],
  ["♙","Average Order Value","Rs. 803.46","5.2%","blue"],
  ["▣","Gross Profit","Rs. 28,450.00","16.7%","green"],
  ["♧","Total Customers","89","8.9%","purple"],
];

const lowStock = [["▥","Shell Helix Ultra 5W-40 4L","SHU-5W40-4L","4"],["◉","Bosch Oil Filter","BOF-001","6"],["▰","Amaron Go Battery 55B24L","AM55B24L","3"],["♢","NGK Spark Plug","SPK-001","8"],["▤","Mann Air Filter","MA-102","7"]];
const orders = [["INV-000132","18 May, 10:30 AM","Rs. 2,650.00"],["INV-000131","18 May, 09:45 AM","Rs. 1,250.00"],["INV-000130","18 May, 09:20 AM","Rs. 750.00"],["INV-000129","17 May, 06:15 PM","Rs. 3,450.00"],["INV-000128","17 May, 05:40 PM","Rs. 1,120.00"]];
const products = [["1","▥","Shell Helix Ultra 5W-40 4L","64","Rs. 2,43,200.00"],["2","▰","Castrol EDGE 5W-30 4L","48","Rs. 1,68,960.00"],["3","◉","Bosch Oil Filter","40","Rs. 60,000.00"],["4","▱","Brake Pad Set (Front)","32","Rs. 40,800.00"],["5","▣","Amaron Go Battery","24","Rs. 48,000.00"]];

function Panel({title,action,children,className=""}:{title:string;action?:string;children:React.ReactNode;className?:string}) { return <section className={`dash-panel ${className}`}><header><h2>{title}</h2>{action&&<button>{action}</button>}</header>{children}</section> }

export default function AdminDashboard() {
  return <div className="dashboard-grid">
    <section className="metric-row">
      {metrics.map(([icon,label,value,growth,color]) => <article className="metric-card" key={label}><span className={color}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>↑ {growth} <i>vs. last 7 days</i></em></div></article>)}
    </section>

    <Panel title="Sales Overview" action="By Day　⌄" className="sales-chart-panel">
      <div className="chart-key"><i className="gold"/>Revenue (Rs.) <i className="black"/> Orders</div>
      <svg className="line-chart" viewBox="0 0 600 235" role="img" aria-label="Sales and order trend for seven days">
        {[30,75,120,165,210].map(y=><line key={y} x1="45" y1={y} x2="575" y2={y} className="gridline"/>)}
        <polyline points="48,184 132,151 216,84 300,116 384,95 468,55 552,88" className="revenue-line"/>
        <polyline points="48,202 132,176 216,144 300,112 384,137 468,103 552,132" className="orders-line"/>
        {[48,132,216,300,384,468,552].map((x,i)=><g key={x}><circle cx={x} cy={[184,151,84,116,95,55,88][i]} r="5" className="revenue-dot"/><circle cx={x} cy={[202,176,144,112,137,103,132][i]} r="4" className="order-dot"/><text x={x} y="231">{12+i} May</text></g>)}
      </svg>
    </Panel>

    <Panel title="Revenue by Category" className="category-panel"><div className="donut-wrap"><div className="donut large"/><ul><li><i className="c1"/>Engine Oils <b>40%</b></li><li><i className="c2"/>Filters <b>20%</b></li><li><i className="c3"/>Brake System <b>15%</b></li><li><i className="c4"/>Batteries <b>10%</b></li><li><i className="c5"/>Spark Plugs <b>8%</b></li><li><i className="c6"/>Others <b>7%</b></li></ul></div></Panel>

    <Panel title="Low Stock Alerts" action="View All" className="low-stock-panel"><div className="stock-list">{lowStock.map(([ico,n,sku,count])=><div key={n}><span>{ico}</span><p><b>{n}</b><small>SKU: {sku}</small></p><em>Stock: {count}</em></div>)}</div></Panel>

    <Panel title="Sales by Payment Method" className="payment-panel"><div className="donut-wrap compact"><div className="donut small"/><ul><li><i className="c1"/>Cash <b>45%</b></li><li><i className="c2"/>UPI <b>30%</b></li><li><i className="c3"/>Card <b>15%</b></li><li><i className="c4"/>Wallet <b>7%</b></li><li><i className="c5"/>Net Banking <b>3%</b></li></ul></div></Panel>

    <Panel title="Sales by Store" action="This Week　⌄" className="store-panel"><div className="store-bars"><div><p>Main Store <b>Rs. 78,450 <small>(62%)</small></b></p><i><span style={{width:"82%"}}/></i></div><div><p>Branch Store (Noida) <b>Rs. 28,730 <small>(23%)</small></b></p><i><span style={{width:"42%"}}/></i></div><div><p>Branch Store (Gurgaon) <b>Rs. 18,160 <small>(15%)</small></b></p><i><span style={{width:"28%"}}/></i></div></div></Panel>

    <Panel title="Recent Orders" action="View All" className="orders-panel"><div className="order-list">{orders.map(([id,date,total])=><div key={id}><b>{id}</b><span>{date}</span><strong>{total}</strong><em>Completed</em></div>)}</div></Panel>

    <Panel title="Top Selling Products" action="This Week　⌄" className="products-panel"><div className="product-list">{products.map(([rank,ico,n,qty,total])=><div key={rank}><i>{rank}</i><span>{ico}</span><b>{n}</b><em>{qty}</em><strong>{total}</strong></div>)}</div></Panel>

    <Panel title="Recent Sales" action="View All" className="recent-sales-panel"><table><thead><tr><th>Invoice No.</th><th>Date &amp; Time</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.slice(0,4).map(([id,date,total],i)=><tr key={id}><td>{id}</td><td>{date}</td><td>{["Walk-in Customer","Rahul Sharma","Amit Kumar","Rajesh Anand"][i]}</td><td>{i+1}</td><td>{total}</td><td><span>Completed</span></td></tr>)}</tbody></table></Panel>

    <Panel title="Quick Actions" className="quick-panel"><div className="quick-actions">{[["＋","Add Product"],["♙+","Add Customer"],["⌁","New Purchase"],["▣","POS Billing"],["▤","Stock Adjustment"],["▧","Expense Entry"],["♙+","Add User"],["□","View Reports"]].map(([i,l])=><button key={l}><span>{i}</span>{l}</button>)}</div></Panel>

    <Panel title="Inventory Summary" action="View All" className="inventory-panel"><div className="inventory-stats"><div><small>Total Products</small><b>256</b></div><div><small>Total SKUs</small><b>368</b></div><div className="good"><small>In Stock</small><b>284</b></div><div className="bad"><small>Out of Stock</small><b>12</b></div><div className="wide"><small>Stock Value</small><b>Rs. 18,75,340.00</b></div><div className="wide bad"><small>Low Stock Items</small><b>22　⚠</b></div></div></Panel>
  </div>;
}
