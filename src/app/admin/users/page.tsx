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
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td style={{ fontWeight: "500", color: "var(--text-primary)" }}>{user.username}</td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'bg-secondary-light text-secondary-accent' : 'bg-primary-light text-primary-accent'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button style={{ color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", marginRight: "1rem" }}>Edit</button>
                    <button className="text-danger" style={{ background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="glass-panel animate-fade-in" style={{ padding: "2rem", width: "100%", maxWidth: "400px" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Add New User</h2>
            <form onSubmit={handleAddUser} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <input className="input-base" placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required />
              <input className="input-base" type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
              <select className="input-base" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} style={{ appearance: "none" }}>
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
