import {
  useGetDashboard, useGetSalesTrend, useListSales, useGetDailySalesSummary,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingCart, Factory, Package, AlertTriangle,
  Percent, Plus, FileText, Clock, ArrowUpRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ── Page header ── */
function PageHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── KPI card ── */
function KpiCard({
  title, value, sub, icon: Icon, loading, accent = "default",
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; loading: boolean;
  accent?: "default" | "green" | "amber" | "red";
}) {
  const iconBg = { default: "bg-slate-950", green: "bg-emerald-600", amber: "bg-amber-500", red: "bg-red-500" };
  return (
    <Card className="rounded-2xl border-0 shadow-sm bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{title}</p>
            {loading ? <Skeleton className="h-7 w-28" /> : (
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
            )}
            {sub && !loading && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl ${iconBg[accent]} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════
   RECEPTIONIST DASHBOARD
   ══════════════════════════════════════════════ */
function ReceptionistDashboard() {
  const [, setLocation] = useLocation();
  const { data: daily, isLoading: dailyLoading } = useGetDailySalesSummary({});
  const { data: dash, isLoading: dashLoading } = useGetDashboard({});
  const { data: sales, isLoading: salesLoading } = useListSales({});

  const today = new Date().toDateString();
  const todaySales = (sales ?? []).filter(s => new Date(s.saleDate).toDateString() === today);
  const totalUnits = todaySales.reduce((sum, s) => sum + s.quantity, 0);
  const remaining = Math.max(0, (dash?.todayProduction ?? 0) - totalUnits);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(new Date(), "EEEE, d MMMM")}
        subtitle="Your daily overview"
        action={
          <Button onClick={() => setLocation("/sales")} size="sm">
            <Plus size={14} className="mr-1.5" />
            New Sale
          </Button>
        }
      />

      {/* 4 Stats */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Total Sales"        value={`${daily?.totalSales ?? 0}`}             sub="orders today"      icon={ShoppingCart} loading={dailyLoading} />
        <KpiCard title="Total Amount"       value={formatCurrency(daily?.totalRevenue ?? 0)} sub="today's revenue"   icon={TrendingUp}   loading={dailyLoading} accent="green" />
        <KpiCard title="Products Sold"      value={`${totalUnits}`}                          sub="units sold"        icon={Package}      loading={salesLoading} accent="amber" />
        <KpiCard title="Remaining Stock"    value={dashLoading || salesLoading ? "—" : `${remaining}`} sub="units available" icon={Factory} loading={dashLoading || salesLoading} accent={remaining < 20 ? "red" : "default"} />
      </div>

      {/* Daily Sales Track */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Clock size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Daily Sales Track</CardTitle>
                <CardDescription className="text-xs">All sales today</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">{todaySales.length} txns</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {salesLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : todaySales.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingCart size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No sales yet today.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {[...todaySales].reverse().map((sale, idx) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{sale.breadType}</p>
                    <p className="text-xs text-muted-foreground">{sale.quantity} units · {format(new Date(sale.saleDate), "HH:mm")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">{formatCurrency(sale.totalAmount)}</p>
                    <Badge variant={sale.paymentMethod === "cash" ? "secondary" : "outline"} className="text-[10px] capitalize mt-0.5">
                      {sale.paymentMethod}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved receipts link */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                <FileText size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Saved Receipts</p>
                <p className="text-xs text-muted-foreground">View & download past slips</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/sales")} className="gap-1 text-xs">
              Open <ArrowUpRight size={13} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MANAGER / MD DASHBOARD
   ══════════════════════════════════════════════ */
function ManagerDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useGetDashboard({});
  const { data: trend, isLoading: trendLoading } = useGetSalesTrend({ days: 14 });

  const chartData = (trend ?? []).map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    Revenue: p.revenue,
    Profit: p.profit,
  }));

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader title="Dashboard" subtitle="Today's overview and weekly performance" />

      {/* Section label */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Today</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Revenue"    value={formatCurrency(metrics?.todayRevenue ?? 0)}    sub="today"       icon={TrendingUp}   loading={metricsLoading} accent="green" />
          <KpiCard title="Profit"     value={formatCurrency(metrics?.todayProfit ?? 0)}     sub="today"       icon={TrendingUp}   loading={metricsLoading} />
          <KpiCard title="Sales"      value={`${metrics?.todaySalesCount ?? 0}`}            sub="orders"      icon={ShoppingCart} loading={metricsLoading} accent="amber" />
          <KpiCard title="Production" value={`${metrics?.todayProduction ?? 0}`}            sub="units baked" icon={Factory}      loading={metricsLoading} />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">This Week</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Weekly Revenue" value={formatCurrency(metrics?.weekRevenue ?? 0)} sub="last 7 days" icon={TrendingUp}    loading={metricsLoading} accent="green" />
          <KpiCard title="Weekly Profit"  value={formatCurrency(metrics?.weekProfit ?? 0)}  sub="last 7 days" icon={TrendingUp}    loading={metricsLoading} />
          <KpiCard title="Profit Margin"  value={`${(metrics?.profitMargin ?? 0).toFixed(1)}%`}  sub="this week" icon={Percent}    loading={metricsLoading} accent="amber" />
          <KpiCard
            title="Inventory Alerts"
            value={`${metrics?.lowStockCount ?? 0}`}
            sub={metrics?.lowStockCount ? "items low" : "all good"}
            icon={AlertTriangle}
            loading={metricsLoading}
            accent={metrics?.lowStockCount ? "red" : "green"}
          />
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
              <CardTitle className="text-sm font-bold tracking-tight">Revenue Trend — 14 Days</CardTitle>
              <CardDescription className="text-xs">Revenue and profit over the last 2 weeks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading ? <Skeleton className="h-56 w-full" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 12 }}
                  formatter={(v: number, n: string) => [`₦${v.toLocaleString()}`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="Profit"  stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const user = getStoredUser();
  if (user?.role === "receptionist") return <ReceptionistDashboard />;
  return <ManagerDashboard />;
}
