"use client";

import { useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  role: string;
  created_at: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "cashier" });

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      setShowModal(false);
      setNewUser({ username: "", password: "", role: "cashier" });
      fetchUsers();
    } catch (error) {
      console.error("Error adding user");
    }
  };

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>User Management</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Add User
        </button>
      </header>

      <div className="glass-panel" style={{ padding: "1.5rem" }}>
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}>
                <th style={{ padding: "1rem" }}>ID</th>
                <th style={{ padding: "1rem" }}>Username</th>
                <th style={{ padding: "1rem" }}>Role</th>
                <th style={{ padding: "1rem" }}>Joined</th>
                <th style={{ padding: "1rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "1rem" }}>{user.id}</td>
                  <td style={{ padding: "1rem", fontWeight: "500", color: "var(--text-primary)" }}>{user.username}</td>
                  <td style={{ padding: "1rem" }}>
                    <span style={{ 
                      color: user.role === 'admin' ? "#a855f7" : "#38bdf8", 
                      backgroundColor: user.role === 'admin' ? "rgba(168, 85, 247, 0.1)" : "rgba(56, 189, 248, 0.1)", 
                      padding: "0.25rem 0.5rem", borderRadius: "1rem", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: "bold"
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: "1rem" }}>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "1rem" }}>
                    <button style={{ color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", marginRight: "1rem" }}>Edit</button>
                    <button style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ padding: "2rem", width: "100%", maxWidth: "400px", backgroundColor: "var(--bg-surface)" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Add New User</h2>
            <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input className="input-base" placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
              <input className="input-base" type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
              <select className="input-base" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{ appearance: "none", backgroundColor: "rgba(15, 23, 42, 0.5)" }}>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" className="btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
