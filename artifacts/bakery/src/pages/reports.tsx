import { useState } from "react";
import {
  useGetSalesTrend,
  useGetProductionSummary,
  useGetDashboard,
  useListBranches,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { format } from "date-fns";

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function ReportsPage() {
  const [branchId, setBranchId] = useState<string>("all");
  const [days, setDays] = useState("14");

  const { data: branches } = useListBranches();
  const branchParam = branchId !== "all" ? parseInt(branchId) : null;

  const { data: trend, isLoading: trendLoading } = useGetSalesTrend({
    branchId: branchParam,
    days: parseInt(days),
  });

  const { data: prodSummary, isLoading: prodLoading } = useGetProductionSummary({
    branchId: branchParam,
  });

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({
    branchId: branchParam,
  });

  const trendData = (trend ?? []).map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    Revenue: p.revenue,
    Profit: p.profit,
    Sales: p.salesCount,
  }));

  const prodByType = (prodSummary?.byBreadType ?? []).map((b) => ({
    name: b.breadType,
    Produced: b.totalProduced,
    Waste: b.totalWaste,
  }));

  const efficiencyData = [
    { name: "Net Production", value: (prodSummary?.totalProduced ?? 0) - (prodSummary?.totalWaste ?? 0) },
    { name: "Waste", value: prodSummary?.totalWaste ?? 0 },
  ];

  return (
    <div className="space-y-6" data-testid="page-reports">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Business performance analytics</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        {branches && branches.length > 1 && (
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-44" data-testid="select-report-branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Period (days)</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary KPIs */}
      {!dashLoading && dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Week Revenue", value: formatCurrency(dashboard.weekRevenue) },
            { label: "Week Profit", value: formatCurrency(dashboard.weekProfit) },
            { label: "Profit Margin", value: `${dashboard.profitMargin.toFixed(1)}%` },
            { label: "Week Sales", value: `${dashboard.weekSalesCount} orders` },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sales Trend */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Sales Trend</CardTitle>
          <CardDescription>Revenue and profit over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  formatter={(v: number, n: string) => [`₦${v.toLocaleString()}`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Production Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Production by Bread Type</CardTitle>
          </CardHeader>
          <CardContent>
            {prodLoading ? <Skeleton className="h-52 w-full" /> : prodByType.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={prodByType} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Produced" fill="hsl(var(--chart-1))" radius={[4,4,0,0]} />
                  <Bar dataKey="Waste" fill="hsl(var(--destructive))" radius={[4,4,0,0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No production data yet</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Waste vs Net Production</CardTitle>
            <CardDescription>Efficiency: {prodSummary?.efficiency?.toFixed(1) ?? "0.0"}%</CardDescription>
          </CardHeader>
          <CardContent>
            {prodLoading ? <Skeleton className="h-52 w-full" /> : (prodSummary?.totalProduced ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={efficiencyData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {efficiencyData.map((_, i) => <Cell key={i} fill={i === 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No production data yet</div>}
          </CardContent>
        </Card>
      </div>

      {/* Production Stats */}
      {prodSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Produced", value: `${prodSummary.totalProduced} loaves` },
            { label: "Total Waste", value: `${prodSummary.totalWaste} loaves` },
            { label: "Waste %", value: `${prodSummary.wastePercentage.toFixed(1)}%` },
            { label: "Efficiency", value: `${prodSummary.efficiency.toFixed(1)}%` },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
