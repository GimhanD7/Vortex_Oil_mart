"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, CalendarRange, Download, FileSpreadsheet, PackageCheck, Receipt, RefreshCcw, TrendingUp, Wallet } from "lucide-react";

type TimelineRow = { date?: string; month?: string; year?: number; total: string | number; orders: number };
type Summary = { invoices: string | number; subtotal: string | number; discounts: string | number; net_sales: string | number; items_sold: string | number; average_order: string | number; customers: string | number };
type PurchaseSummary = { purchases: string | number; total: string | number };
type SaleRow = { id: number; business_date?: string | null; created_at: string; subtotal_amount: string | number; discount_amount: string | number; total_amount: string | number; payment_method: string; status: string; cashier: string; customer: string; item_count: string | number };
type ProductRow = { name: string; sku: string | null; category: string | null; brand: string | null; unit: string | null; quantity: string | number; revenue: string | number; invoices: string | number };
type LineItemRow = { sale_id: number; created_at: string; cashier: string; customer: string; product: string; sku: string | null; unit: string | null; quantity: string | number; price_at_time: string | number; total: string | number };
type BreakdownRow = { brand?: string | null; category?: string | null; payment_method?: string; cashier?: string; total: string | number; items_sold?: string | number; orders?: string | number };
type PurchaseRow = { date: string; supplier: string; payment_method: string; purchases: string | number; total: string | number };
type MovementRow = { movement_type: string; transactions: string | number; quantity: string | number; value: string | number };
type RevocationRow = { created_at: string; sale_id: number | null; action_type: string; reason: string; affected_amount: string | number; cashier: string; approver: string };
type CreditCollectionRow = { payment_method: string; payments: string | number; total: string | number };
type ReceivableRow = { customer_id: number; customer: string; credit_limit: string | number; outstanding_balance: string | number; available_credit: string | number; account_status: string };

type SelectedReport = {
  period: "daily" | "monthly" | "yearly";
  date: string;
  month: string;
  year: string;
  label: string;
  summary: Summary;
  purchase_summary: PurchaseSummary;
  sales: SaleRow[];
  products: ProductRow[];
  line_items: LineItemRow[];
  brands: BreakdownRow[];
  categories: BreakdownRow[];
  staff: BreakdownRow[];
  payment_methods: BreakdownRow[];
  credit_collections: CreditCollectionRow[];
  receivables: ReceivableRow[];
  purchases: PurchaseRow[];
  inventory_movements: MovementRow[];
  revocations: RevocationRow[];
};

type ReportData = {
  daily: TimelineRow[];
  monthly: TimelineRow[];
  yearly: TimelineRow[];
  selected: SelectedReport;
};

const fallbackSummary: Summary = { invoices: 0, subtotal: 0, discounts: 0, net_sales: 0, items_sold: 0, average_order: 0, customers: 0 };
const fallbackSelected: SelectedReport = {
  period: "daily",
  date: "",
  month: "",
  year: "",
  label: "",
  summary: fallbackSummary,
  purchase_summary: { purchases: 0, total: 0 },
  sales: [],
  products: [],
  line_items: [],
  brands: [],
  categories: [],
  staff: [],
  payment_methods: [],
  credit_collections: [],
  receivables: [],
  purchases: [],
  inventory_movements: [],
  revocations: [],
};

function inputDateToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function money(value: string | number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function qty(value: string | number, unit = "") {
  const number = Number(value || 0);
  const formatted = Number.isInteger(number) ? number.toLocaleString("en-IN") : number.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function reportFileName(selected: SelectedReport, extension: "pdf" | "csv") {
  const key = selected.period === "daily" ? selected.date : selected.period === "monthly" ? selected.month : selected.year;
  return `oil-mart-${selected.period}-report-${key || inputDateToday()}.${extension}`;
}

function safeCell(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/,/g, " ");
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvSection(title: string, headers: string[], rows: unknown[][]) {
  return [``, title, headers.join(","), ...rows.map((row) => row.map(safeCell).join(","))].join("\n");
}

function reportCsv(selected: SelectedReport) {
  return [
    `Oil Mart ${selected.period.toUpperCase()} Report,${safeCell(selected.label)}`,
    csvSection("SUMMARY", ["Metric", "Value"], [
      ["Invoices", selected.summary.invoices],
      ["Items Sold", selected.summary.items_sold],
      ["Subtotal", selected.summary.subtotal],
      ["Discounts", selected.summary.discounts],
      ["Net Sales", selected.summary.net_sales],
      ["Average Order", selected.summary.average_order],
      ["Customers", selected.summary.customers],
      ["Purchases", selected.purchase_summary.purchases],
      ["Purchase Value", selected.purchase_summary.total],
    ]),
    csvSection("INVOICES", ["Invoice", "Date", "Cashier", "Customer", "Payment", "Items", "Subtotal", "Discount", "Total"], selected.sales.map((row) => [
      `INV-${String(row.id).padStart(6, "0")}`, row.created_at, row.cashier, row.customer, row.payment_method, row.item_count, row.subtotal_amount, row.discount_amount, row.total_amount,
    ])),
    csvSection("PRODUCTS SOLD", ["Product", "SKU", "Category", "Brand", "Qty", "Revenue", "Invoices"], selected.products.map((row) => [
      row.name, row.sku, row.category, row.brand, `${row.quantity} ${row.unit || ""}`, row.revenue, row.invoices,
    ])),
    csvSection("PAYMENT METHODS", ["Method", "Orders", "Total"], selected.payment_methods.map((row) => [row.payment_method, row.orders, row.total])),
    csvSection("CATEGORIES", ["Category", "Items Sold", "Total"], selected.categories.map((row) => [row.category, row.items_sold, row.total])),
    csvSection("BRANDS", ["Brand", "Items Sold", "Total"], selected.brands.map((row) => [row.brand, row.items_sold, row.total])),
    csvSection("STAFF", ["Cashier", "Orders", "Total"], selected.staff.map((row) => [row.cashier, row.orders, row.total])),
    csvSection("PURCHASES", ["Date", "Supplier", "Payment", "Entries", "Total"], selected.purchases.map((row) => [row.date, row.supplier, row.payment_method, row.purchases, row.total])),
    csvSection("INVENTORY MOVEMENTS", ["Type", "Transactions", "Quantity", "Value"], selected.inventory_movements.map((row) => [row.movement_type, row.transactions, row.quantity, row.value])),
    csvSection("REVOCATION LOGS", ["Date", "Invoice", "Action", "Reason", "Cashier", "Approver", "Amount"], selected.revocations.map((row) => [row.created_at, row.sale_id, row.action_type, row.reason, row.cashier, row.approver, row.affected_amount])),
  ].join("\n");
}

function pdfEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

type PdfColumn = { label: string; width: number; align?: "left" | "center" | "right" };

function cleanPdfText(value: unknown) {
  return String(value ?? "-").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

function wrapPdfText(value: unknown, width: number, size = 8) {
  const text = cleanPdfText(value);
  const max = Math.max(8, Math.floor(width / (size * 0.52)));
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max) {
      if (line) lines.push(line);
      line = word.length > max ? word.slice(0, max - 1) : word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function buildStructuredPdf(selected: SelectedReport) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 34;
  const bottom = 42;
  const contentWidth = pageWidth - margin * 2;
  const pages: string[][] = [];
  let page: string[] = [];
  let y = 0;

  const add = (command: string) => page.push(command);
  const color = (hex: string) => {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
  };
  const text = (value: unknown, x: number, baseline: number, size = 9, bold = false, fill = "#111827") => {
    add(`${color(fill)} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${baseline.toFixed(1)} Td (${pdfEscape(cleanPdfText(value))}) Tj ET`);
  };
  const rect = (x: number, top: number, width: number, height: number, fill?: string, stroke = "#E5E7EB") => {
    if (fill) add(`${color(fill)} rg ${x.toFixed(1)} ${(top - height).toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re f`);
    add(`${color(stroke)} RG 0.6 w ${x.toFixed(1)} ${(top - height).toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)} re S`);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = "#E5E7EB") => {
    add(`${color(stroke)} RG 0.6 w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  };
  const newPage = () => {
    page = [];
    pages.push(page);
    y = pageHeight - 34;
    text("OIL MART POS", margin, y, 12, true);
    text(`${selected.period.toUpperCase()} REPORT`, pageWidth - margin - 125, y, 10, true, "#F0A800");
    y -= 16;
    line(margin, y, pageWidth - margin, y);
    y -= 18;
  };
  const ensure = (height: number) => {
    if (y - height < bottom) newPage();
  };
  const section = (title: string) => {
    ensure(34);
    y -= 6;
    text(title.toUpperCase(), margin, y, 11, true);
    y -= 8;
    line(margin, y, pageWidth - margin, y, "#FFBD00");
    y -= 10;
  };
  const summaryBox = (label: string, value: string, note: string, index: number) => {
    const cols = 3;
    const gap = 10;
    const width = (contentWidth - gap * (cols - 1)) / cols;
    const x = margin + (index % cols) * (width + gap);
    if (index % cols === 0) ensure(72);
    const top = y;
    rect(x, top, width, 58, index % 2 === 0 ? "#FFF9E8" : "#F8FAFC", "#E5E7EB");
    text(label, x + 10, top - 17, 8, false, "#667085");
    text(value, x + 10, top - 34, 12, true);
    text(note, x + 10, top - 49, 8, false, "#667085");
    if (index % cols === cols - 1) y -= 70;
  };
  const table = (title: string, columns: PdfColumn[], rows: unknown[][], maxRows = 120) => {
    section(title);
    const headerHeight = 20;
    const startX = margin;
    const visibleRows = rows.slice(0, maxRows);
    const safeRows = visibleRows.length ? visibleRows : [[`No ${title.toLowerCase()} found.`]];
    const drawHeader = () => {
      ensure(headerHeight + 16);
      rect(startX, y, contentWidth, headerHeight, "#F8FAFC", "#DDE3EA");
      let x = startX;
      columns.forEach((column) => {
        const headerWidth = column.label.length * 3.9;
        const headerX = column.align === "right"
          ? x + column.width - 5 - headerWidth
          : column.align === "center"
            ? x + (column.width - headerWidth) / 2
            : x + 4;
        text(column.label, headerX, y - 13, 7, true, "#344054");
        x += column.width;
      });
      y -= headerHeight;
    };
    drawHeader();
    safeRows.forEach((row) => {
      const cells = columns.map((column, index) => wrapPdfText((row as unknown[])[index], column.width - 8, 7));
      const rowHeight = Math.max(18, Math.max(...cells.map((cell) => cell.length)) * 9 + 8);
      if (y - rowHeight < bottom) {
        newPage();
        drawHeader();
      }
      rect(startX, y, contentWidth, rowHeight, undefined, "#EEF0F3");
      let x = startX;
      cells.forEach((cellLines, cellIndex) => {
          const column = columns[cellIndex];
          cellLines.slice(0, 4).forEach((cellLine, lineIndex) => {
            const baseline = y - 11 - lineIndex * 8.5;
            const textWidth = cellLine.length * 3.7;
            const tx = column.align === "right"
              ? x + column.width - 5 - textWidth
              : column.align === "center"
                ? x + (column.width - textWidth) / 2
                : x + 4;
            text(cellLine, tx, baseline, 7, false, "#344054");
          });
        x += column.width;
      });
      y -= rowHeight;
    });
    if (rows.length > maxRows) {
      ensure(18);
      text(`Showing first ${maxRows} rows. Download CSV for the full data set.`, margin, y - 8, 8, false, "#667085");
      y -= 18;
    }
    y -= 8;
  };

  newPage();
  text("Oil Mart POS Report", margin, y, 20, true);
  y -= 22;
  text(`Period: ${selected.label}`, margin, y, 11, true);
  text(`Generated: ${new Date().toLocaleString()}`, margin + 260, y, 9, false, "#667085");
  y -= 20;

  section("Executive Summary");
  [
    ["Net Sales", money(selected.summary.net_sales), `${selected.summary.invoices} invoices`],
    ["Items Sold", qty(selected.summary.items_sold), "Product quantity"],
    ["Average Order", money(selected.summary.average_order), "Per invoice"],
    ["Discounts", money(selected.summary.discounts), "Total discount"],
    ["Customers", qty(selected.summary.customers), "Unique customers"],
    ["Purchase Value", money(selected.purchase_summary.total), `${selected.purchase_summary.purchases} purchase entries`],
  ].forEach(([label, value, note], index) => summaryBox(label, value, note, index));
  if (6 % 3 !== 0) y -= 70;

  table("Invoice Details", [
    { label: "Invoice", width: 58, align: "center" },
    { label: "Date", width: 74 },
    { label: "Cashier", width: 58, align: "center" },
    { label: "Customer", width: 86 },
    { label: "Payment", width: 54, align: "center" },
    { label: "Items", width: 42, align: "center" },
    { label: "Discount", width: 66, align: "right" },
    { label: "Total", width: 92, align: "right" },
  ], selected.sales.map((row) => [
    `INV-${String(row.id).padStart(6, "0")}`,
    new Date(row.created_at).toLocaleString(),
    row.cashier,
    row.customer,
    row.payment_method,
    qty(row.item_count),
    money(row.discount_amount),
    money(row.total_amount),
  ]), 160);

  table("Products Sold", [
    { label: "Product", width: 150 },
    { label: "SKU", width: 75, align: "center" },
    { label: "Category", width: 82, align: "center" },
    { label: "Brand", width: 78, align: "center" },
    { label: "Qty", width: 50, align: "center" },
    { label: "Invoices", width: 50, align: "center" },
    { label: "Revenue", width: 45, align: "right" },
  ], selected.products.map((row) => [row.name, row.sku || "-", row.category || "-", row.brand || "-", qty(row.quantity, row.unit || ""), row.invoices, money(row.revenue)]), 160);

  table("Payment Methods", [
    { label: "Method", width: 170 },
    { label: "Orders", width: 100, align: "center" },
    { label: "Total", width: 260, align: "right" },
  ], selected.payment_methods.map((row) => [row.payment_method || "Cash", row.orders || 0, money(row.total)]));

  table("Category Breakdown", [
    { label: "Category", width: 210 },
    { label: "Items Sold", width: 110, align: "center" },
    { label: "Total", width: 210, align: "right" },
  ], selected.categories.map((row) => [row.category || "Other", qty(row.items_sold || 0), money(row.total)]));

  table("Brand Breakdown", [
    { label: "Brand", width: 210 },
    { label: "Items Sold", width: 110, align: "center" },
    { label: "Total", width: 210, align: "right" },
  ], selected.brands.map((row) => [row.brand || "Other", qty(row.items_sold || 0), money(row.total)]));

  table("Staff Performance", [
    { label: "Cashier", width: 220 },
    { label: "Orders", width: 110, align: "center" },
    { label: "Total", width: 200, align: "right" },
  ], selected.staff.map((row) => [row.cashier || "Unknown", row.orders || 0, money(row.total)]));

  table("Purchases", [
    { label: "Date", width: 76, align: "center" },
    { label: "Supplier", width: 170 },
    { label: "Payment", width: 82, align: "center" },
    { label: "Entries", width: 72, align: "center" },
    { label: "Total", width: 130, align: "right" },
  ], selected.purchases.map((row) => [row.date, row.supplier || "-", row.payment_method || "-", row.purchases, money(row.total)]));

  table("Inventory Movements", [
    { label: "Type", width: 160 },
    { label: "Transactions", width: 110, align: "center" },
    { label: "Quantity", width: 120, align: "center" },
    { label: "Value", width: 140, align: "right" },
  ], selected.inventory_movements.map((row) => [row.movement_type, row.transactions, qty(row.quantity), money(row.value)]));

  table("Void / Refund / Revocation Logs", [
    { label: "Date", width: 90 },
    { label: "Invoice", width: 70, align: "center" },
    { label: "Action", width: 105, align: "center" },
    { label: "Reason", width: 130 },
    { label: "Cashier", width: 65, align: "center" },
    { label: "Amount", width: 70, align: "right" },
  ], selected.revocations.map((row) => [
    new Date(row.created_at).toLocaleString(),
    row.sale_id ? `INV-${String(row.sale_id).padStart(6, "0")}` : "Draft",
    row.action_type,
    row.reason,
    row.cashier,
    money(row.affected_amount),
  ]), 120);

  const objects: string[] = [];

  objects[0] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[3] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  pages.forEach((page, index) => {
    const pageId = 5 + index * 2;
    const contentId = 6 + index * 2;
    const footer = `${color("#667085")} rg BT /F1 8 Tf ${margin.toFixed(1)} 24 Td (Oil Mart POS) Tj ET BT /F1 8 Tf ${(pageWidth - margin - 70).toFixed(1)} 24 Td (Page ${index + 1} of ${pages.length}) Tj ET`;
    const stream = `${page.join("\n")}\n${footer}`;
    objects[pageId - 1] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`;
    objects[contentId - 1] = `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
  });

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.filter(Boolean).forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefStart = pdf.length;
  const objectCount = objects.filter(Boolean).length;
  pdf += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function SalesTimelineChart({ rows }: { rows: TimelineRow[]; period: string }) {
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontWeight: 500 }}>
        No timeline data available for this period.
      </div>
    );
  }

  const totals = rows.map((r) => Number(r.total || 0));
  const maxVal = Math.max(1, ...totals);
  const count = rows.length;

  const svgWidth = 820;
  const svgHeight = 220;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const points = rows.map((row, i) => {
    const val = Number(row.total || 0);
    const x = count === 1 ? padLeft + chartW / 2 : padLeft + (i / (count - 1)) * chartW;
    const y = padTop + chartH - (val / maxVal) * chartH;
    const label = String(row.date || row.month || row.year || "");
    return { x, y, val, label, orders: row.orders || 0 };
  });

  let pathD = "";
  let areaD = "";

  if (points.length === 1) {
    const p = points[0];
    pathD = `M ${padLeft} ${p.y} L ${svgWidth - padRight} ${p.y}`;
    areaD = `M ${padLeft} ${p.y} L ${svgWidth - padRight} ${p.y} L ${svgWidth - padRight} ${padTop + chartH} L ${padLeft} ${padTop + chartH} Z`;
  } else {
    pathD = points.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (p.x - prev.x) / 3;
      const cy1 = prev.y;
      const cx2 = prev.x + (2 * (p.x - prev.x)) / 3;
      const cy2 = p.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
    }, "");

    const first = points[0];
    const last = points[points.length - 1];
    areaD = `${pathD} L ${last.x} ${padTop + chartH} L ${first.x} ${padTop + chartH} Z`;
  }

  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = maxVal * pct;
    const y = padTop + chartH - pct * chartH;
    return { val, y };
  });

  const peakPoint = [...points].sort((a, b) => b.val - a.val)[0];
  const totalPeriodSales = totals.reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: "#fafbfc", padding: "12px 18px", borderRadius: 12, border: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Period Total</span>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{money(totalPeriodSales)}</div>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Peak Period</span>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#e7a700" }}>{money(peakPoint?.val || 0)} <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>({peakPoint?.label})</span></div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", color: "#a16207", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "1px solid #fde68a" }}>
          <TrendingUp size={14} /> Line &amp; Area Chart
        </div>
      </div>

      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: "100%", height: "auto", minWidth: 600, overflow: "visible" }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffbd00" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffbd00" stopOpacity="0.02" />
            </linearGradient>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#ffbd00" floodOpacity="0.3" />
            </filter>
          </defs>

          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={svgWidth - padRight}
                y2={tick.y}
                stroke="#f1f5f9"
                strokeWidth="1.5"
                strokeDasharray={i === 0 || i === yTicks.length - 1 ? "none" : "4,4"}
              />
              <text
                x={padLeft - 10}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10"
                fontWeight="600"
                fill="#94a3b8"
              >
                {tick.val >= 1000 ? `Rs. ${(tick.val / 1000).toFixed(1)}k` : `Rs. ${Math.round(tick.val)}`}
              </text>
            </g>
          ))}

          <path d={areaD} fill="url(#salesGradient)" />
          <path d={pathD} fill="none" stroke="#f0ab00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)" />

          {points.map((p, i) => {
            const isHovered = activeHoverIndex === i;
            return (
              <g key={i} onMouseEnter={() => setActiveHoverIndex(i)} onMouseLeave={() => setActiveHoverIndex(null)} style={{ cursor: "pointer" }}>
                {isHovered && <circle cx={p.x} cy={p.y} r="10" fill="#fffbeb" stroke="#f0ab00" strokeWidth="2" opacity="0.8" />}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? "6" : "4.5"}
                  fill="#ffffff"
                  stroke="#f0ab00"
                  strokeWidth="2.5"
                  style={{ transition: "all 0.15s ease" }}
                />
                <text
                  x={p.x}
                  y={padTop + chartH + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? "800" : "600"}
                  fill={isHovered ? "#111827" : "#64748b"}
                >
                  {p.label}
                </text>
                {(isHovered || points.length <= 6) && (
                  <g transform={`translate(${p.x}, ${p.y - 12})`}>
                    <rect x="-50" y="-28" width="100" height="24" rx="6" fill="#111827" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.2))" />
                    <text x="0" y="-13" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
                      {money(p.val)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function TablePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-panel">
      <header><h2>{title}</h2></header>
      <div className="table-scroll">{children}</div>
    </section>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("daily");
  const [date, setDate] = useState(inputDateToday);
  const [month, setMonth] = useState(inputDateToday().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ period, date, month, year });
    setLoading(true);
    fetch(`/api/reports?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((next) => setData(next))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [date, month, period, year]);

  const selected = data?.selected || fallbackSelected;
  const timeline = useMemo(() => {
    const rows = period === "daily" ? data?.daily || [] : period === "monthly" ? data?.monthly || [] : data?.yearly || [];
    const max = Math.max(1, ...rows.map((row) => Number(row.total || 0)));
    return { rows, max };
  }, [data, period]);

  const summaryCards = [
    { label: "Net Sales", value: money(selected.summary.net_sales), note: `${selected.summary.invoices} invoices`, Icon: Wallet, tone: "green" },
    { label: "Items Sold", value: qty(selected.summary.items_sold), note: "product quantity", Icon: PackageCheck, tone: "purple" },
    { label: "Average Order", value: money(selected.summary.average_order), note: "per invoice", Icon: TrendingUp, tone: "blue" },
    { label: "Discounts", value: money(selected.summary.discounts), note: "total discount", Icon: Receipt, tone: "orange" },
    { label: "Purchase Value", value: money(selected.purchase_summary.total), note: `${selected.purchase_summary.purchases} purchase entries`, Icon: BarChart3, tone: "red" },
  ];

  const downloadCsv = () => {
    downloadBlob(reportFileName(selected, "csv"), new Blob([reportCsv(selected)], { type: "text/csv;charset=utf-8" }));
  };

  const downloadPdf = () => {
    downloadBlob(reportFileName(selected, "pdf"), buildStructuredPdf(selected));
  };

  return (
    <div className="reports-page">
      <div className="management-heading">
        <div>
          <h1>Reports</h1>
          <p>Dashboard / Reports / {selected.label || "Selected Period"}</p>
        </div>
        <aside>
          <button onClick={downloadCsv} disabled={loading}><FileSpreadsheet size={15} aria-hidden="true" /> Download CSV</button>
          <button className="gold-btn" onClick={downloadPdf} disabled={loading}><Download size={15} aria-hidden="true" /> Download PDF</button>
        </aside>
      </div>

      <section className="report-control-panel">
        <div>
          <h2>Report Type</h2>
          <p>Choose daily, monthly, or yearly report. Downloads include all visible detail sections.</p>
        </div>
        <nav>
          <button className={period === "daily" ? "active" : ""} onClick={() => setPeriod("daily")}><CalendarDays size={16} aria-hidden="true" /> Daily</button>
          <button className={period === "monthly" ? "active" : ""} onClick={() => setPeriod("monthly")}><CalendarRange size={16} aria-hidden="true" /> Monthly</button>
          <button className={period === "yearly" ? "active" : ""} onClick={() => setPeriod("yearly")}><BarChart3 size={16} aria-hidden="true" /> Yearly</button>
        </nav>
        <label className={period === "daily" ? "" : "hidden"}>
          Date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className={period === "monthly" ? "" : "hidden"}>
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className={period === "yearly" ? "" : "hidden"}>
          Year
          <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
        </label>
        <button onClick={() => { setDate(inputDateToday()); setMonth(inputDateToday().slice(0, 7)); setYear(String(new Date().getFullYear())); }}><RefreshCcw size={15} aria-hidden="true" /> Current Period</button>
      </section>

      {loading ? (
        <section className="report-empty">Loading report...</section>
      ) : !data ? (
        <section className="report-empty error">Unable to load report data.</section>
      ) : (
        <>
          <section className="report-kpis">
            {summaryCards.map(({ label, value, note, Icon, tone }) => (
              <article key={label}>
                <span className={tone}><Icon size={21} aria-hidden="true" /></span>
                <p><small>{label}</small><b>{value}</b><em>{note}</em></p>
              </article>
            ))}
          </section>

          <section className="report-panel report-timeline-panel">
            <header>
              <h2>{period.charAt(0).toUpperCase() + period.slice(1)} Sales Timeline</h2>
              <small>{timeline.rows.length} periods</small>
            </header>
            <SalesTimelineChart rows={timeline.rows} period={period} />
          </section>

          <section className="report-breakdown-grid">
            <TablePanel title="Credit Collections">
              <table><thead><tr><th>Method</th><th>Payments</th><th>Collected</th></tr></thead><tbody>
                {selected.credit_collections.map((row) => <tr key={row.payment_method}><td>{row.payment_method}</td><td>{row.payments}</td><td>{money(row.total)}</td></tr>)}
                {!selected.credit_collections.length && <tr><td colSpan={3}>No credit collections for this period.</td></tr>}
              </tbody></table>
            </TablePanel>
            <TablePanel title="Customer Receivables">
              <table><thead><tr><th>Customer</th><th>Limit</th><th>Outstanding</th><th>Available</th><th>Status</th></tr></thead><tbody>
                {selected.receivables.map((row) => <tr key={row.customer_id}><td>{row.customer}</td><td>{money(row.credit_limit)}</td><td>{money(row.outstanding_balance)}</td><td>{money(row.available_credit)}</td><td>{row.account_status}</td></tr>)}
                {!selected.receivables.length && <tr><td colSpan={5}>No customer credit accounts.</td></tr>}
              </tbody></table>
            </TablePanel>
            <TablePanel title="Payment Methods">
              <table><thead><tr><th>Method</th><th>Orders</th><th>Total</th></tr></thead><tbody>
                {selected.payment_methods.map((row) => <tr key={row.payment_method}><td>{row.payment_method}</td><td>{row.orders}</td><td>{money(row.total)}</td></tr>)}
              </tbody></table>
            </TablePanel>
            <TablePanel title="Staff Performance">
              <table><thead><tr><th>Cashier</th><th>Orders</th><th>Total</th></tr></thead><tbody>
                {selected.staff.map((row) => <tr key={row.cashier}><td>{row.cashier}</td><td>{row.orders}</td><td>{money(row.total)}</td></tr>)}
              </tbody></table>
            </TablePanel>
            <TablePanel title="Category Sales">
              <table><thead><tr><th>Category</th><th>Qty</th><th>Total</th></tr></thead><tbody>
                {selected.categories.map((row) => <tr key={row.category}><td>{row.category || "Other"}</td><td>{qty(row.items_sold || 0)}</td><td>{money(row.total)}</td></tr>)}
              </tbody></table>
            </TablePanel>
            <TablePanel title="Brand Sales">
              <table><thead><tr><th>Brand</th><th>Qty</th><th>Total</th></tr></thead><tbody>
                {selected.brands.map((row) => <tr key={row.brand}><td>{row.brand || "Other"}</td><td>{qty(row.items_sold || 0)}</td><td>{money(row.total)}</td></tr>)}
              </tbody></table>
            </TablePanel>
          </section>

          <TablePanel title="Invoice Details">
            <table className="report-wide-table"><thead><tr><th>Invoice</th><th>Date & Time</th><th>Cashier</th><th>Customer</th><th>Payment</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>Total</th></tr></thead><tbody>
              {selected.sales.map((row) => (
                <tr key={row.id}><td>INV-{String(row.id).padStart(6, "0")}</td><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.cashier}</td><td>{row.customer}</td><td>{row.payment_method}</td><td>{qty(row.item_count)}</td><td>{money(row.subtotal_amount)}</td><td>{money(row.discount_amount)}</td><td>{money(row.total_amount)}</td></tr>
              ))}
              {!selected.sales.length && <tr><td colSpan={9}>No invoices found for this report period.</td></tr>}
            </tbody></table>
          </TablePanel>

          <TablePanel title="Products Sold">
            <table className="report-wide-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Brand</th><th>Qty</th><th>Invoices</th><th>Revenue</th></tr></thead><tbody>
              {selected.products.map((row) => <tr key={`${row.sku}-${row.name}`}><td>{row.name}</td><td>{row.sku || "-"}</td><td>{row.category || "-"}</td><td>{row.brand || "-"}</td><td>{qty(row.quantity, row.unit || "")}</td><td>{row.invoices}</td><td>{money(row.revenue)}</td></tr>)}
              {!selected.products.length && <tr><td colSpan={7}>No products sold for this report period.</td></tr>}
            </tbody></table>
          </TablePanel>

          <TablePanel title="Item-Level Sales Detail">
            <table className="report-wide-table"><thead><tr><th>Invoice</th><th>Date</th><th>Product</th><th>SKU</th><th>Qty</th><th>Price</th><th>Total</th><th>Cashier</th><th>Customer</th></tr></thead><tbody>
              {selected.line_items.map((row, index) => <tr key={`${row.sale_id}-${row.sku}-${index}`}><td>INV-{String(row.sale_id).padStart(6, "0")}</td><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.product}</td><td>{row.sku || "-"}</td><td>{qty(row.quantity, row.unit || "")}</td><td>{money(row.price_at_time)}</td><td>{money(row.total)}</td><td>{row.cashier}</td><td>{row.customer}</td></tr>)}
              {!selected.line_items.length && <tr><td colSpan={9}>No item detail found for this report period.</td></tr>}
            </tbody></table>
          </TablePanel>

          <section className="report-breakdown-grid">
            <TablePanel title="Purchases">
              <table><thead><tr><th>Date</th><th>Supplier</th><th>Payment</th><th>Entries</th><th>Total</th></tr></thead><tbody>
                {selected.purchases.map((row, index) => <tr key={`${row.date}-${row.supplier}-${index}`}><td>{row.date}</td><td>{row.supplier}</td><td>{row.payment_method}</td><td>{row.purchases}</td><td>{money(row.total)}</td></tr>)}
                {!selected.purchases.length && <tr><td colSpan={5}>No purchases found.</td></tr>}
              </tbody></table>
            </TablePanel>
            <TablePanel title="Inventory Movements">
              <table><thead><tr><th>Type</th><th>Transactions</th><th>Qty</th><th>Value</th></tr></thead><tbody>
                {selected.inventory_movements.map((row) => <tr key={row.movement_type}><td>{row.movement_type}</td><td>{row.transactions}</td><td>{qty(row.quantity)}</td><td>{money(row.value)}</td></tr>)}
                {!selected.inventory_movements.length && <tr><td colSpan={4}>No movements found.</td></tr>}
              </tbody></table>
            </TablePanel>
          </section>

          <TablePanel title="Void / Refund / Revocation Logs">
            <table className="report-wide-table"><thead><tr><th>Date</th><th>Invoice</th><th>Action</th><th>Reason</th><th>Cashier</th><th>Approver</th><th>Amount</th></tr></thead><tbody>
              {selected.revocations.map((row, index) => <tr key={`${row.created_at}-${index}`}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.sale_id ? `INV-${String(row.sale_id).padStart(6, "0")}` : "Draft Sale"}</td><td>{row.action_type}</td><td>{row.reason}</td><td>{row.cashier}</td><td>{row.approver}</td><td>{money(row.affected_amount)}</td></tr>)}
              {!selected.revocations.length && <tr><td colSpan={7}>No revocation logs found for this period.</td></tr>}
            </tbody></table>
          </TablePanel>
        </>
      )}
    </div>
  );
}
