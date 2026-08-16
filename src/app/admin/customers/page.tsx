"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { cachedFetch } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { Edit3, Phone, RefreshCw, Search, Trash2, X } from "lucide-react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  company_notes: string | null;
  customer_type: string;
  status: 'Active' | 'Inactive';
  credit_limit?: string | number | null;
  outstanding_balance?: string | number | null;
  total_purchases?: string | number | null;
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

function numericText(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? String(value ?? "0") : "0";
}

function money(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return `Rs. ${Number.isFinite(number) ? number.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}`;
}

function numberValue(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function WhatsAppIcon({ size = 17 }: { size?: number }) {
  return (
    <svg className="whatsapp-svg-icon" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path fill="currentColor" d="M16.01 3.2c-7.03 0-12.75 5.64-12.75 12.58 0 2.21.59 4.37 1.7 6.27L3.2 28.8l6.92-1.78a12.93 12.93 0 0 0 5.89 1.43c7.03 0 12.75-5.64 12.75-12.58S23.04 3.2 16.01 3.2Zm0 22.99c-1.88 0-3.72-.5-5.32-1.45l-.38-.23-4.11 1.06 1.1-3.96-.25-.41a10.2 10.2 0 0 1-1.54-5.42c0-5.69 4.71-10.32 10.5-10.32s10.5 4.63 10.5 10.32-4.71 10.41-10.5 10.41Zm5.76-7.72c-.31-.16-1.85-.9-2.14-1-.29-.11-.5-.16-.71.16-.21.31-.81 1-.99 1.2-.18.21-.37.23-.68.08-.31-.16-1.32-.48-2.52-1.53-.93-.82-1.56-1.83-1.74-2.14-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.11-.21.05-.39-.03-.55-.08-.16-.71-1.69-.97-2.32-.26-.61-.52-.53-.71-.54h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.06-1.1 2.59s1.13 3.01 1.29 3.22c.16.21 2.23 3.36 5.41 4.71.76.32 1.35.51 1.81.66.76.24 1.45.21 2 .13.61-.09 1.85-.75 2.12-1.48.26-.73.26-1.35.18-1.48-.08-.13-.29-.21-.6-.36Z" />
    </svg>
  );
}

export default function CustomersPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [selected, setSelected] = useState<Customer | null>(null);
  
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cachedFetch("/api/customers", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        if (data.length > 0 && !selected) {
          setSelected(data[0]);
        }
      }
    } catch {
      showToast({ type: "error", title: "Customers failed", message: "Unable to load customers." });
    } finally {
      setLoading(false);
    }
  }, [selected, showToast]);

  useEffect(() => {
    cachedFetch("/api/customers", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setCustomers(data);
          setSelected(data[0] || null);
        }
      })
      .catch(() => showToast({ type: "error", title: "Customers failed", message: "Unable to load customers." }))
      .finally(() => setLoading(false));
  }, [showToast]);

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
      credit_limit: numericText(c.credit_limit),
      outstanding_balance: numericText(c.outstanding_balance),
      total_purchases: numericText(c.total_purchases),
    });
    setError("");
    setModal("edit");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = modal === "edit" && selected ? `/api/customers/${selected.id}` : "/api/customers";
      const method = modal === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          credit_limit: numericText(form.credit_limit),
          outstanding_balance: numericText(form.outstanding_balance),
          total_purchases: numericText(form.total_purchases),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save customer");

      setModal(null);
      await loadCustomers();
      showToast({ type: "success", title: modal === "edit" ? "Customer updated" : "Customer added", message: data.message || "Customer saved successfully." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      showToast({ type: "error", title: "Customer failed", message });
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (c: Customer) => {
    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      if (selected?.id === c.id) setSelected(null);
      await loadCustomers();
      showToast({ type: "success", title: "Customer deleted", message: "Customer removed successfully." });
    } catch (e) {
      showToast({ type: "error", title: "Delete failed", message: e instanceof Error ? e.message : "Failed to delete customer." });
    }
  };

  const removeCustomer = (c: Customer) => {
    showToast({
      type: "warning",
      title: "Delete customer?",
      message: `${c.name} will be removed if they are not linked to sales records.`,
      duration: 0,
      actionLabel: "Delete",
      onAction: () => void deleteCustomer(c),
    });
  };

  // KPIs
  const totalReceivables = customers.reduce((sum, c) => sum + numberValue(c.outstanding_balance), 0);
  const thisMonthSales = customers.reduce((sum, c) => sum + numberValue(c.total_purchases), 0); // Simplified for KPI

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
              <Search size={18} aria-hidden="true" />
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
            <button onClick={loadCustomers}><RefreshCw size={15} aria-hidden="true" /> Refresh</button>
            <button className="gold-btn" onClick={openAdd}>+ Add Customer</button>
          </div>

          <div className="crm-kpis">
            <article>
              <small>Total Customers</small>
              <b>{customers.length}</b>
              <em>Active and Inactive</em>
            </article>
            <article>
              <small>Outstanding Receivables</small>
              <b>{money(totalReceivables)}</b>
              <em>From {customers.filter(c => numberValue(c.outstanding_balance) > 0).length} customers</em>
            </article>
            <article>
              <small>Total Customer Lifetime Sales</small>
              <b>{money(thisMonthSales)}</b>
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
                      <b>{money(c.total_purchases)}</b>
                    </td>
                    <td className={numberValue(c.outstanding_balance) > 0 ? "danger" : ""}>
                      {money(c.outstanding_balance)}
                    </td>
                    <td>
                      <em className={c.status === "Inactive" ? "inactive" : ""}>{c.status}</em>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button title="Edit" aria-label="Edit customer" onClick={() => { setSelected(c); openEdit(c); }}><Edit3 size={15} aria-hidden="true" /></button>
                      <button title="Delete" aria-label="Delete customer" className="danger-icon" onClick={() => removeCustomer(c)}><Trash2 size={15} aria-hidden="true" /></button>
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
              <button aria-label="Close customer details" onClick={() => setSelected(null)}><X size={18} aria-hidden="true" /></button>
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
              <button onClick={() => openEdit(selected)}><Edit3 size={17} aria-hidden="true" /><small>Edit</small></button>
              <button onClick={() => window.open(`tel:${selected.phone}`, '_self')}><Phone size={17} aria-hidden="true" /><small>Call</small></button>
              <button onClick={() => window.open(`https://wa.me/${selected.phone?.replace(/[^0-9]/g, '')}`, '_blank')}><WhatsAppIcon /><small>WhatsApp</small></button>
              <button className="danger-action" onClick={() => removeCustomer(selected)}><Trash2 size={17} aria-hidden="true" /><small>Delete</small></button>
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
              <div><dt>Credit Limit</dt><dd>{money(selected.credit_limit)}</dd></div>
              <div><dt>Current Balance</dt><dd className={numberValue(selected.outstanding_balance) > 0 ? 'danger' : ''}>{money(selected.outstanding_balance)}</dd></div>
            </dl>
            <section>
              <h3>Purchase Summary</h3>
              <p>Total Purchases <b>{money(selected.total_purchases)}</b></p>
            </section>
          </aside>
        )}
      </div>

      {modal && (
        <div className="management-modal">
          <form onSubmit={submit} style={{ maxWidth: '600px' }}>
            <header>
              <h2>{modal === 'add' ? 'Add Customer' : 'Edit Customer'}</h2>
              <button type="button" aria-label="Close customer form" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
            </header>
            
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
              <button type="button" aria-label="Close customer form" onClick={() => setModal(null)}><X size={18} aria-hidden="true" /></button>
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
