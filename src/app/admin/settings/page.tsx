"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileUp, ReceiptText, RefreshCcw, Save, ShieldCheck, Store } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type ImportResult = {
  message?: string;
  error?: string;
  imported?: {
    products: number;
    customers: number;
    categories: number;
    brands: number;
    sales?: number;
    sale_items?: number;
    inventory_movements?: number;
    purchases?: number;
    purchase_items?: number;
  };
};

type Settings = {
  store_name: string;
  store_address: string;
  store_phone: string;
  gst_number: string;
  tax_rate: string;
  invoice_prefix: string;
  invoice_footer: string;
  invoice_logo_text: string;
  invoice_print_style: string;
  payment_methods: string[];
};

const defaultSettings: Settings = {
  store_name: "Oil Mart",
  store_address: "123, Industrial Area, New Delhi",
  store_phone: "",
  gst_number: "",
  tax_rate: "0",
  invoice_prefix: "INV",
  invoice_footer: "Thank you for your visit. Drive safe. Stay protected.",
  invoice_logo_text: "OM",
  invoice_print_style: "Dot Matrix",
  payment_methods: ["Cash", "Card", "Bank Transfer", "Credit"],
};

const paymentOptions = ["Cash", "Card", "Bank Transfer", "Credit"];

function normalizePaymentMethods(methods: string[]) {
  return Array.from(new Set(methods.map((method) => method === "UPI" ? "Bank Transfer" : method))).filter((method) => method !== "UPI");
}

function countPreview(payload: Record<string, unknown>) {
  const count = (key: string) => Array.isArray(payload[key]) ? (payload[key] as unknown[]).length : 0;
  return {
    products: count("products"),
    customers: count("customers"),
    categories: count("categories"),
    brands: count("brands"),
    sales: count("sales"),
    sale_items: count("sale_items"),
    inventory_movements: count("inventory_movements"),
    purchases: count("purchases"),
    purchase_items: count("purchase_items"),
  };
}

