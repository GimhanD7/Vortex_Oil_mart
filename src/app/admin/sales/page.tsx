"use client";
import { useEffect, useState } from "react";
type Sale = {
  id: number;
  total_amount: string;
  created_at: string;
  cashier_name: string;
};
type SaleItem = {
  product_name: string;
  quantity: number;
  price_at_time: string;
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  
  // Column toggle state
  const [showCols, setShowCols] = useState(false);
  const [cols, setCols] = useState({ inv: true, date: true, cashier: true, cust: true, pay: true, items: true, total: true, status: true, actions: true });

  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setSales(d);
          if (d.length > 0) {
            setSelected(d[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selected) {
      setSaleItems([]);
      fetch(`/api/sales/${selected.id}`)
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            setSaleItems(d);
          }
        })
        .catch(()=>{});
    }
  }, [selected]);

  const total = sales.reduce((s, x) => s + Number(x.total_amount), 0);
  
  return (
    <div className="sales-history">
      <div className="sales-title">
        <h1>Sales History &amp; Invoice Management</h1>
        <p>Sales　›　Sales History &amp; Invoices</p>
      </div>
      <div className="sales-layout">
        <section>
          <div className="sales-filters">
            <h2>Filters</h2>
            <label>
              Date Range
              <input value="01 Aug 2026　–　07 Aug 2026" readOnly />
            </label>
            <label>
              Cashier
              <select>
                <option>All Cashiers</option>
              </select>
            </label>
            <label>
              Payment Method
              <select>
                <option>All Payment Methods</option>
              </select>
            </label>
            <label>
              Order Status
              <select>
                <option>All Status</option>
              </select>
            </label>
            <footer>
              <button>Reset Filters</button>
              <button className="gold-btn">Apply Filters</button>
            </footer>
          </div>
          <div className="sales-table">
            <header style={{ position: 'relative', zIndex: 10 }}>
              <div>
                <small>Total Invoices</small>
                <b>{sales.length}</b>
              </div>
              <div>
                <small>Total Sales</small>
                <b>
                  Rs.{" "}
                  {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </b>
              </div>
              <div>
                <small>Average Order Value</small>
                <b>
                  Rs.{" "}
                  {(total / Math.max(sales.length, 1)).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </b>
              </div>
              <aside style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                <button>⇩　Export⌄</button>
                <button onClick={() => setShowCols(!showCols)}>Columns⌄</button>
                {showCols && (
                  <div style={{ position: 'absolute', right: 0, top: '40px', background: '#fff', border: '1px solid #e2e4e7', padding: '12px', borderRadius: '8px', zIndex: 50, display: 'grid', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', textAlign: 'left', minWidth: '150px' }}>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.inv} onChange={(e) => setCols({...cols, inv: e.target.checked})} /> Invoice No.</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.date} onChange={(e) => setCols({...cols, date: e.target.checked})} /> Date &amp; Time</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.cashier} onChange={(e) => setCols({...cols, cashier: e.target.checked})} /> Cashier</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.cust} onChange={(e) => setCols({...cols, cust: e.target.checked})} /> Customer</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.pay} onChange={(e) => setCols({...cols, pay: e.target.checked})} /> Payment Method</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.items} onChange={(e) => setCols({...cols, items: e.target.checked})} /> Items</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.total} onChange={(e) => setCols({...cols, total: e.target.checked})} /> Total Amount</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.status} onChange={(e) => setCols({...cols, status: e.target.checked})} /> Status</label>
                    <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 'normal', whiteSpace: 'nowrap' }}><input type="checkbox" checked={cols.actions} onChange={(e) => setCols({...cols, actions: e.target.checked})} /> Actions</label>
                  </div>
                )}
              </aside>
            </header>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {cols.inv && <th>Invoice No.</th>}
                    {cols.date && <th>Date &amp; Time</th>}
                    {cols.cashier && <th>Cashier</th>}
                    {cols.cust && <th>Customer</th>}
                    {cols.pay && <th>Payment Method</th>}
                    {cols.items && <th>Items</th>}
                    {cols.total && <th>Total Amount</th>}
                    {cols.status && <th>Status</th>}
                    {cols.actions && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className={selected?.id === s.id ? "selected" : ""}
                    >
                      {cols.inv && <td>
                        <b>INV-{String(s.id).padStart(6, "0")}</b>
                      </td>}
                      {cols.date && <td>{new Date(s.created_at).toLocaleString()}</td>}
                      {cols.cashier && <td>{s.cashier_name || "Admin"}</td>}
                      {cols.cust && <td>{i % 2 ? "Rohan Verma" : "Walk-in Customer"}</td>}
                      {cols.pay && <td>{["Cash", "UPI", "Card"][i % 3]}</td>}
                      {cols.items && <td>--</td>}
                      {cols.total && <td>
                        Rs.{" "}
                        {Number(s.total_amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>}
                      {cols.status && <td>
                        <em
                          className={
                            i === 6 ? "refund" : i === 7 ? "cancel" : ""
                          }
                        >
                          {i === 6
                            ? "Refunded"
                            : i === 7
                              ? "Cancelled"
                              : "Completed"}
                        </em>
                      </td>}
                      {cols.actions && <td>
                        <button>⊙</button>
                        <button>▣</button>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              Showing {sales.length === 0 ? 0 : 1} to {sales.length} of {sales.length} invoices{" "}
              <p>
                <button>‹</button>
                <button className="active">1</button>
                <button>›</button>
              </p>
            </footer>
          </div>
        </section>
        
        {selected && (
          <aside className="invoice-preview">
            <header>
              <h2>Invoice Preview</h2>
              <button onClick={() => setSelected(null)}>×</button>
            </header>
            <div className="preview-paper">
              <div className="preview-brand">
                <span>◒</span>
                <h3>
                  OIL <b>MART</b>
                </h3>
                <p>
                  Oil &amp; Spare Parts Store
                  <br />
                  <br />
                  123, Industrial Area, New Delhi
                </p>
              </div>
              <dl>
                {[
                  ["Invoice No.", `INV-${String(selected.id).padStart(6, "0")}`],
                  ["Date", new Date(selected.created_at).toLocaleString()],
                  ["Cashier", selected.cashier_name || "Admin"],
                  ["Customer", "Walk-in Customer"],
                  ["Payment Method", "Cash"],
                ].map((x) => (
                  <div key={x[0]}>
                    <dt>{x[0]}</dt>
                    <dd>{x[1]}</dd>
                  </div>
                ))}
              </dl>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '10px' }}>Loading items...</td>
                    </tr>
                  )}
                  {saleItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.price_at_time).toLocaleString("en-IN")}</td>
                      <td>{(Number(item.price_at_time) * item.quantity).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="preview-total">
                <p>
                  Subtotal{" "}
                  <b>
                    Rs. {Number(selected.total_amount).toLocaleString("en-IN")}
                  </b>
                </p>
                <p>
                  Tax (18% GST){" "}
                  <b>
                    Rs.{" "}
                    {(Number(selected.total_amount) * 0.18).toLocaleString(
                      "en-IN",
                    )}
                  </b>
                </p>
                <h3>
                  Total{" "}
                  <b>
                    Rs.{" "}
                    {(Number(selected.total_amount) * 1.18).toLocaleString(
                      "en-IN",
                    )}
                  </b>
                </h3>
              </div>
              <div className="barcode">|||| ||| |||||| || ||||| ||||</div>
              <p className="thanks">
                Thank you for your visit!
                <br />
                Drive safe. Stay protected.
              </p>
            </div>
            <footer>
              <button>⊙　View Invoice</button>
              <button>▣　Print Invoice</button>
              <button className="danger">↻　Refund Invoice</button>
              <button>⇩　Export Invoice</button>
            </footer>
          </aside>
        )}
      </div>
    </div>
  );
}
