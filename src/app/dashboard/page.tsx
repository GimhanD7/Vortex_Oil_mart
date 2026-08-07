"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

type Product = {
  id: number;
  name: string;
  price: number;
  stock_quantity: number;
};

type CartItem = Product & { cartQuantity: number };

export default function UserDashboard() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.stock_quantity) return prev; // Cannot add more than stock
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const cartTotal = cart.reduce((total, item) => total + (Number(item.price) * item.cartQuantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      // Assuming logged in user ID is 2 for now, ideally we get this from a session/context
      const cashier_id = 2; 
      const items = cart.map(item => ({ product_id: item.id, quantity: item.cartQuantity }));
      
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashier_id, items })
      });

      if (res.ok) {
        alert("Sale processed successfully!");
        setCart([]);
        fetchProducts(); // Refresh stock
      } else {
        alert("Error processing sale");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-base)" }}>
      {/* Sidebar / POS Menu */}
      <aside style={{ width: "300px", backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)", padding: "1.5rem", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--accent-secondary)" }}>POS System</h2>
          <ThemeToggle />
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {products.map(product => (
            <div 
              key={product.id} 
              onClick={() => product.stock_quantity > 0 && addToCart(product)}
              className="glass-panel" 
              style={{ 
                padding: "1rem", 
                cursor: product.stock_quantity > 0 ? "pointer" : "not-allowed",
                opacity: product.stock_quantity > 0 ? 1 : 0.5,
                transition: "transform 0.1s",
                border: "1px solid var(--border-strong)"
              }}
              onMouseOver={(e) => product.stock_quantity > 0 && (e.currentTarget.style.transform = "scale(1.02)")}
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <h4 style={{ fontWeight: "bold", marginBottom: "0.25rem", color: "var(--text-primary)" }}>{product.name}</h4>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                <span>${parseFloat(product.price as unknown as string).toFixed(2)}</span>
                <span>Stock: {product.stock_quantity}</span>
              </div>
            </div>
          ))}
          {loading && <p>Loading products...</p>}
        </div>

        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)" }}>
           <button 
            onClick={() => router.push("/")}
            className="btn-primary" 
            style={{ width: "100%", backgroundColor: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", background: "none" }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content / Cart */}
      <main style={{ flex: 1, padding: "2rem", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-base)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Current Transaction</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Cashier</span>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--accent-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "#fff" }}>
              C
            </div>
          </div>
        </header>

        <div className="glass-panel" style={{ flex: 1, padding: "2rem", display: "flex", flexDirection: "column" }}>
          
          <div style={{ flex: 1, overflowY: "auto", borderBottom: "1px solid var(--border-strong)", marginBottom: "1.5rem" }}>
            {cart.length === 0 ? (
              <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                <h2>Select products to start transaction</h2>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: "bold", color: "var(--text-primary)" }}>{item.name}</td>
                      <td>{item.cartQuantity}</td>
                      <td>${parseFloat(item.price as unknown as string).toFixed(2)}</td>
                      <td>${(Number(item.price) * item.cartQuantity).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => removeFromCart(item.id)} className="text-danger" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: "1.25rem" }}>Total Amount:</p>
              <h2 className="text-success" style={{ fontSize: "3rem", fontWeight: "bold" }}>${cartTotal.toFixed(2)}</h2>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingOut}
              className="btn-primary" 
              style={{ 
                padding: "1.5rem 3rem", 
                fontSize: "1.5rem", 
                background: cart.length > 0 ? "linear-gradient(135deg, var(--accent-secondary), #db2777)" : "var(--bg-surface-elevated)",
                opacity: cart.length > 0 ? 1 : 0.5,
                cursor: cart.length > 0 ? "pointer" : "not-allowed",
                color: cart.length > 0 ? "#fff" : "var(--text-secondary)"
              }}>
                {checkingOut ? "Processing..." : "Checkout"}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
