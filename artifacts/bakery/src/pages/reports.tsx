import { useState, useEffect } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import {
  useGetSalesTrend, useGetProductionSummary, useGetDashboard, useListBranches,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Factory, BarChart3 } from "lucide-react";
import { format } from "date-fns";

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

export default function ReportsPage() {
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
  const { data: dash,  isLoading: dashLoading  } = useGetDashboard({ branchId: branchParam });

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
    <div className="space-y-6" data-testid="page-reports">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Business performance analytics</p>
      </div>

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

      {/* Sales KPIs */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Sales Summary</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Week Revenue"  value={formatCurrency(dash?.weekRevenue)}             loading={dashLoading} />
          <StatCard label="Week Profit"   value={formatCurrency(dash?.weekProfit)}              loading={dashLoading} />
          <StatCard label="Profit Margin" value={`${(dash?.profitMargin ?? 0).toFixed(1)}%`}   loading={dashLoading} />
          <StatCard label="Week Orders"   value={`${dash?.weekSalesCount ?? 0}`}                loading={dashLoading} />
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
          {trendLoading ? <Skeleton className="h-56 w-full" /> : (
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
