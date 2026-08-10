"use client";

import { useRef, useState } from "react";
import { Download, FileUp, RefreshCcw, ShieldCheck } from "lucide-react";

type ImportResult = {
  message?: string;
  error?: string;
  imported?: {
    products: number;
    customers: number;
    categories: number;
    brands: number;
  };
};

export default function SettingsPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const exportBackup = async () => {
    const response = await fetch("/api/settings/backup", { cache: "no-store" });
    const text = await response.text();
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `oil-mart-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setMessage("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const response = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ImportResult;
      if (!response.ok) throw new Error(result.error || "Import failed");
      const imported = result.imported;
      setMessage(
        imported
          ? `${result.message}: ${imported.products} products, ${imported.customers} customers, ${imported.categories} categories, ${imported.brands} brands.`
          : result.message || "Import completed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import backup.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="management-page settings-page">
      <div className="management-heading">
        <div>
          <h1>Settings</h1>
          <p>Dashboard / Settings</p>
        </div>
      </div>

      {message && <div className="user-error">{message}<button onClick={() => setMessage("")}>×</button></div>}

      <section className="settings-grid">
        <article>
          <span><ShieldCheck size={24} aria-hidden="true" /></span>
          <h2>System Backup</h2>
          <p>Export products, customers, categories, brands, sales, movements, and purchases as a JSON backup.</p>
          <button className="gold-btn" onClick={exportBackup}><Download size={16} aria-hidden="true" /> Export Backup</button>
        </article>

        <article>
          <span><FileUp size={24} aria-hidden="true" /></span>
          <h2>Import Master Data</h2>
          <p>Import an Oil Mart backup JSON. Products, customers, categories, and brands will be restored into the database.</p>
          <input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0] || null)} />
          <button onClick={() => inputRef.current?.click()} disabled={importing}><FileUp size={16} aria-hidden="true" /> {importing ? "Importing..." : "Choose Backup File"}</button>
        </article>

        <article>
          <span><RefreshCcw size={24} aria-hidden="true" /></span>
          <h2>Recommended Setup</h2>
          <p>Run the database setup scripts after fresh installation so payment methods, purchase tables, and movement history exist.</p>
          <code>npm run db:inventory</code>
        </article>
      </section>
    </div>
  );
}
