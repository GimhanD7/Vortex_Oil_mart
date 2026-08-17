"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw, Replace, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export default function CashierReturnsExchanges() {
  const router = useRouter();
  const { addToast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  const searchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/routes/sales.php?search=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search invoices");
      const data = await res.json();
      
      // If we got an array, take the first one or ask user to be more specific
      if (Array.isArray(data) && data.length > 0) {
        // Fetch specific invoice details for the first result
        const id = data[0].id;
        const detailsRes = await fetch(`/api/routes/sales.php?id=${id}`);
        if (!detailsRes.ok) throw new Error("Failed to fetch invoice details");
        const detailsData = await detailsRes.json();
        
        // Date restriction: Cashiers can only process same-day transactions.
        const today = new Date().toISOString().split('T')[0];
        const invoiceDate = detailsData.sale.business_date || detailsData.sale.created_at.split(' ')[0];
        
        if (invoiceDate !== today) {
          addToast("Past-date returns/exchanges must be authorized by an Admin.", "error");
          setInvoice(null);
          setItems([]);
        } else {
          setInvoice(detailsData.sale);
          setItems(detailsData.items);
        }
      } else {
        addToast("No invoices found.", "error");
        setInvoice(null);
        setItems([]);
      }
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight">Returns & Exchanges</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-8 border border-gray-100">
        <form onSubmit={searchInvoice} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search Original Invoice</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Invoice Number, Customer Phone, or Name"
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors flex items-center shadow-md shadow-blue-200"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {invoice && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Invoice #INV-{invoice.id}</h2>
              <p className="text-gray-500 font-medium">{invoice.created_at}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900 text-lg mb-1">{invoice.customer_name || "Walk-in Customer"}</p>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 text-green-700 font-semibold text-sm">
                {invoice.status}
              </div>
            </div>
          </div>

          <table className="w-full text-left mb-8">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="py-4 font-bold text-gray-400 uppercase tracking-wider text-sm">Product</th>
                <th className="py-4 font-bold text-gray-400 uppercase tracking-wider text-sm text-right">Qty</th>
                <th className="py-4 font-bold text-gray-400 uppercase tracking-wider text-sm text-right">Price</th>
                <th className="py-4 font-bold text-gray-400 uppercase tracking-wider text-sm text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 font-medium text-gray-900">{item.product_name}</td>
                  <td className="py-4 text-gray-600 text-right font-medium">{item.quantity} {item.unit}</td>
                  <td className="py-4 text-gray-600 text-right">Rs. {Number(item.price_at_time).toFixed(2)}</td>
                  <td className="py-4 text-gray-900 text-right font-semibold">Rs. {(item.quantity * item.price_at_time).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-6 text-right font-bold text-gray-600 text-lg uppercase">Total Amount</td>
                <td className="py-6 text-right font-black text-blue-600 text-2xl">Rs. {Number(invoice.total_amount).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="flex gap-4 justify-end pt-6">
            <button
              onClick={() => alert("Return process would open here")}
              className="px-8 py-3 border border-red-200 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center font-bold"
            >
              <RotateCcw size={20} className="mr-2" />
              Process Return
            </button>
            <button
              onClick={() => alert("Exchange process would open here")}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center font-bold shadow-lg shadow-blue-200"
            >
              <Replace size={20} className="mr-2" />
              Process Exchange
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
