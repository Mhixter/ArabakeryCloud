import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Building2, CheckCircle, Clock, XCircle, MoreVertical, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/admin-layout";
import { format } from "date-fns";

interface Company {
  id: number;
  name: string;
  phone: string;
  address: string;
  themeColor: string;
  createdAt: string;
  subStatus: string;
  subPlan: string;
  subStart: string;
  subEnd: string;
}

function getAdminToken() { return localStorage.getItem("nmb_admin_token"); }

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  trial: "bg-blue-100 text-blue-800 border-blue-200",
  expired: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const THEME_DOTS: Record<string, string> = {
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  slate: "bg-slate-500",
};

export default function AdminCompaniesPage() {
  const [, setLocation] = useLocation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editStatus, setEditStatus] = useState("active");
  const [editDays, setEditDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [resetCompany, setResetCompany] = useState<Company | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  const token = getAdminToken();

  const loadCompanies = useCallback(() => {
    if (!token) { setLocation("/admin/login"); return; }
    setLoading(true);
    fetch("/api/admin/companies", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { setLocation("/admin/login"); throw new Error("Auth"); } return r.json(); })
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const openEdit = (co: Company) => {
    setSelectedCompany(co);
    setEditStatus(co.subStatus ?? "active");
    setEditDays("30");
    setSaveMsg("");
  };

  const handleResetMDPassword = async () => {
    if (!resetCompany || !token) return;
    if (!resetPassword || resetPassword.length < 4) {
      setResetMsg("✗ Password must be at least 4 characters");
      return;
    }
    setResetting(true); setResetMsg("");
    try {
      const res = await fetch(`/api/admin/companies/${resetCompany.id}/reset-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResetMsg("✓ Password reset successfully");
      setResetPassword("");
    } catch (e) {
      setResetMsg(`✗ ${(e as Error).message}`);
    } finally {
      setResetting(false);
    }
  };

  const handleSaveSubscription = async () => {
    if (!selectedCompany || !token) return;
    setSaving(true); setSaveMsg("");
    try {
      const body: any = { status: editStatus };
      if (editDays && parseInt(editDays) > 0) body.days = parseInt(editDays);
      const res = await fetch(`/api/admin/companies/${selectedCompany.id}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      setSaveMsg("✓ Subscription updated successfully");
      loadCompanies();
    } catch {
      setSaveMsg("✗ Failed to update subscription");
    } finally {
      setSaving(false);
    }
  };

  const filtered = companies.filter(co => {
    const matchSearch = co.name.toLowerCase().includes(search.toLowerCase()) ||
      co.phone?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || co.subStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">All Companies</h2>
            <p className="text-slate-500 text-sm mt-0.5">{companies.length} registered bakeries on the platform</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search companies…" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Building2 size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No companies found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Company</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Contact</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Theme</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Expires</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">Joined</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(co => (
                      <tr key={co.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{co.name}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{co.phone || "—"}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3 h-3 rounded-full ${THEME_DOTS[co.themeColor] ?? "bg-slate-300"}`} />
                            <span className="text-slate-600 capitalize">{co.themeColor ?? "amber"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge className={`text-xs border ${STATUS_COLORS[co.subStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {co.subStatus === "active" && <CheckCircle size={10} className="mr-1" />}
                            {co.subStatus === "trial" && <Clock size={10} className="mr-1" />}
                            {co.subStatus === "expired" && <XCircle size={10} className="mr-1" />}
                            {co.subStatus ?? "unknown"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">
                          {co.subEnd ? format(new Date(co.subEnd), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">
                          {co.createdAt ? format(new Date(co.createdAt), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setResetCompany(co); setResetPassword(""); setResetMsg(""); }} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="Reset MD Password">
                              <KeyRound size={14} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEdit(co)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Manage Subscription">
                              <MoreVertical size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reset MD Password dialog */}
      <Dialog open={!!resetCompany} onOpenChange={open => { if (!open) { setResetCompany(null); setResetMsg(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset MD Password — {resetCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set a new password for the <span className="font-medium text-foreground">Managing Director</span> of <span className="font-medium text-foreground">{resetCompany?.name}</span>.
            </p>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Min. 4 characters"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleResetMDPassword()}
              />
            </div>
            {resetMsg && (
              <p className={`text-sm font-medium ${resetMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>{resetMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetCompany(null); setResetMsg(""); }}>Cancel</Button>
            <Button onClick={handleResetMDPassword} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit subscription dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={open => { if (!open) setSelectedCompany(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subscription — {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Subscription Status</p>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Extend by (days)</p>
              <Input
                type="number" min="0" max="3650"
                value={editDays} onChange={e => setEditDays(e.target.value)}
                placeholder="0 = keep current end date"
              />
              <p className="text-xs text-muted-foreground mt-1">Set 0 to only change the status without extending.</p>
            </div>
            {saveMsg && (
              <p className={`text-sm font-medium ${saveMsg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>{saveMsg}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCompany(null)}>Cancel</Button>
            <Button onClick={handleSaveSubscription} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
