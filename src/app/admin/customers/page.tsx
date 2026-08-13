"use client";
import { useEffect, useMemo, useState, useCallback } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  company_notes: string | null;
  customer_type: string;
  status: 'Active' | 'Inactive';
  credit_limit: string;
  outstanding_balance: string;
  total_purchases: string;
  created_at: string;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  company_notes: string;
  customer_type: string;
  status: 'Active' | 'Inactive';
  credit_limit: string;
  outstanding_balance: string;
  total_purchases: string;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  company_notes: "",
  customer_type: "Regular Customer",
  status: "Active",
  credit_limit: "0",
  outstanding_balance: "0",
  total_purchases: "0",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [selected, setSelected] = useState<Customer | null>(null);
  
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        if (data.length > 0 && !selected) {
          setSelected(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    fetch("/api/customers", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomers(data);
          setSelected(data[0] || null);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    return customers.filter(c => {
      const matchQ = `${c.name} ${c.phone || ""} ${c.company_notes || ""}`.toLowerCase().includes(q.toLowerCase());
      const matchStatus = statusFilter === "All Status" || c.status === statusFilter;
      const matchType = typeFilter === "All Types" || c.customer_type === typeFilter;
      return matchQ && matchStatus && matchType;
    });
  }, [customers, q, statusFilter, typeFilter]);

  const openAdd = () => {
    setForm(emptyForm);
    setError("");
    setModal("add");
  };

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      company_notes: c.company_notes || "",
      customer_type: c.customer_type,
      status: c.status,
      credit_limit: c.credit_limit,
      outstanding_balance: c.outstanding_balance,
      total_purchases: c.total_purchases,
    });
    setError("");
    setModal("edit");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = modal === "edit" && selected ? "/api/customers/${selected.id}" : "/api/customers";
      const method = modal === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save customer");

      setModal(null);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async (c: Customer) => {
    if (!confirm(`Are you sure you want to delete ${c.name}?`)) return;
    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      if (selected?.id === c.id) setSelected(null);
      await loadCustomers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  // KPIs
  const totalReceivables = customers.reduce((sum, c) => sum + Number(c.outstanding_balance), 0);
  const thisMonthSales = customers.reduce((sum, c) => sum + Number(c.total_purchases), 0); // Simplified for KPI

  return (
    <div className="crm-page">
      <div className="crm-heading">
        <div>
          <h1>Customers</h1>
          <p>Manage your business relationships</p>
        </div>
      </div>
      <div className="crm-tabs">
        <button className="active">Customers</button>
      </div>
      <div className="crm-layout">
        <section>
          <div className="crm-tools">
            <label>
              ⌕
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, phone, company..." />
            </label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option>All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option>All Types</option>
              <option value="Regular Customer">Regular Customer</option>
              <option value="Workshop">Workshop</option>
              <option value="Fleet">Fleet</option>
            </select>
            <button onClick={loadCustomers}>↻ Refresh</button>
            <button className="gold-btn" onClick={openAdd}>＋ Add Customer</button>
          </div>

          <div className="crm-kpis">
            <article>
              <small>Total Customers</small>
              <b>{customers.length}</b>
              <em>Active and Inactive</em>
            </article>
            <article>
              <small>Outstanding Receivables</small>
              <b>Rs. {totalReceivables.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
              <em>From {customers.filter(c => Number(c.outstanding_balance) > 0).length} customers</em>
            </article>
            <article>
              <small>Total Customer Lifetime Sales</small>
              <b>Rs. {thisMonthSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>
              <em>Across all time</em>
            </article>
          </div>

          <div className="crm-table table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Company / Notes</th>
                  <th>Total Purchases</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>No customers found.</td></tr>}
                {rows.map((c) => (
                  <tr key={c.id} className={selected?.id === c.id ? "selected" : ""} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span>{c.name.substring(0, 2).toUpperCase()}</span>
                      <b>{c.name}</b>
                      <small>{c.customer_type}</small>
                    </td>
                    <td>{c.phone || "--"}</td>
                    <td>
                      <b>{c.company_notes || "--"}</b>
                      <small style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px', display: 'block' }}>{c.address || ""}</small>
                    </td>
                    <td>
                      <b>Rs. {Number(c.total_purchases).toLocaleString("en-IN")}</b>
                    </td>
                    <td className={Number(c.outstanding_balance) > 0 ? "danger" : ""}>
                      Rs. {Number(c.outstanding_balance).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <em className={c.status === "Inactive" ? "inactive" : ""}>{c.status}</em>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button title="Edit" onClick={() => { setSelected(c); openEdit(c); }}>✎</button>
                      <button title="Delete" style={{ color: '#ef4444' }} onClick={() => removeCustomer(c)}>♲</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer>
              Showing {rows.length === 0 ? 0 : 1} to {rows.length} of {customers.length} customers
            </footer>
          </div>
        </section>

        {selected && (
          <aside className="customer-detail">
            <header>
              <h2>Customer Details</h2>
              <button onClick={() => setSelected(null)}>×</button>
            </header>
            <div className="customer-person">
              <span>{selected.name.substring(0, 2).toUpperCase()}</span>
              <p>
                <b>{selected.name}</b>
                <em>{selected.customer_type}</em>
                <small>ID: CUS-{String(selected.id).padStart(6, '0')}</small>
              </p>
            </div>
            <div className="customer-actions">
              <button onClick={() => openEdit(selected)}>✎<small>Edit</small></button>
              <button onClick={() => window.open(`tel:${selected.phone}`, '_self')}>♢<small>Call</small></button>
              <button onClick={() => window.open(`https://wa.me/${selected.phone?.replace(/[^0-9]/g, '')}`, '_blank')}>◉<small>WhatsApp</small></button>
              <button style={{ color: '#ef4444' }} onClick={() => removeCustomer(selected)}>♲<small>Delete</small></button>
            </div>
            <nav>
              <button className="active">Overview</button>
            </nav>
            <dl>
              <div><dt>Phone</dt><dd>{selected.phone || "--"}</dd></div>
              <div><dt>Email</dt><dd>{selected.email || "--"}</dd></div>
              <div><dt>Address</dt><dd>{selected.address || "--"}</dd></div>
              <div><dt>Company / Notes</dt><dd>{selected.company_notes || "--"}</dd></div>
              <div><dt>Join Date</dt><dd>{new Date(selected.created_at).toLocaleDateString()}</dd></div>
              <div><dt>Customer Type</dt><dd>{selected.customer_type}</dd></div>
              <div><dt>Credit Limit</dt><dd>Rs. {Number(selected.credit_limit).toLocaleString("en-IN")}</dd></div>
              <div><dt>Current Balance</dt><dd className={Number(selected.outstanding_balance) > 0 ? 'danger' : ''}>Rs. {Number(selected.outstanding_balance).toLocaleString("en-IN")}</dd></div>
            </dl>
            <section>
              <h3>Purchase Summary</h3>
              <p>Total Purchases <b>Rs. {Number(selected.total_purchases).toLocaleString("en-IN")}</b></p>
            </section>
          </aside>
        )}
      </div>

      {modal && (
        <div className="management-modal">
          <form onSubmit={submit} style={{ maxWidth: '600px' }}>
            <header>
              <h2>{modal === 'add' ? 'Add Customer' : 'Edit Customer'}</h2>
              <button type="button" onClick={() => setModal(null)}>×</button>
            </header>
            
            {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label>
                Customer Name *
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Phone Number
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label>
                Email Address
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </label>
              <label>
                Customer Type
                <select value={form.customer_type} onChange={e => setForm({ ...form, customer_type: e.target.value })}>
                  <option value="Regular Customer">Regular Customer</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Fleet">Fleet</option>
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Address
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Company / Notes
                <input value={form.company_notes} onChange={e => setForm({ ...form, company_notes: e.target.value })} />
              </label>
              
              <label>
                Status
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as "Active" | "Inactive" })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
              <label>
                Credit Limit (Rs.)
                <input type="number" step="0.01" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: e.target.value })} />
              </label>

              {modal === 'edit' && (
                <>
                  <label>
                    Outstanding Balance (Rs.)
                    <input type="number" step="0.01" value={form.outstanding_balance} onChange={e => setForm({ ...form, outstanding_balance: e.target.value })} />
                  </label>
                  <label>
                    Total Purchases (Rs.)
                    <input type="number" step="0.01" value={form.total_purchases} onChange={e => setForm({ ...form, total_purchases: e.target.value })} />
                  </label>
                </>
              )}
            </div>

            <footer>
              <button type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className="gold-btn" disabled={saving}>
                {saving ? 'Saving...' : modal === 'add' ? 'Save Customer' : 'Update Customer'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
