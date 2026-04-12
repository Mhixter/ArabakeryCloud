import { useGetDashboard, useGetSalesTrend, useListSales, useGetDailySalesSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingCart, Factory, Package, AlertTriangle,
  Percent, Plus, FileText, Clock,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Shared KPI card ── */
function KpiCard({
  title, value, subtitle, icon: Icon, loading, accent,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; loading: boolean;
  accent?: "primary" | "green" | "amber" | "red";
}) {
  const accentMap = {
    primary: "bg-primary/10 text-primary",
    green:   "bg-emerald-100 text-emerald-600",
    amber:   "bg-amber-100 text-amber-600",
    red:     "bg-red-100 text-red-600",
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            {loading ? <Skeleton className="h-8 w-32 mt-1" /> : (
              <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accentMap[accent ?? "primary"]}`}>
            <Icon size={20} />
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
  const { data: dailySummary, isLoading: summaryLoading } = useGetDailySalesSummary({});
  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({});
  const { data: sales, isLoading: salesLoading } = useListSales({});

  /* Today's sales only */
  const today = new Date().toDateString();
  const todaySales = (sales ?? []).filter(s => new Date(s.saleDate).toDateString() === today);
  const totalUnitsSold = todaySales.reduce((sum, s) => sum + s.quantity, 0);
  const remainingProducts = Math.max(0, (dashboard?.todayProduction ?? 0) - totalUnitsSold);

  const stats = [
    {
      title: "Total Sales",
      value: `${dailySummary?.totalSales ?? 0} orders`,
      subtitle: "Today",
      icon: ShoppingCart,
      accent: "primary" as const,
      loading: summaryLoading,
    },
    {
      title: "Total Amount",
      value: formatCurrency(dailySummary?.totalRevenue ?? 0),
      subtitle: "Today's revenue",
      icon: TrendingUp,
      accent: "green" as const,
      loading: summaryLoading,
    },
    {
      title: "Products Sold",
      value: `${totalUnitsSold} units`,
      subtitle: "Total items sold today",
      icon: Package,
      accent: "amber" as const,
      loading: salesLoading,
    },
    {
      title: "Remaining Products",
      value: dashLoading || salesLoading ? "—" : `${remainingProducts} units`,
      subtitle: "Produced − sold today",
      icon: Factory,
      accent: remainingProducts < 20 ? "red" as const : "primary" as const,
      loading: dashLoading || salesLoading,
    },
  ];

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <Button onClick={() => setLocation("/sales")} className="flex-shrink-0">
          <Plus size={15} className="mr-2" />
          New Sale
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {stats.map(s => (
          <KpiCard key={s.title} {...s} />
        ))}
      </div>

      {/* Daily Track */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Daily Sales Track
              </CardTitle>
              <CardDescription>All sales recorded today</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {todaySales.length} transactions
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {salesLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : todaySales.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sales recorded today yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...todaySales].reverse().map((sale, idx) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary text-xs font-bold">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{sale.breadType}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.quantity} units · {format(new Date(sale.saleDate), "HH:mm")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm text-foreground">{formatCurrency(sale.totalAmount)}</p>
                    <Badge
                      variant={sale.paymentMethod === "cash" ? "secondary" : "outline"}
                      className="text-[10px] px-1.5 py-0 capitalize">
                      {sale.paymentMethod}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick access to slips */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <FileText size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Saved Receipts</p>
                <p className="text-xs text-muted-foreground">View and download your past sale slips</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setLocation("/sales")}>
              View Slips
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MANAGER / MD DASHBOARD (unchanged)
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
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Today's overview and weekly performance</p>
      </div>

      {/* Today KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Revenue"    value={formatCurrency(metrics?.todayRevenue ?? 0)}      subtitle="Today" icon={TrendingUp}    loading={metricsLoading} accent="primary" />
          <KpiCard title="Profit"     value={formatCurrency(metrics?.todayProfit ?? 0)}       subtitle="Today" icon={TrendingUp}    loading={metricsLoading} accent="green" />
          <KpiCard title="Sales"      value={`${metrics?.todaySalesCount ?? 0} orders`}        subtitle="Today" icon={ShoppingCart}  loading={metricsLoading} accent="amber" />
          <KpiCard title="Production" value={`${metrics?.todayProduction ?? 0} units`}         subtitle="Net today" icon={Factory}  loading={metricsLoading} accent="primary" />
        </div>
      </div>

      {/* Week KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">This Week</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Weekly Revenue" value={formatCurrency(metrics?.weekRevenue ?? 0)}  subtitle="Last 7 days" icon={TrendingUp}    loading={metricsLoading} accent="primary" />
          <KpiCard title="Weekly Profit"  value={formatCurrency(metrics?.weekProfit ?? 0)}   subtitle="Last 7 days" icon={TrendingUp}    loading={metricsLoading} accent="green" />
          <KpiCard title="Profit Margin"  value={`${metrics?.profitMargin?.toFixed(1) ?? "0.0"}%`} subtitle="This week" icon={Percent} loading={metricsLoading} accent="amber" />
          <KpiCard title="Inventory Alerts" value={`${metrics?.lowStockCount ?? 0} items`} subtitle={metrics?.lowStockCount ? "Low stock" : "All good"} icon={AlertTriangle} loading={metricsLoading} accent={metrics?.lowStockCount ? "red" : "green"} />
        </div>
      </div>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Sales Trend (14 Days)</CardTitle>
          <CardDescription>Revenue and profit over the last 2 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  formatter={(v: number, n: string) => [`₦${v.toLocaleString()}`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Profit"  stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ROOT — role-based routing
   ══════════════════════════════════════════════ */
export default function DashboardPage() {
  const user = getStoredUser();
  if (user?.role === "receptionist") return <ReceptionistDashboard />;
  return <ManagerDashboard />;
}
