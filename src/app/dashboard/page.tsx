"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const PERMISSION_MAP: Record<string, string> = {
  "/admin/sales": "view_sales",
  "/admin/products": "manage_products",
  "/admin/inventory": "manage_inventory",
  "/admin/customers": "manage_customers",
  "/admin/reports": "view_reports",
  "/admin/dashboard": "view_reports",
  "/admin/users": "manage_users",
  "/dashboard": "pos_billing",
};

type Product = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
  category?: string;
  sku?: string;
  visual?: string;
};

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  customer_type: string;
};

type CartItem = Product & { cartQuantity: number };

const categories = ["All Items", "Engine Oils", "Lubricants", "Filters", "Brake System", "Batteries", "Spark Plugs"];
const fallbackVisuals = ["🛢️", "🧴", "⚙️", "▤", "▰", "🔋", "♢", "◉"];

export default function PosBilling() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number, username: string, role: string, permissions: string[] } | null>(null);
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
  const [lastInvoice, setLastInvoice] = useState<{ id: number, date: string, items: CartItem[], total: number, tax: number, subtotal: number, customerName: string } | null>(null);

  useEffect(() => {
    // Auth Fetch
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then(data => {
        if (data.role !== 'admin' && !data.permissions.includes('pos_billing')) {
          router.push('/');
        } else {
          setUser(data);
          setLoadingAuth(false);
        }
      })
      .catch(() => {
        router.push('/');
      });

    // Fetch Products
    fetch("/api/products", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const live = (d as Product[]).map((p, i) => ({
            ...p,
            category: p.category || "Uncategorized",
            sku: p.sku || `SKU-${String(p.id).padStart(3, "0")}`,
            visual: fallbackVisuals[i % fallbackVisuals.length]
          }));
          setProducts(live);
        }
      })
      .catch(e => console.error("Error loading products", e));

    // Fetch Customers
    fetch("/api/customers", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setCustomers(d);
        }
      })
      .catch(e => console.error("Error loading customers", e));
  }, [router]);

  const shown = useMemo(() => {
    return products.filter(p => {
      const matchCategory = category === "All Items" || p.category === category;
      const matchQuery = !query || `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [products, category, query]);

  const subtotal = cart.reduce((s, x) => s + Number(x.price) * x.cartQuantity, 0);
  const tax = subtotal * 0.18; // 18% GST fixed for now
  const total = subtotal + tax;

  const add = (p: Product) => {
    if (p.stock_quantity <= 0) {
      alert("This item is out of stock!");
      return;
    }
    setCart(c => {
      const found = c.find(x => x.id === p.id);
      if (found) {
        return c.map(x => x.id === p.id 
          ? { ...x, cartQuantity: Math.min(x.cartQuantity + 1, p.stock_quantity) } 
          : x
        );
      }
      return [...c, { ...p, cartQuantity: 1 }];
    });
    setLastInvoice(null);
    setNotice("");
  };

  const qty = (id: number, n: number) => {
    setCart(c => c.map(x => x.id === id ? { ...x, cartQuantity: Math.max(1, Math.min(x.stock_quantity, n)) } : x));
  };

  const checkout = async () => {
    if (!cart.length) return;
    setChecking(true);
    setNotice("");
    try {
      const r = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashier_id: user?.id || 1,
          customer_id: customerId === "" ? null : customerId,
          payment_method: payment,
          items: cart.map(x => ({ product_id: x.id, quantity: x.cartQuantity }))
        })
      });
      const data = await r.json();
      
      if (r.ok) {
        setNotice("Sale completed successfully!");
        
        // Setup Invoice Print
        const selectedCustomer = customers.find(c => c.id === customerId);
        setLastInvoice({
          id: data.saleId,
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          items: [...cart],
          subtotal,
          tax,
          total,
          customerName: selectedCustomer ? selectedCustomer.name : "Walk-in Customer"
        });
        
        setCart([]);
        
        // Refresh products to show updated stock
        const pRes = await fetch("/api/products", { cache: "no-store" });
        const pData = await pRes.json();
        if (Array.isArray(pData)) {
          setProducts((pData as Product[]).map((p, i) => ({
            ...p,
            category: p.category || "Uncategorized",
            sku: p.sku || `SKU-${String(p.id).padStart(3, "0")}`,
            visual: fallbackVisuals[i % fallbackVisuals.length]
          })));
        }

      } else {
        setNotice(data.error || "Could not complete sale. Please check stock.");
      }
    } catch {
      setNotice("Unable to connect to sales service");
    } finally {
      setChecking(false);
    }
  };

  if (loadingAuth || !user) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading POS...</div>;
  }

  const navItems = [
    ["🛒", "POS Billing"], ["⌂", "Dashboard"], ["◇", "Products"], 
    ["▣", "Inventory"], ["♙", "Customers"], ["▤", "Sales"], 
    ["□", "Purchases"], ["▧", "Reports"], ["♙", "Users"], ["⚙", "Settings"]
  ];

  const filteredNav = navItems.filter(item => {
    if (user.role === 'admin') return true;
    if (item[1] === "Settings" || item[1] === "Purchases") return true;
    
    const href = item[1] === "POS Billing" ? "/dashboard" : "/admin/" + item[1].toLowerCase().replace(' ', '-');
    const req = PERMISSION_MAP[href];
    return !req || user.permissions.includes(req);
  });

  return (
    <div className="pos-shell">
      <aside className="pos-sidebar">
        <div className="pos-logo">
          <span>◒</span>
          <div>
            <b>OIL <em>MART</em> <i>POS</i></b>
            <small>Oil &amp; Spare Parts Store</small>
          </div>
        </div>
        <nav>
          {filteredNav.map(([i, l]) => (
            <button className={l === "POS Billing" ? "active" : ""} key={l} onClick={() => l !== "POS Billing" && router.push("/admin/" + l.toLowerCase().replace(' ', '-'))}>
              <span>{i}</span>{l}
            </button>
          ))}
        </nav>
        <div className="pos-side-bottom">
          <button>ⓘ　Help &amp; Support</button>
          <button onClick={() => { document.cookie = 'auth_token=; Max-Age=0; path=/'; router.push("/"); }}>↪　Logout</button>
        </div>
      </aside>

      <div className="pos-workspace">
        <header className="pos-topbar">
          <button className="pos-menu">☰</button>
          <h1>POS Billing <span>Cashier Mode</span></h1>
          <div className="pos-top-actions">
            <button>Shift #CSH-001　⌄</button>
            <button>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}　 <i /> Online</button>
            <div className="cashier">
              <span>{user.username.charAt(0).toUpperCase()}</span>
              <p><b>Cashier</b><small>{user.username}</small></p>⌄
            </div>
          </div>
        </header>

        <main className="pos-main">
          <section className="catalog">
            <div className="product-search">
              <span>⌕</span>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Scan Barcode / Search by SKU, Part No., Product Name..." />
              <button>▣</button>
            </div>
            
            <div className="category-tabs" style={{ overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {categories.map(c => (
                <button className={category === c ? "active" : ""} onClick={() => setCategory(c)} key={c}>
                  {c === "Engine Oils" && "♨　"}{c}
                </button>
              ))}
            </div>

            <div className="product-grid">
              {shown.map((p, i) => (
                <article key={p.id} onClick={() => add(p)} style={{ opacity: p.stock_quantity <= 0 ? 0.5 : 1 }}>
                  <button className="favorite">☆</button>
                  <div className={`product-visual pv${i % 6}`}>{p.visual || "🛢️"}</div>
                  <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</h3>
                  <small>Stock: {p.stock_quantity}</small>
                  <p>SKU: {p.sku}</p>
                  <strong>Rs. {Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </article>
              ))}
              {!shown.length && <div className="no-products">No matching products found.</div>}
            </div>

            <div className="catalog-pagination">
              <span>Showing 1 to {shown.length} of {products.length} items</span>
            </div>

            <div className="customer-bar">
              <div>
                <span>♙</span>
                <p>
                  <small>Customer</small>
                  <select value={customerId} onChange={e => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Walk-in Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                    ))}
                  </select>
                </p>
              </div>
              <button onClick={() => router.push('/admin/customers')}>＋　Manage Customers</button>
              <aside>
                <button className="clear" onClick={() => setCart([])}>♲　Clear Cart</button>
              </aside>
            </div>
          </section>

          <aside className="cart-pane">
            <div className="cart-title">
              <h2>Current Cart <small>({cart.length} Items)</small></h2>
            </div>
            
            <div className="cart-items">
              {cart.map(x => (
                <article key={x.id}>
                  <div className="cart-thumb">{x.visual || "🛢️"}</div>
                  <p>
                    <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</b>
                    <small>SKU: {x.sku}</small>
                  </p>
                  <button className="trash" onClick={() => setCart(c => c.filter(i => i.id !== x.id))}>♲</button>
                  <div className="quantity">
                    <button onClick={() => qty(x.id, x.cartQuantity - 1)}>−</button>
                    <span>{x.cartQuantity}</span>
                    <button onClick={() => qty(x.id, x.cartQuantity + 1)}>＋</button>
                  </div>
                  <strong>Rs. {(Number(x.price) * x.cartQuantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </article>
              ))}
              {!cart.length && <div className="empty-cart">Your cart is empty<br /><small>Select a product to begin</small></div>}
            </div>

            <div className="totals">
              <p>Subtotal ({cart.length} Items)<b>Rs. {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></p>
              <p>Tax (18% GST)<b>Rs. {tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></p>
              <h3>Total Payable <b>Rs. {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></h3>
            </div>

            <div className="payments">
              <h3>Payment Methods</h3>
              <div>
                {[["▣", "Cash"], ["▤", "Card"], ["◈", "UPI"]].map(([i, l]) => (
                  <button onClick={() => setPayment(l)} className={payment === l ? "active" : ""} key={l}>
                    <span>{i}</span>{l}
                  </button>
                ))}
              </div>
              <button className="complete-sale" onClick={checkout} disabled={!cart.length || checking}>
                ▣　{checking ? "Processing Sale..." : "Complete Sale"}
              </button>
              {notice && <p className="sale-notice" style={{ marginTop: '12px', fontSize: '13px', color: '#16a34a', background: '#dcfce7', padding: '8px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>{notice}</p>}
            </div>

            {lastInvoice && (
              <div className="invoice" style={{ marginTop: '20px', padding: '16px', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '16px', margin: 0 }}>INVOICE</h2>
                  <b style={{ fontSize: '14px' }}>#INV-{String(lastInvoice.id).padStart(6, '0')}</b>
                </header>
                <div className="invoice-brand" style={{ marginBottom: '16px', fontSize: '12px' }}>
                  <p>
                    <b style={{ fontSize: '14px', display: 'block' }}>Oil Mart</b>
                    <small>123, Industrial Area, New Delhi</small>
                  </p>
                  <aside style={{ textAlign: 'right', marginTop: '8px' }}>
                    Date: {lastInvoice.date}<br />
                    Cashier: {user.username}<br />
                    Customer: {lastInvoice.customerName}
                  </aside>
                </div>
                <table style={{ width: '100%', fontSize: '12px', marginBottom: '16px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ paddingBottom: '4px' }}>Item</th>
                      <th style={{ paddingBottom: '4px' }}>Qty</th>
                      <th style={{ paddingBottom: '4px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastInvoice.items.map(x => (
                      <tr key={x.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 0' }}>{x.name}</td>
                        <td style={{ padding: '6px 0' }}>{x.cartQuantity}</td>
                        <td style={{ padding: '6px 0', textAlign: 'right' }}>{(Number(x.price) * x.cartQuantity).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="invoice-total" style={{ fontSize: '13px', borderTop: '2px solid #e2e8f0', paddingTop: '8px' }}>
                  <p style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>Subtotal <b>Rs. {lastInvoice.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></p>
                  <p style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>Tax (18% GST) <b>Rs. {lastInvoice.tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></p>
                  <h3 style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0 0 0', fontSize: '16px' }}>Total <b>Rs. {lastInvoice.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b></h3>
                </div>
                <small className="thanks" style={{ display: 'block', textAlign: 'center', marginTop: '16px', color: '#64748b' }}>
                  Thank you for your visit!<br />Drive safe, Stay protected.
                </small>
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button onClick={() => window.print()} style={{ background: '#3b82f6', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🖨️ Print Invoice</button>
                </div>
              </div>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
