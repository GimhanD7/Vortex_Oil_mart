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
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td style={{ fontWeight: "500", color: "var(--text-primary)" }}>{product.name}</td>
                  <td>${parseFloat(product.price as unknown as string).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${product.stock_quantity < 10 ? 'bg-danger-light text-danger' : 'bg-success-light text-success'}`}>
                      {product.stock_quantity} in stock
                    </span>
                  </td>
                  <td>
                    <button style={{ color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", marginRight: "1rem" }}>Edit</button>
                    <button className="text-danger" style={{ background: "none", border: "none", cursor: "pointer" }}>Delete</button>
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
          <div className="glass-panel animate-fade-in" style={{ padding: "2rem", width: "100%", maxWidth: "500px" }}>
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
