import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, CheckCircle, Clock, XCircle, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/admin-layout";
import { Link } from "wouter";
import { format } from "date-fns";

interface Analytics {
  totalCompanies: number;
  active: number;
  trial: number;
  expired: number;
  monthlyRevenue: number;
  recentCompanies: Array<{ id: number; name: string; createdAt: string; status: string }>;
}

function getAdminToken() { return localStorage.getItem("nmb_admin_token"); }

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trial: "bg-blue-100 text-blue-800",
  expired: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setLocation("/admin/login"); return; }
    fetch("/api/admin/analytics", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { setLocation("/admin/login"); throw new Error("Unauthorized"); } return r.json(); })
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    </AdminLayout>
  );

  if (!analytics) return <AdminLayout><p className="text-slate-500">Failed to load analytics.</p></AdminLayout>;

  const stats = [
    { label: "Total Companies", value: analytics.totalCompanies, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Subscribers", value: analytics.active, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "On Free Trial", value: analytics.trial, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Expired", value: analytics.expired, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-slate-800">Platform Overview</h2>
          <p className="text-slate-500 text-sm mt-1">Real-time stats across all bakery companies on the platform.</p>
        </div>

        {/* Revenue highlight */}
        <div className="rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-lg shadow-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold mt-1">₦{analytics.monthlyRevenue.toLocaleString("en-NG")}</p>
              <p className="text-blue-200 text-xs mt-2">Based on {analytics.active} active subscriber{analytics.active !== 1 ? "s" : ""} × ₦3,000/month</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={24} className="text-white" />
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-500 text-xs font-medium">{stat.label}</p>
                    <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <Icon size={16} className={stat.color} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent companies */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-slate-800 text-base font-semibold">Recently Registered</CardTitle>
            <Link href="/admin/companies">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 gap-1">
                View all <ArrowRight size={14} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {analytics.recentCompanies.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">No companies yet.</p>
            ) : (
              <div className="space-y-2">
                {analytics.recentCompanies.map(co => (
                  <div key={co.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-slate-800 font-medium text-sm">{co.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Joined {co.createdAt ? format(new Date(co.createdAt), "MMM d, yyyy") : "—"}
                      </p>
                    </div>
                    <Badge className={`text-xs ${STATUS_COLORS[co.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {co.status ?? "unknown"}
                    </Badge>
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
