import { useState, useEffect, useCallback } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { getToken, getStoredUser, getStoredCompany } from "@/lib/auth";
import {
  useGetSalesTrend, useGetProductionSummary, useListBranches,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Factory, BarChart3, FileText, Download } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { generatePdf, fmtCurrency } from "@/lib/pdf";

function formatCurrency(n: number | undefined | null) {
  return `₦${(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
        {loading ? <Skeleton className="h-7 w-24" /> : (
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function apiHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function toLocalWeekStart(d: Date) {
  const mon = startOfWeek(d, { weekStartsOn: 1 });
  return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
}

/* ────────── Weekly Report Tab ────────── */
interface WeeklySummary {
  weekStart: string; weekEnd: string;
  sales: { total: { revenue: number; profit: number; qty: number }; byProduct: { productId: number; productName: string; revenue: number; profit: number; qty: number }[] };
  production: { total: { produced: number; waste: number }; byType: { type: string; produced: number; waste: number }[] };
  expenses: { total: number; byCategory: { category: string; amount: number }[]; records: { note: string; amount: number; category: string; date: string }[] };
}

function WeeklyReportTab() {
  const { activeBranch } = useActiveBranch();
  const user    = getStoredUser();
  const company = getStoredCompany();
  const isDirector = user?.role === "managing_director";
  const { data: branches } = useListBranches();

  const [weekStart, setWeekStart] = useState(toLocalWeekStart(new Date()));
  const [branchId,  setBranchId]  = useState(activeBranch?.id?.toString() ?? "");
  const [summary, setSummary]     = useState<WeeklySummary | null>(null);
  const [loading, setLoading]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ weekStart });
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/reports/weekly-summary?${params}`, { headers: apiHeaders() });
      setSummary(res.ok ? await res.json() : null);
    } finally { setLoading(false); }
  }, [weekStart, branchId]);

  useEffect(() => { load(); }, [load]);

  const exportPdf = () => {
    if (!summary) return;
    const branchLabel = branchId ? branches?.find(b => b.id.toString() === branchId)?.name : (activeBranch?.name ?? undefined);
    const weekLabel = `${format(new Date(summary.weekStart), "d MMM")} – ${format(new Date(summary.weekEnd), "d MMM yyyy")}`;

    generatePdf({
      title: "Weekly Summary Report",
      subtitle: weekLabel,
      companyName: company?.name ?? "Bakery",
      companyPhone: company?.phone ?? undefined,
      companyAddress: company?.address ?? undefined,
      branchName: branchLabel,
      logoUrl: company?.logoUrl ?? undefined,
      dateRange: weekLabel,
      sections: [
        {
          title: `Sales by Product (Total: ${fmtCurrency(summary.sales.total.revenue)})`,
          headers: ["Product", "Units Sold", "Revenue", "Profit"],
          rows: summary.sales.byProduct.map(p => [p.productName, p.qty, fmtCurrency(p.revenue), fmtCurrency(p.profit)]),
          totals: ["TOTAL", summary.sales.total.qty, fmtCurrency(summary.sales.total.revenue), fmtCurrency(summary.sales.total.profit)],
        },
        {
          title: `Production by Type (Total: ${summary.production.total.produced} units)`,
          headers: ["Bread Type", "Produced", "Waste", "Net"],
          rows: summary.production.byType.map(p => [p.type, p.produced, p.waste, p.produced - p.waste]),
          totals: ["TOTAL", summary.production.total.produced, summary.production.total.waste, summary.production.total.produced - summary.production.total.waste],
        },
        {
          title: `Expenses by Category (Total: ${fmtCurrency(summary.expenses.total)})`,
          headers: ["Category", "Amount"],
          rows: summary.expenses.byCategory.map(e => [e.category, fmtCurrency(e.amount)]),
          totals: ["TOTAL", fmtCurrency(summary.expenses.total)],
        },
      ],
      filename: `weekly-report-${weekStart}.pdf`,
    });
  };

  const weekDays = summary ? `${format(new Date(summary.weekStart), "EEEE d MMM")} → ${format(new Date(summary.weekEnd), "EEEE d MMM yyyy")}` : "";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Week starting (Monday)</Label>
          <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="h-9 text-sm w-40" />
        </div>
        {isDirector && branches && branches.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="All branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" variant="outline" onClick={exportPdf} disabled={!summary || loading}
          className="gap-1.5">
          <Download size={13} /> Export PDF
        </Button>
      </div>

      {summary && <p className="text-xs text-muted-foreground -mt-1">{weekDays}</p>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Revenue"   value={formatCurrency(summary?.sales.total.revenue)} loading={loading} />
        <StatCard label="Profit"    value={formatCurrency(summary?.sales.total.profit)}  loading={loading} />
        <StatCard label="Produced"  value={`${summary?.production.total.produced ?? 0} units`} loading={loading} />
        <StatCard label="Expenses"  value={formatCurrency(summary?.expenses.total)} loading={loading} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Sales by product */}
        <Card className="rounded-2xl border-0 shadow-sm md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Sales by Product</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> :
             !summary?.sales.byProduct.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No sales this week</div>
            ) : (
              <div className="divide-y divide-border/50">
                {summary.sales.byProduct.map(p => (
                  <div key={p.productId} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm font-medium truncate">{p.productName}</p>
                    <div className="flex items-center gap-4 text-right flex-shrink-0">
                      <div><p className="text-xs text-muted-foreground">Units</p><p className="text-sm font-semibold">{p.qty}</p></div>
                      <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-sm font-semibold">{formatCurrency(p.revenue)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Profit</p><p className="text-sm font-semibold text-green-600">{formatCurrency(p.profit)}</p></div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-muted/30">
                  <p className="text-sm font-bold">TOTAL</p>
                  <div className="flex items-center gap-4 text-right flex-shrink-0">
                    <div><p className="text-xs text-muted-foreground">Units</p><p className="text-sm font-bold">{summary.sales.total.qty}</p></div>
                    <div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-sm font-bold">{formatCurrency(summary.sales.total.revenue)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Profit</p><p className="text-sm font-bold text-green-600">{formatCurrency(summary.sales.total.profit)}</p></div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by category */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Expenses</CardTitle>
            <CardDescription className="text-xs">{formatCurrency(summary?.expenses.total)} total</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-8 w-full"/>)}</div> :
             !summary?.expenses.byCategory.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No expenses this week</div>
            ) : (
              <div className="divide-y divide-border/50">
                {summary.expenses.byCategory.map(e => (
                  <div key={e.category} className="flex items-center justify-between px-5 py-2.5">
                    <p className="text-sm truncate">{e.category}</p>
                    <p className="text-sm font-semibold flex-shrink-0">{formatCurrency(e.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Production by type */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Production by Type</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><Skeleton className="h-10 w-full" /></div> :
           !summary?.production.byType.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No production this week</div>
          ) : (
            <div className="divide-y divide-border/50">
              {summary.production.byType.map(p => (
                <div key={p.type} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm font-medium">{p.type}</p>
                  <div className="flex items-center gap-6 text-right">
                    <div><p className="text-xs text-muted-foreground">Produced</p><p className="text-sm font-semibold">{p.produced}</p></div>
                    <div><p className="text-xs text-muted-foreground">Waste</p><p className="text-sm font-semibold text-red-500">{p.waste}</p></div>
                    <div><p className="text-xs text-muted-foreground">Net</p><p className="text-sm font-semibold text-green-600">{p.produced - p.waste}</p></div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-3 bg-muted/30">
                <p className="text-sm font-bold">TOTAL</p>
                <div className="flex items-center gap-6 text-right">
                  <div><p className="text-xs text-muted-foreground">Produced</p><p className="text-sm font-bold">{summary.production.total.produced}</p></div>
                  <div><p className="text-xs text-muted-foreground">Waste</p><p className="text-sm font-bold text-red-500">{summary.production.total.waste}</p></div>
                  <div><p className="text-xs text-muted-foreground">Net</p><p className="text-sm font-bold text-green-600">{summary.production.total.produced - summary.production.total.waste}</p></div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────── Analytics Tab ────────── */
function AnalyticsTab() {
  const { activeBranch } = useActiveBranch();
  const [branchId, setBranchId] = useState<string>(activeBranch ? activeBranch.id.toString() : "all");
  const [days, setDays] = useState("14");

  useEffect(() => {
    setBranchId(activeBranch ? activeBranch.id.toString() : "all");
  }, [activeBranch]);

  const { data: branches } = useListBranches();
  const branchParam = branchId !== "all" ? parseInt(branchId) : null;

  const { data: trend, isLoading: trendLoading } = useGetSalesTrend({ branchId: branchParam, days: parseInt(days) });
  const { data: prod,  isLoading: prodLoading  } = useGetProductionSummary({ branchId: branchParam });

  const trendData = (trend ?? []).map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    Revenue: p.revenue,
    Profit: p.profit,
  }));

  const prodByType = (prod?.byBreadType ?? []).map((b) => ({
    name: b.breadType,
    Produced: b.totalProduced,
    Waste: b.totalWaste,
  }));

  const effData = [
    { name: "Net", value: (prod?.totalProduced ?? 0) - (prod?.totalWaste ?? 0) },
    { name: "Waste", value: prod?.totalWaste ?? 0 },
  ];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: 12,
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {branches && branches.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-report-branch"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Period</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <TrendingUp size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Sales Trend</CardTitle>
              <CardDescription className="text-xs">Revenue and profit over the selected period</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading ? <Skeleton className="h-56 w-full" /> :
           trendData.length === 0 || trendData.every(d => d.Revenue === 0) ? (
            <div className="h-56 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <TrendingUp size={32} className="opacity-20" />
              <p className="text-sm">No sales recorded in this period yet.</p>
              <p className="text-xs">Record sales to see revenue trends here.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`₦${v.toLocaleString()}`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Profit"  stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Production KPIs */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Production Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Produced" value={`${prod?.totalProduced ?? 0} units`}              loading={prodLoading} />
          <StatCard label="Total Waste"    value={`${prod?.totalWaste ?? 0} units`}                 loading={prodLoading} />
          <StatCard label="Waste %"        value={`${(prod?.wastePercentage ?? 0).toFixed(1)}%`}    loading={prodLoading} />
          <StatCard label="Efficiency"     value={`${(prod?.efficiency ?? 0).toFixed(1)}%`}         loading={prodLoading} />
        </div>
      </div>

      {/* Production charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <BarChart3 size={15} className="text-amber-400" />
              </div>
              <CardTitle className="text-sm font-bold tracking-tight">Production by Type</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {prodLoading ? <Skeleton className="h-52 w-full" /> : prodByType.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={prodByType} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Produced" fill="#f59e0b" radius={[4,4,0,0]} />
                  <Bar dataKey="Waste"    fill="#ef4444" radius={[4,4,0,0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No production data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Factory size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Waste vs Net Production</CardTitle>
                <CardDescription className="text-xs">Efficiency: {(prod?.efficiency ?? 0).toFixed(1)}%</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {prodLoading ? <Skeleton className="h-52 w-full" /> : (prod?.totalProduced ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={effData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No production data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ────────── Main Reports Page ────────── */
export default function ReportsPage() {
  const [tab, setTab] = useState<"analytics" | "weekly">("analytics");

  return (
    <div className="space-y-5" data-testid="page-reports">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Business performance analytics</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "analytics" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <BarChart3 size={14} /> Analytics
        </button>
        <button
          onClick={() => setTab("weekly")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "weekly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <FileText size={14} /> Weekly Report
        </button>
      </div>

      {tab === "analytics" ? <AnalyticsTab /> : <WeeklyReportTab />}
    </div>
  );
}
