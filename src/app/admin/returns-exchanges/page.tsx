"use client";

import { useEffect, useState } from "react";
import { Search, Eye, RotateCcw, Replace, Calendar, Filter } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export default function AdminReturnsExchanges() {
  const { addToast } = useToast();
  
  const [returns, setReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/routes/sales.php?id=returns`);
      if (!res.ok) throw new Error("Failed to fetch returns history");
      const data = await res.json();
      setReturns(data);
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Returns & Exchanges</h1>
          <p className="text-gray-500 font-medium">View and manage all return and exchange transactions across all dates.</p>
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
          <button className="px-4 py-2.5 border border-gray-200 text-gray-700 bg-white rounded-lg hover:bg-gray-50 flex items-center font-medium shadow-sm transition-colors">
            <Filter size={18} className="mr-2 text-gray-500" />
            Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Transaction</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Date</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Customer</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs">Type</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">Refund/Value</th>
                <th className="py-4 px-6 font-bold text-gray-500 uppercase tracking-wider text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">Loading transactions...</td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">No return or exchange transactions found.</td>
                </tr>
              ) : (
                filteredReturns.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-900">{r.return_number}</div>
                      <div className="text-sm text-gray-500 font-medium">Original: INV-{r.original_sale_id}</div>
                    </td>
                    <td className="py-4 px-6 text-gray-600 font-medium">
                      <div className="flex items-center">
                        <Calendar size={14} className="mr-2 text-gray-400" />
                        {r.created_at.split(' ')[0]}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-900">{r.customer_name || "Walk-in Customer"}</td>
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
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex" title="View Details">
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
    </div>
  );
}
