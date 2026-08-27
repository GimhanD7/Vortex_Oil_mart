"use client";

import { useEffect, useState } from "react";
import { Search, Eye, RotateCcw, Replace, Calendar, Filter, X, ShieldAlert, FileText, User } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export default function AdminReturnsExchanges() {
  const { addToast } = useToast();
  
  const [returns, setReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<any>(null);

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/routes/sales.php?id=returns`);
      if (!res.ok) throw new Error("Failed to fetch returns history");
      const data = await res.json();
      setReturns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReturns = returns.filter(r => 
    r.return_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.original_sale_id?.toString().includes(searchQuery)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Returns & Exchanges Log</h1>
          <p className="text-gray-500 font-medium">View and audit all return and exchange transactions across all dates.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Return #, Invoice #, or Customer"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Transaction</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Date & Time</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Customer</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Cashier</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Type</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">Refund / Credit Value</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">Loading transactions...</td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">No return or exchange transactions found.</td>
                </tr>
              ) : (
                filteredReturns.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900">{r.return_number}</div>
                      <div className="text-xs text-gray-500 font-medium">Original: INV-{r.original_sale_id}</div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-gray-400" />
                        {r.created_at}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-900 text-sm">{r.customer_name || "Walk-in Customer"}</td>
                    <td className="py-4 px-6 text-gray-600 text-sm">{r.cashier_name || "Cashier"}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        r.transaction_type === 'exchange' 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'bg-orange-50 text-orange-700'
                      }`}>
                        {r.transaction_type === 'exchange' ? <Replace size={12} className="mr-1" /> : <RotateCcw size={12} className="mr-1" />}
                        {r.transaction_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-gray-900">
                      Rs. {Number(r.refund_amount).toFixed(2)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => setSelectedReturn(r)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex" 
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Record Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                Return Details ({selectedReturn.return_number})
              </h3>
              <button onClick={() => setSelectedReturn(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </header>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Return Number</span>
                  <span className="font-bold text-gray-900">{selectedReturn.return_number}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Original Invoice</span>
                  <span className="font-bold text-blue-600">INV-{selectedReturn.original_sale_id}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Date & Time</span>
                  <span className="font-medium text-gray-700">{selectedReturn.created_at}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Resolution</span>
                  <span className="font-bold text-gray-900">{selectedReturn.resolution} ({selectedReturn.transaction_type})</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Customer</span>
                  <span className="font-medium text-gray-900">{selectedReturn.customer_name || "Walk-in Customer"}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Processed By</span>
                  <span className="font-medium text-gray-900">{selectedReturn.cashier_name || "Cashier"}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">Reason / Notes</span>
                <p className="bg-gray-50 p-3 rounded-lg text-gray-700 text-xs italic">
                  {selectedReturn.reason} {selectedReturn.notes ? `— ${selectedReturn.notes}` : ""}
                </p>
              </div>

              <div className="pt-2 flex justify-between items-center font-bold text-base border-t border-gray-100">
                <span className="text-gray-700">Total Refund / Credit Amount</span>
                <span className="text-blue-600 text-xl">Rs. {Number(selectedReturn.refund_amount).toFixed(2)}</span>
              </div>
            </div>
            <footer className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setSelectedReturn(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs transition-colors"
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
