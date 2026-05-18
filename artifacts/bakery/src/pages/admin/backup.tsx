import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Database, Download, AlertCircle, CheckCircle, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/admin-layout";
import { format } from "date-fns";
import { API_BASE } from "@/lib/api";

function getAdminToken() { return localStorage.getItem("nmb_admin_token"); }

interface Company {
  id: number; name: string; phone: string | null; address: string | null;
  createdAt: string; subStatus: string | null;
}

export default function AdminBackupPage() {
  const [, setLocation] = useLocation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setLocation("/admin/login"); return; }
    fetch(API_BASE + "/api/admin/companies", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { setLocation("/admin/login"); throw new Error(); } return r.json(); })
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const downloadBackup = async (company: Company) => {
    const token = getAdminToken();
    if (!token) return;
    setDownloading(company.id);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/backup/${company.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Backup failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${company.name.replace(/\s+/g, "-").toLowerCase()}-backup-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ id: company.id, type: "ok", text: "Backup downloaded successfully." });
    } catch {
      setMsg({ id: company.id, type: "err", text: "Failed to generate backup. Try again." });
    } finally {
      setDownloading(null);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    active:  "bg-green-100 text-green-800",
    trial:   "bg-blue-100 text-blue-800",
    expired: "bg-red-100 text-red-800",
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Database Backup</h2>
          <p className="text-slate-500 text-sm mt-1">Download a full JSON backup of any company's data. Backups include all operational records for that company.</p>
        </div>

        {/* Info banner */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
          <Database size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">What's included in a backup</p>
            <p className="text-xs text-blue-700 mt-1">Company profile · Branches · Users · Products · Sales · Production batches · Allocations · Returns · Inventory · Expenses · Workers</p>
          </div>
        </div>

        {/* Companies list */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
              <Building2 size={16} className="text-blue-500" /> Companies
            </CardTitle>
            <CardDescription>Select a company to download its backup file.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-slate-400 text-sm">Loading companies…</div>
            ) : companies.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">No companies found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {companies.map(co => (
                  <div key={co.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm">{co.name}</p>
                        {co.subStatus && (
                          <Badge className={`text-xs ${STATUS_COLORS[co.subStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {co.subStatus}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {co.phone && <p className="text-xs text-slate-400">{co.phone}</p>}
                        <p className="text-xs text-slate-400">Joined {co.createdAt ? format(new Date(co.createdAt), "d MMM yyyy") : "—"}</p>
                      </div>
                      {msg?.id === co.id && (
                        <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${msg.type === "ok" ? "text-green-700" : "text-red-600"}`}>
                          {msg.type === "ok" ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                          {msg.text}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadBackup(co)}
                      disabled={downloading === co.id}
                      className="flex-shrink-0 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Download size={13} />
                      {downloading === co.id ? "Preparing…" : "Backup"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
