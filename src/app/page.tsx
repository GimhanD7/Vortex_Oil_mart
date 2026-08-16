"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useToast } from "@/components/ToastProvider";

function Icon({ name }: { name: "user" | "lock" | "eye" | "arrow" | "cart" | "box" | "chart" | "shield" }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    eye: <><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9 5.5 9 5.5a16 16 0 0 1-2.1 2.7M6.6 6.6C4.4 8.1 3 10.5 3 10.5S6.5 16 12 16c1 0 1.9-.2 2.7-.4"/></>,
    arrow: <><path d="M5 12h13M14 7l5 5-5 5"/><path d="M19 5v14"/></>,
    cart: <><path d="M3 4h2l2.3 10.5h9.8l2-7H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></>,
    box: <><path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/></>,
    chart: <><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/></>,
    shield: <><path d="M12 2l8 4v6c0 5-3.3 8.3-8 10-4.7-1.7-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast({ type: "success", title: "Signed in", message: "Welcome back to Oil Mart POS." });
        router.push(data.user.role === "admin" ? "/admin/dashboard" : "/dashboard");
      } else {
        const message = data.error || "Failed to login";
        showToast({ type: "error", title: "Login failed", message });
      }
    } catch {
      const message = "An unexpected error occurred";
      showToast({ type: "error", title: "Login failed", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="dot-field" />
      <header className="login-brand" aria-label="Oil Mart POS">
        <div className="brand-drop"><span /></div>
        <div>
          <div className="brand-name"><strong>OIL</strong> <b>MART</b> <em>POS</em></div>
          <p>Oil &amp; Spare Parts Store</p>
        </div>
      </header>

      <section className="login-intro">
        <h1>Powering<br />Performance.<br /><span>Every Time.</span></h1>
        <i />
        <p>A complete POS solution for oil &amp; spare parts stores to manage sales, inventory, customers and more — all in one place.</p>
        <div className="feature-list">
          <div><span><Icon name="cart" /></span><p><b>Faster Billing</b><small>Quick checkout and seamless transactions</small></p></div>
          <div><span><Icon name="box" /></span><p><b>Smart Inventory</b><small>Real-time stock tracking and low stock alerts</small></p></div>
          <div><span><Icon name="chart" /></span><p><b>Insightful Reports</b><small>Track performance and grow your business</small></p></div>
        </div>
      </section>

      <section className="login-card">
        <div className="login-heading">
          <span className="shield-mark">★</span>
          <div><h2>Welcome Back</h2><p>Sign in to continue to Oil Mart POS</p></div>
        </div>
        <form onSubmit={handleLogin}>
          <label htmlFor="username">Username</label>
          <div className="login-input"><Icon name="user" /><input id="username" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" required /></div>
          <label htmlFor="password">Password</label>
          <div className="login-input"><Icon name="lock" /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /><button type="button" className="show-password" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}><Icon name="eye" /></button></div>
          <button className="login-submit" type="submit" disabled={loading}><Icon name="arrow" />{loading ? "Signing in..." : "Sign In"}</button>
        </form>
        <div className="secure-note"><Icon name="shield" /> Secure access to your business</div>
      </section>

      <section className="product-scene" aria-hidden="true">
        <div className="oil-swoosh" />
        <div className="oil-drop d1" /><div className="oil-drop d2" /><div className="oil-drop d3" />
        <div className="bottle gold"><span className="cap"/><span className="handle"/><strong>VORTEX<small>SYNTHETIC</small><b>5W-30</b></strong></div>
        <div className="bottle dark"><span className="cap"/><strong>ULTRA<small>ENGINE OIL</small><b>10W-40</b></strong></div>
        <div className="battery"><i/><strong>AMARON</strong><small>PRO</small></div>
        <div className="filter"><strong>OIL<br/>FILTER</strong></div>
        <div className="brake-disc"><i/></div>
      </section>

      <footer className="login-footer">
        <a
          className="designer-credit"
          href="https://www.facebook.com/profile.php?id=61590307577386"
          target="_blank"
          rel="noreferrer"
        >
          <small>Design By</small>
          <Image src="/vortex-mark.png" alt="" width={22} height={22} />
          <b>Vortex Digital Labs</b>
        </a>
        <p><Icon name="shield" /> &copy; 2026 Oil Mart POS. All rights reserved.</p>
        <p className="footer-values"><b aria-hidden="true" /> Secure <i aria-hidden="true" /> Reliable <i aria-hidden="true" /> Efficient</p>
      </footer>
    </main>
  );
}