export default function SettingsPage() {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pendingImport, setPendingImport] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof countPreview> | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSettings({ ...defaultSettings, ...data, payment_methods: normalizePaymentMethods(Array.isArray(data.payment_methods) ? data.payment_methods : defaultSettings.payment_methods) }))
      .catch(() => showToast({ type: "error", title: "Settings failed", message: "Unable to load saved settings." }));
  }, [showToast]);

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const togglePayment = (method: string) => {
    setSettings((current) => {
      const exists = current.payment_methods.includes(method);
      return {
        ...current,
        payment_methods: exists
          ? current.payment_methods.filter((item) => item !== method)
          : [...current.payment_methods, method],
      };
    });
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const normalizedSettings = { ...settings, payment_methods: normalizePaymentMethods(settings.payment_methods) };
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedSettings),
    });
    const data = await response.json();
    setSaving(false);
    if (data.settings) setSettings({ ...normalizedSettings, ...data.settings, payment_methods: normalizePaymentMethods(data.settings.payment_methods || normalizedSettings.payment_methods) });
    showToast({
      type: response.ok ? "success" : "error",
      title: response.ok ? "Settings saved" : "Settings failed",
      message: data.message || data.error || "Settings saved.",
    });
  };

  const exportBackup = async () => {
    const response = await fetch("/api/settings/backup", { cache: "no-store" });
    const text = await response.text();
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `oil-mart-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: "success", title: "Backup exported", message: "Backup file download started." });
  };

  const chooseImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Record<string, unknown>;
      setPendingImport(payload);
      setPreview(countPreview(payload));
      showToast({ type: "info", title: "Backup selected", message: "Review the preview, then import." });
    } catch (error) {
      showToast({ type: "error", title: "Backup failed", message: error instanceof Error ? error.message : "Unable to read backup file." });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const importBackup = async () => {
    if (!pendingImport) return;
    setImporting(true);
    try {
      const response = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingImport),
      });
      const result = (await response.json()) as ImportResult;
      if (!response.ok) throw new Error(result.error || "Import failed");
      const imported = result.imported;
      showToast({
        type: "success",
        title: "Import completed",
        message:
        imported
          ? `${result.message}: ${imported.products} products, ${imported.customers} customers, ${imported.categories} categories, ${imported.brands} brands, ${imported.sales || 0} sales, ${imported.inventory_movements || 0} movements, ${imported.purchases || 0} purchases.`
          : result.message || "Import completed."
      });
      setPendingImport(null);
      setPreview(null);
    } catch (error) {
      showToast({ type: "error", title: "Import failed", message: error instanceof Error ? error.message : "Unable to import backup." });
    } finally {
      setImporting(false);
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

      <section className="settings-grid">
        <article className="settings-form-card">
          <span><Store size={24} aria-hidden="true" /></span>
          <h2>Store Profile</h2>
          <form onSubmit={saveSettings} className="settings-form">
            <label>Store Name<input value={settings.store_name} onChange={(event) => updateSetting("store_name", event.target.value)} /></label>
            <label>Store Address<textarea value={settings.store_address} onChange={(event) => updateSetting("store_address", event.target.value)} /></label>
            <label>Phone<input value={settings.store_phone} onChange={(event) => updateSetting("store_phone", event.target.value)} /></label>
            <button className="gold-btn" disabled={saving}><Save size={16} aria-hidden="true" /> {saving ? "Saving..." : "Save Store Settings"}</button>
          </form>
        </article>

        <article className="settings-form-card">
          <span><ReceiptText size={24} aria-hidden="true" /></span>
          <h2>Invoice &amp; Payment</h2>
          <form onSubmit={saveSettings} className="settings-form">
            <label>Invoice Prefix<input value={settings.invoice_prefix} onChange={(event) => updateSetting("invoice_prefix", event.target.value)} /></label>
            <label>Invoice Logo Text<input maxLength={8} value={settings.invoice_logo_text} onChange={(event) => updateSetting("invoice_logo_text", event.target.value.toUpperCase())} /></label>
            <label>Invoice Print Style<select value={settings.invoice_print_style} onChange={(event) => updateSetting("invoice_print_style", event.target.value)}><option>Dot Matrix</option><option>Standard</option></select></label>
            <label>Invoice Footer<textarea value={settings.invoice_footer} onChange={(event) => updateSetting("invoice_footer", event.target.value)} /></label>
            <div className="payment-checks">
              {paymentOptions.map((method) => (
                <label key={method}><input type="checkbox" checked={settings.payment_methods.includes(method)} onChange={() => togglePayment(method)} /> {method}</label>
              ))}
            </div>
            <button className="gold-btn" disabled={saving}><Save size={16} aria-hidden="true" /> {saving ? "Saving..." : "Save Invoice Settings"}</button>
          </form>
        </article>

        <article>
          <span><ShieldCheck size={24} aria-hidden="true" /></span>
          <h2>System Backup</h2>
          <p>Export products, customers, categories, brands, sales, movements, and purchases as a JSON backup.</p>
          <button className="gold-btn" onClick={exportBackup}><Download size={16} aria-hidden="true" /> Export Backup</button>
        </article>

        <article>
          <span><FileUp size={24} aria-hidden="true" /></span>
          <h2>Import Master Data</h2>
          <p>Choose an Oil Mart backup JSON, review the counts, then import it into the database.</p>
          <input ref={inputRef} type="file" accept="application/json,.json" onChange={(event) => chooseImportFile(event.target.files?.[0] || null)} />
          <button onClick={() => inputRef.current?.click()} disabled={importing}><FileUp size={16} aria-hidden="true" /> Choose Backup File</button>
          {preview && (
            <div className="import-preview">
              <b>Ready to import</b>
              <small>{preview.products} products / {preview.customers} customers / {preview.categories} categories / {preview.brands} brands / {preview.sales} sales / {preview.inventory_movements} movements / {preview.purchases} purchases</small>
              <button className="gold-btn" onClick={importBackup} disabled={importing}>{importing ? "Importing..." : "Import Backup"}</button>
            </div>
          )}
        </article>

        <article>
          <span><RefreshCcw size={24} aria-hidden="true" /></span>
          <h2>Recommended Setup</h2>
          <p>Run the database setup scripts after fresh installation so users, payment methods, purchase tables, and movement history exist.</p>
          <code>npm run db:start &amp;&amp; npm run db:setup &amp;&amp; npm run db:inventory</code>
        </article>
      </section>
    </div>
  );
}
