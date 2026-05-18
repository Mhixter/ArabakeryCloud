import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Receipt, CheckCircle, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/admin-layout";
import { format } from "date-fns";
import { API_BASE } from "@/lib/api";

interface Transaction {
  id: number;
  companyId: number;
  companyName: string;
  reference: string;
  amount: string;
  status: string;
  gateway: string;
  gatewayReference: string | null;
  description: string | null;
  months: number;
  createdAt: string;
}

function getAdminToken() { return localStorage.getItem("nmb_admin_token"); }

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  success:  { label: "Success",  className: "bg-green-100 text-green-800 border-green-200",  icon: CheckCircle },
  pending:  { label: "Pending",  className: "bg-amber-100 text-amber-800 border-amber-200",  icon: Clock },
  failed:   { label: "Failed",   className: "bg-red-100 text-red-800 border-red-200",        icon: XCircle },
  refunded: { label: "Refunded", className: "bg-purple-100 text-purple-800 border-purple-200", icon: AlertCircle },
};

const GATEWAY_LABELS: Record<string, string> = {
  paystack: "Paystack", flutterwave: "Flutterwave", manual: "Manual",
};

export default function AdminTransactionsPage() {
  const [, setLocation] = useLocation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const token = getAdminToken();

  const load = useCallback(() => {
    if (!token) { setLocation("/admin/login"); return; }
    setLoading(true);
    fetch(API_BASE + "/api/admin/transactions", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { setLocation("/admin/login"); throw new Error("Auth"); } return r.json(); })
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    if (!token) return;
    setUpdatingId(id);
    try {
      await fetch(`${API_BASE}/api/admin/transactions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      load();
    } catch {}
    finally { setUpdatingId(null); }
  };

  const filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = t.companyName?.toLowerCase().includes(q) ||
      t.reference.toLowerCase().includes(q) ||
      (t.gatewayReference ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totals = {
    total: transactions.length,
    success: transactions.filter(t => t.status === "success").length,
    pending: transactions.filter(t => t.status === "pending").length,
    failed: transactions.filter(t => t.status === "failed").length,
    revenue: transactions.filter(t => t.status === "success").reduce((s, t) => s + parseFloat(t.amount), 0),
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Transactions</h2>
            <p className="text-slate-500 text-sm mt-0.5">All subscription payment transactions across the platform.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Transactions", value: totals.total, color: "text-slate-700", bg: "bg-slate-50" },
            { label: "Successful",  value: totals.success, color: "text-green-700", bg: "bg-green-50" },
            { label: "Pending",     value: totals.pending, color: "text-amber-700", bg: "bg-amber-50" },
            { label: "Revenue (₦)", value: totals.revenue.toLocaleString("en-NG"), color: "text-blue-700", bg: "bg-blue-50" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-slate-100`}>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference, company…" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Receipt size={32} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">No transactions found</p>
                <p className="text-xs mt-1">Transactions will appear here when companies renew subscriptions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Reference</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Company</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Amount</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Gateway</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Description</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Date</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(tx => {
                      const sc = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
                      const Icon = sc.icon;
                      return (
                        <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-mono text-xs font-semibold text-slate-700">{tx.reference}</p>
                              {tx.gatewayReference && (
                                <p className="font-mono text-xs text-slate-400 mt-0.5">{tx.gatewayReference}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-700 font-medium">{tx.companyName}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800">
                            ₦{parseFloat(tx.amount).toLocaleString("en-NG")}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge className={`text-xs border gap-1 ${sc.className}`}>
                              <Icon size={10} />
                              {sc.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs capitalize">
                            {GATEWAY_LABELS[tx.gateway] ?? tx.gateway}
                          </td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs max-w-[160px] truncate">
                            {tx.description ?? `${tx.months} month subscription`}
                          </td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                            {tx.createdAt ? format(new Date(tx.createdAt), "MMM d, yyyy HH:mm") : "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            {tx.status === "pending" && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm" variant="outline"
                                  disabled={updatingId === tx.id}
                                  onClick={() => updateStatus(tx.id, "success")}
                                  className="h-6 text-xs px-2 text-green-600 border-green-200 hover:bg-green-50">
                                  Approve
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  disabled={updatingId === tx.id}
                                  onClick={() => updateStatus(tx.id, "failed")}
                                  className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50">
                                  Fail
                                </Button>
                              </div>
                            )}
                            {tx.status === "success" && (
                              <Button
                                size="sm" variant="outline"
                                disabled={updatingId === tx.id}
                                onClick={() => updateStatus(tx.id, "refunded")}
                                className="h-6 text-xs px-2 text-purple-600 border-purple-200 hover:bg-purple-50">
                                Refund
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
