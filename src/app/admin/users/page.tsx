"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  username: string;
  role: "admin" | "cashier";
  permissions: string[];
  created_at: string;
};

type FormState = {
  username: string;
  password: string;
  role: "admin" | "cashier";
  permissions: string[];
};

const emptyForm: FormState = {
  username: "",
  password: "",
  role: "cashier",
  permissions: [],
};

const AVAILABLE_PERMISSIONS = [
  { id: 'view_sales', label: 'View Sales' },
  { id: 'manage_inventory', label: 'Manage Inventory' },
  { id: 'manage_products', label: 'Manage Products' },
  { id: 'manage_customers', label: 'Manage Customers' },
  { id: 'view_reports', label: 'View Reports' },
  { id: 'manage_users', label: 'Manage Users' },
  { id: 'pos_billing', label: 'POS Billing' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load users");
      
      const normalizedUsers = data.map((u: any) => {
        let perms = u.permissions;
        if (typeof perms === 'string') {
          try { perms = JSON.parse(perms); } catch (e) { perms = []; }
        }
        return { ...u, permissions: Array.isArray(perms) ? perms : [] };
      });
      
      setUsers(normalizedUsers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          (roleFilter === "all" || u.role === roleFilter) &&
          u.username.toLowerCase().includes(query.toLowerCase())
      ),
    [users, query, roleFilter]
  );

  const counts = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    cashiers: users.filter((u) => u.role === "cashier").length,
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setModal("add");
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, password: "", role: u.role, permissions: u.permissions || [] });
    setEditingId(u.id);
    setError("");
    setModal("edit");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = modal === "edit" ? `/api/users/${editingId}` : "/api/users";
      const res = await fetch(url, {
        method: modal === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save user");
      
      setModal(null);
      setForm(emptyForm);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save user");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: User) => {
    if (!confirm(`Delete user “${u.username}”?`)) return;
    setError("");
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete user");
      return;
    }
    setUsers((current) => current.filter((x) => x.id !== u.id));
  };

  return (
    <div className="user-admin-page management-page">
      <div className="management-heading">
        <div>
          <h1>User Management</h1>
          <p>Admin / Users / Database Accounts</p>
        </div>
        <aside>
          <button onClick={() => void loadUsers()}>↻ Refresh</button>
          <button className="gold-btn" onClick={openAdd}>
            ＋ Add User
          </button>
        </aside>
      </div>

      {error && (
        <div className="user-error" role="alert">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <section className="user-kpis">
        <article>
          <span>♙</span>
          <p>
            <small>Total Users</small>
            <b>{counts.total}</b>
            <em>Database accounts</em>
          </p>
        </article>
        <article>
          <span>★</span>
          <p>
            <small>Administrators</small>
            <b>{counts.admins}</b>
            <em>Full system access</em>
          </p>
        </article>
        <article>
          <span>▣</span>
          <p>
            <small>Cashiers</small>
            <b>{counts.cashiers}</b>
            <em>POS billing access</em>
          </p>
        </article>
        <article>
          <span>●</span>
          <p>
            <small>Database Status</small>
            <b>{loading ? "Connecting…" : "Connected"}</b>
            <em>MySQL / oil_mart</em>
          </p>
        </article>
      </section>

      <section className="user-access-summary">
        <div>
          <h2>Role Access</h2>
          <p>Roles are enforced by the database and login routing.</p>
        </div>
        <article>
          <span>★</span>
          <p>
            <b>Admin</b>
            <small>Dashboard, products, inventory, customers, sales and user administration.</small>
          </p>
          <em>{counts.admins} users</em>
        </article>
        <article>
          <span>▣</span>
          <p>
            <b>Cashier</b>
            <small>POS billing, cart management and sales processing.</small>
          </p>
          <em>{counts.cashiers} users</em>
        </article>
      </section>

      <section className="management-table user-table">
        <header>
          <h2>System Users</h2>
          <div className="user-filters">
            <label>
              ⌕
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search username..."
              />
            </label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
          <p>
            Showing {filtered.length} of {users.length} users
          </p>
        </header>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Loading users from database…</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="user-avatar">
                        {u.username.slice(0, 2).toUpperCase()}
                      </span>
                      <b>#{String(u.id).padStart(4, "0")}</b>
                    </td>
                    <td>
                      <b>{u.username}</b>
                    </td>
                    <td>
                      <em className={u.role === "admin" ? "admin-role" : ""}>{u.role}</em>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td><div style={{display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '200px'}}>{(Array.isArray(u.permissions) && u.permissions.length > 0) ? u.permissions.map(p => <span key={p} style={{background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', textTransform: 'capitalize'}}>{p.replace('_', ' ')}</span>) : <span style={{color: '#94a3b8', fontSize: '11px'}}>No special access</span>}</div></td>
                    <td>
                      <button onClick={() => openEdit(u)} title="Edit user">
                        ✎
                      </button>
                      <button className="delete" onClick={() => void remove(u)} title="Delete user">
                        ♲
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={6}>No users match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <div className="management-modal">
          <form onSubmit={submit}>
            <header>
              <h2>{modal === "add" ? "Add Database User" : "Edit Database User"}</h2>
              <button type="button" onClick={() => setModal(null)}>
                ×
              </button>
            </header>

            {error && <div className="user-error">{error}</div>}

            <label>
              Username
              <input
                required
                minLength={3}
                maxLength={255}
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>

            <label>
              {modal === "edit" ? "New Password (leave blank to keep current)" : "Password"}
              <input
                type="password"
                required={modal === "add"}
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as FormState["role"] })}
              >
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <div style={{ marginTop: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155' }}>Specific Permissions</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {AVAILABLE_PERMISSIONS.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'normal', margin: 0, padding: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={form.permissions.includes(p.id)} 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, permissions: [...form.permissions, p.id] });
                        } else {
                          setForm({ ...form, permissions: form.permissions.filter(x => x !== p.id) });
                        }
                      }}
                      style={{ margin: 0, width: 'auto' }}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <footer>
              <button type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="gold-btn" disabled={saving}>
                {saving
                  ? "Saving to database…"
                  : modal === "add"
                  ? "Create User"
                  : "Update User"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
