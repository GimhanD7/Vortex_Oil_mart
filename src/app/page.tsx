"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        // Role based routing
        if (data.user.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/dashboard");
        }
      } else {
        setError(data.error || "Failed to login");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-base)" }}>
      <div className="glass-panel animate-fade-in" style={{ padding: "2.5rem", width: "100%", maxWidth: "420px", textAlign: "center" }}>
        
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: "700", marginBottom: "0.5rem", color: "var(--text-primary)" }}>Oil Mart</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Sign in to manage your operations</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
          
          {error && (
            <div className="bg-danger-light text-danger" style={{ padding: "0.75rem", borderRadius: "var(--radius-all)", fontSize: "0.875rem", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label htmlFor="username" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: "500" }}>Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-base"
              placeholder="e.g. admin"
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <label htmlFor="password" style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: "500" }}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In"}
          </button>
          
        </form>
        
        <div style={{ marginTop: "2rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          <p>Demo Credentials: admin / admin123</p>
        </div>

      </div>
    </main>
  );
}
