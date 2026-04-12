import { useGetDashboard, useGetSalesTrend } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Factory, Package, AlertTriangle, Percent } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  loading: boolean;
  accent?: "primary" | "green" | "amber" | "red";
}) {
  const accentMap = {
    primary: "bg-primary/10 text-primary",
    green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };
  const iconClass = accentMap[accent ?? "primary"];

  return (
    <Card data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass}`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useGetDashboard({});
  const { data: trend, isLoading: trendLoading } = useGetSalesTrend({ days: 14 });

  const chartData = (trend ?? []).map((p) => ({
    date: format(new Date(p.date), "MMM d"),
    Revenue: p.revenue,
    Profit: p.profit,
    Sales: p.salesCount,
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
          <KpiCard
            title="Revenue"
            value={formatCurrency(metrics?.todayRevenue ?? 0)}
            subtitle="Today"
            icon={TrendingUp}
            loading={metricsLoading}
            accent="primary"
          />
          <KpiCard
            title="Profit"
            value={formatCurrency(metrics?.todayProfit ?? 0)}
            subtitle="Today"
            icon={TrendingUp}
            loading={metricsLoading}
            accent="green"
          />
          <KpiCard
            title="Sales"
            value={`${metrics?.todaySalesCount ?? 0} orders`}
            subtitle="Today"
            icon={ShoppingCart}
            loading={metricsLoading}
            accent="amber"
          />
          <KpiCard
            title="Production"
            value={`${metrics?.todayProduction ?? 0} loaves`}
            subtitle="Net today"
            icon={Factory}
            loading={metricsLoading}
            accent="primary"
          />
        </div>
      </div>

      {/* Week KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">This Week</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Weekly Revenue"
            value={formatCurrency(metrics?.weekRevenue ?? 0)}
            subtitle="Last 7 days"
            icon={TrendingUp}
            loading={metricsLoading}
            accent="primary"
          />
          <KpiCard
            title="Weekly Profit"
            value={formatCurrency(metrics?.weekProfit ?? 0)}
            subtitle="Last 7 days"
            icon={TrendingUp}
            loading={metricsLoading}
            accent="green"
          />
          <KpiCard
            title="Profit Margin"
            value={`${metrics?.profitMargin?.toFixed(1) ?? "0.0"}%`}
            subtitle="This week"
            icon={Percent}
            loading={metricsLoading}
            accent="amber"
          />
          <KpiCard
            title="Inventory Alerts"
            value={`${metrics?.lowStockCount ?? 0} items`}
            subtitle={metrics?.lowStockCount ? "Low stock" : "All good"}
            icon={AlertTriangle}
            loading={metricsLoading}
            accent={metrics?.lowStockCount ? "red" : "green"}
          />
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
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  formatter={(value: number, name: string) => [`₦${value.toLocaleString()}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
