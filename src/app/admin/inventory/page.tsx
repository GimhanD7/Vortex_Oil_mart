"use client";

import { useEffect, useState } from "react";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", description: "", price: "", stock_quantity: "" });

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

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          price: parseFloat(newProduct.price),
          stock_quantity: parseInt(newProduct.stock_quantity, 10)
        }),
      });
      setShowModal(false);
      setNewProduct({ name: "", description: "", price: "", stock_quantity: "" });
      fetchProducts();
    } catch (error) {
      console.error("Error adding product");
    }
  };

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Manage Inventory</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Add Product
        </button>
      </header>

      <div className="glass-panel" style={{ padding: "1.5rem" }}>
        {loading ? (
          <p>Loading inventory...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "1rem" }}>ID</th>
                <th style={{ padding: "1rem" }}>Product Name</th>
                <th style={{ padding: "1rem" }}>Price</th>
                <th style={{ padding: "1rem" }}>Stock</th>
                <th style={{ padding: "1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "1rem" }}>{product.id}</td>
                  <td style={{ padding: "1rem", fontWeight: "500", color: "var(--text-primary)" }}>{product.name}</td>
                  <td style={{ padding: "1rem" }}>${parseFloat(product.price as unknown as string).toFixed(2)}</td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ 
                      color: product.stock_quantity < 10 ? "#ef4444" : "#4ade80", 
                      backgroundColor: product.stock_quantity < 10 ? "rgba(239, 68, 68, 0.1)" : "rgba(74, 222, 128, 0.1)", 
                      padding: "0.25rem 0.5rem", borderRadius: "1rem", fontSize: "0.75rem" 
                    }}>
                      {product.stock_quantity} in stock
                    </span>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <button style={{ color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", marginRight: "1rem" }}>Edit</button>
                    <button style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No products found. Add one to get started!</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ padding: "2rem", width: "100%", maxWidth: "500px", backgroundColor: "var(--bg-surface)" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Add New Product</h2>
            <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input className="input-base" placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
              <textarea className="input-base" placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
              <div style={{ display: "flex", gap: "1rem" }}>
                <input className="input-base" type="number" step="0.01" placeholder="Price ($)" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
                <input className="input-base" type="number" placeholder="Initial Stock" value={newProduct.stock_quantity} onChange={e => setNewProduct({...newProduct, stock_quantity: e.target.value})} required />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" className="btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
