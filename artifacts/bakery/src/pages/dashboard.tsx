import { useState, useEffect, useCallback } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingCart, Factory, Package, PackageCheck,
  Plus, FileText, Clock, ArrowUpRight, Layers, ChevronDown, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
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
   SELLER DASHBOARD — daily-only view
   ══════════════════════════════════════════════ */
interface Allocation { id: number; breadType: string; quantity: number; issuedByName: string; allocationDate: string }
interface Sale { id: number; breadType: string; quantity: number; totalAmount: number; paymentMethod: string; saleDate: string; receiptNumber: string }
interface ReturnItem { id: number; breadType: string; quantity: number; reason: string; reasonLabel: string; returnDate: string }

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SellerDashboard() {
  const [, setLocation] = useLocation();
  const [allocations, setAllocations]   = useState<Allocation[]>([]);
  const [allTimeSales, setAllTimeSales] = useState<Sale[]>([]);
  const [todaySales, setTodaySales]     = useState<Sale[]>([]);
  const [returns, setReturns]           = useState<ReturnItem[]>([]);
  const [loading, setLoading]           = useState(true);

  const todayDate = todayIso();

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const startOfDay = `${todayDate}T00:00:00`;
    const endOfDay   = `${todayDate}T23:59:59`;
    Promise.all([
      fetch("/api/allocations", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/sales", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`/api/sales?startDate=${startOfDay}&endDate=${endOfDay}`, { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/returns", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([a, allS, todayS, ret]) => {
      setAllocations(a);
      setAllTimeSales(allS);
      setTodaySales(todayS);
      setReturns(ret);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [todayDate]);

  /* Today's allocations — filter by today's date prefix */
  const todayAllocations = allocations.filter(a => a.allocationDate.startsWith(todayDate));

  /* In Hand per bread type: total_allocated - total_sold_alltime - total_returned */
  const breadTypes = [...new Set(allocations.map(a => a.breadType))];
  const remaining = breadTypes.map(bt => {
    const allocated = allocations.filter(a => a.breadType === bt).reduce((s, a) => s + a.quantity, 0);
    const sold      = allTimeSales.filter(s => s.breadType === bt).reduce((s, x) => s + x.quantity, 0);
    const returned  = returns.filter(r => r.breadType === bt).reduce((s, r) => s + r.quantity, 0);
    return { breadType: bt, allocated, sold, returned, remaining: Math.max(0, allocated - sold - returned) };
  });

  const todayAllocatedUnits = todayAllocations.reduce((s, a) => s + a.quantity, 0);
  const todaySoldUnits = todaySales.reduce((s, s2) => s + s2.quantity, 0);
  const todayRevenue   = todaySales.reduce((s, s2) => s + s2.totalAmount, 0);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(new Date(), "EEEE, d MMMM")}
        subtitle="Your daily allocation and sales"
        action={
          <Button onClick={() => setLocation("/sales")} size="sm">
            <Plus size={14} className="mr-1.5" />
            Record Sale
          </Button>
        }
      />

      {/* Today's KPIs only */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Today's Allocated" value={`${todayAllocatedUnits}`} sub="units given today" icon={PackageCheck} loading={loading} accent="amber" />
        <KpiCard title="In Hand" value={`${Math.max(0, remaining.reduce((s, r) => s + r.remaining, 0))}`} sub="unsold units" icon={Package} loading={loading} accent={remaining.reduce((s, r) => s + r.remaining, 0) <= 5 ? "red" : "default"} />
        <KpiCard title="Today's Sold" value={`${todaySoldUnits}`} sub="units sold today" icon={ShoppingCart} loading={loading} />
        <KpiCard title="Today's Revenue" value={formatCurrency(todayRevenue)} sub="your sales today" icon={TrendingUp} loading={loading} accent="green" />
      </div>

      {/* Remaining by bread type */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <PackageCheck size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">My Bread Stock</CardTitle>
              <CardDescription className="text-xs">Total allocated minus total sold</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : remaining.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <PackageCheck size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No bread allocated to you yet.</p>
              <p className="text-xs mt-1">Ask your receptionist to allocate bread.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {remaining.map(r => {
                const pct = r.allocated > 0 ? Math.round((r.sold / r.allocated) * 100) : 0;
                const low = r.remaining <= 5;
                return (
                  <div key={r.breadType} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-sm text-foreground">{r.breadType}</p>
                      <Badge variant={low ? "destructive" : "secondary"} className="text-xs">{r.remaining} left</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{r.sold}/{r.allocated} sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's sales */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Clock size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Today's Sales</CardTitle>
                <CardDescription className="text-xs">Your transactions today</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">{todaySales.length} txns</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : todaySales.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShoppingCart size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No sales today.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/sales")}>Record a Sale</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {[...todaySales].reverse().map((sale, idx) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{sale.breadType}</p>
                    <p className="text-xs text-muted-foreground">{sale.quantity} units · {format(new Date(sale.saleDate), "HH:mm")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">{formatCurrency(sale.totalAmount)}</p>
                    <Badge variant={sale.paymentMethod === "cash" ? "secondary" : "outline"} className="text-[10px] capitalize mt-0.5">{sale.paymentMethod}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick link to returns */}
      <Card className="rounded-2xl border-0 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setLocation("/allocations")}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 flex items-center justify-center">
              <RotateCcw size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">Return Products</p>
              <p className="text-xs text-muted-foreground">Return unsold or damaged bread</p>
            </div>
          </div>
          <ArrowUpRight size={16} className="text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════
   RECEPTIONIST DASHBOARD — daily allocations + stock
   ══════════════════════════════════════════════ */
function ReceptionistDashboard() {
  const [, setLocation] = useLocation();
  const [stockData, setStockData]  = useState<{ name: string; produced: number; sold: number; remaining: number }[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [returns, setReturns]      = useState<{ id: number; breadType: string; quantity: number; reasonLabel: string; returnDate: string; receptionistName: string | null }[]>([]);
  const [dailySummary, setDailySummary] = useState<{ totalSales: number; cashSales: number; totalUnits: number } | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [todaySales, setTodaySales]     = useState<Sale[]>([]);

  const todayDate = todayIso();

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const startOfDay = `${todayDate}T00:00:00`;
    const endOfDay   = `${todayDate}T23:59:59`;
    setDailyLoading(true);
    setStockLoading(true);
    Promise.all([
      fetch("/api/reports/product-dashboard", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/returns", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`/api/sales?startDate=${startOfDay}&endDate=${endOfDay}`, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([dash, ret, ts]) => {
      if (dash?.remaining) setStockData(dash.remaining);
      setReturns(ret);
      const salesArr = ts as Sale[];
      setTodaySales(salesArr);
      const totalUnits = salesArr.reduce((s: number, x: Sale) => s + x.quantity, 0);
      const cashSales  = salesArr.filter((x: Sale) => x.paymentMethod === "cash").reduce((s: number, x: Sale) => s + x.totalAmount, 0);
      setDailySummary({ totalSales: salesArr.length, cashSales, totalUnits });
    }).catch(() => {}).finally(() => { setStockLoading(false); setDailyLoading(false); });
  }, [todayDate]);

  const todayUnits = dailySummary?.totalUnits ?? 0;
  const pendingReturns = returns.filter(r => !r.receptionistName);
  const todayPendingReturns = pendingReturns.filter(r => r.returnDate.startsWith(todayDate));

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(new Date(), "EEEE, d MMMM")}
        subtitle="Today's activity overview"
        action={
          <Button onClick={() => setLocation("/allocations")} size="sm">
            <Plus size={14} className="mr-1.5" />
            Allocate
          </Button>
        }
      />

      {/* Daily KPIs — no total revenue */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Sales Today" value={`${dailySummary?.totalSales ?? 0}`} sub="orders" icon={ShoppingCart} loading={dailyLoading} />
        <KpiCard title="Units Sold" value={`${todayUnits}`} sub="today" icon={Package} loading={dailyLoading} accent="amber" />
        <KpiCard title="Cash Collected" value={formatCurrency(dailySummary?.cashSales ?? 0)} sub="cash today" icon={TrendingUp} loading={dailyLoading} accent="green" />
        <KpiCard title="Pending Returns" value={`${todayPendingReturns.length}`} sub="from suppliers today" icon={RotateCcw} loading={stockLoading} accent={todayPendingReturns.length > 0 ? "red" : "default"} />
      </div>

      {/* Remaining stock by bread type */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <Factory size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Remaining Stock by Bread Type</CardTitle>
              <CardDescription className="text-xs">Total produced minus allocated and sold</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {stockLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : stockData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No stock data. Log production to begin.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {stockData.map(item => {
                const pct = item.produced > 0 ? Math.round((item.sold / item.produced) * 100) : 0;
                const low = item.remaining < 10;
                return (
                  <div key={item.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                      <Badge variant={low ? "destructive" : "secondary"} className="text-xs">{item.remaining} left</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{item.sold}/{item.produced} sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's sales list */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Clock size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Today's Sales</CardTitle>
                <CardDescription className="text-xs">All transactions today</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">{todaySales.length} txns</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dailyLoading ? (
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

      {/* Pending returns banner */}
      {todayPendingReturns.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm bg-rose-50 cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => setLocation("/allocations")}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500 flex items-center justify-center">
                <RotateCcw size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-rose-800">{todayPendingReturns.length} pending return{todayPendingReturns.length > 1 ? "s" : ""} today</p>
                <p className="text-xs text-rose-600">Sellers returned bread — acknowledge in Allocations</p>
              </div>
            </div>
            <ArrowUpRight size={16} className="text-rose-500" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PRODUCTION STAFF DASHBOARD
   ══════════════════════════════════════════════ */
function ProductionDashboard() {
  const [, setLocation] = useLocation();
  const [stockData, setStockData] = useState<{ name: string; produced: number; sold: number; remaining: number }[]>([]);
  const [todayProduction, setTodayProduction] = useState<{ breadType: string; quantityProduced: number; wasteQuantity: number; productionDate: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const today = format(new Date(), "yyyy-MM-dd");
    Promise.all([
      fetch("/api/reports/product-dashboard", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/production?startDate=${today}T00:00:00&endDate=${today}T23:59:59`, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([dash, prod]) => {
      if (dash?.remaining) setStockData(dash.remaining);
      setTodayProduction(prod);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const todayUnits = todayProduction.reduce((s, p) => s + p.quantityProduced, 0);
  const todayWaste = todayProduction.reduce((s, p) => s + p.wasteQuantity, 0);
  const totalStock = stockData.reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(new Date(), "EEEE, d MMMM")}
        subtitle="Today's production overview"
        action={
          <Button onClick={() => setLocation("/production")} size="sm">
            <Plus size={14} className="mr-1.5" />
            Log Production
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Produced Today" value={`${todayUnits}`} sub="units baked" icon={Factory} loading={loading} accent="amber" />
        <KpiCard title="Waste Today" value={`${todayWaste}`} sub="units wasted" icon={Package} loading={loading} accent={todayWaste > 0 ? "red" : "default"} />
        <KpiCard title="Batches Today" value={`${todayProduction.length}`} sub="production runs" icon={Layers} loading={loading} />
        <KpiCard title="Total In Stock" value={`${totalStock}`} sub="across all types" icon={PackageCheck} loading={loading} accent={totalStock < 20 ? "red" : "green"} />
      </div>

      {/* Stock remaining by bread type */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <Package size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Remaining Bread by Type</CardTitle>
              <CardDescription className="text-xs">Total produced minus sold</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : stockData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No stock data yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {stockData.map(item => {
                const pct = item.produced > 0 ? Math.round((item.sold / item.produced) * 100) : 0;
                const low = item.remaining < 10;
                return (
                  <div key={item.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                      <Badge variant={low ? "destructive" : "secondary"} className="text-xs">{item.remaining} left</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{item.sold}/{item.produced} sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's batches */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Clock size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Today's Production Batches</CardTitle>
                <CardDescription className="text-xs">What was baked today</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">{todayProduction.length} batches</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : todayProduction.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No batches logged today.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/production")}>Log Batch</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {todayProduction.map((batch, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{batch.breadType}</p>
                    <p className="text-xs text-muted-foreground">{batch.quantityProduced} produced · {batch.wasteQuantity} waste</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{batch.quantityProduced - batch.wasteQuantity} net</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MANAGER / MD DASHBOARD
   ══════════════════════════════════════════════ */
interface ProductDashboard {
  activeProductCount: number;
  today: { totalAmount: number; totalQuantity: number; salesCount: number; byProduct: { name: string; quantity: number; amount: number }[] };
  week: { totalAmount: number; totalQuantity: number; salesCount: number; byProduct: { name: string; quantity: number; amount: number }[] };
  remaining: { name: string; produced: number; sold: number; remaining: number }[];
}

interface Branch { id: number; name: string }

function ManagerDashboard() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const isDirector = user?.role === "managing_director";
  const { setActiveBranch, isBranchLocked } = useActiveBranch();

  /* If the user has a fixed branch, pre-select it */
  const userFixedBranchId = user?.branchId ?? null;

  const [period, setPeriod] = useState<"today" | "week">("today");
  const [data, setData] = useState<ProductDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(userFixedBranchId);

  const fetchDashboard = useCallback((branchId: number | null) => {
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const url = `/api/reports/product-dashboard${branchId ? `?branchId=${branchId}` : ""}`;
    setLoading(true);
    fetch(url, { headers, credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    if (isDirector) {
      fetch("/api/branches", { headers, credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then((bs: Branch[]) => setBranches(bs))
        .catch(() => {});
    }
    fetchDashboard(userFixedBranchId);
  }, [isDirector, fetchDashboard, userFixedBranchId]);

  useEffect(() => { fetchDashboard(selectedBranchId); }, [selectedBranchId, fetchDashboard]);

  const periodData = data ? data[period] : null;

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Product sales and stock overview"
        action={
          <Button onClick={() => setLocation("/sales")} size="sm">
            <Plus size={14} className="mr-1.5" />
            New Sale
          </Button>
        }
      />

      {isDirector && !isBranchLocked && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Branch:</span>
          <div className="relative">
            <select
              value={selectedBranchId ?? ""}
              onChange={e => {
                const id = e.target.value ? parseInt(e.target.value) : null;
                setSelectedBranchId(id);
                const branch = id ? branches.find(b => b.id === id) ?? null : null;
                setActiveBranch(branch);
              }}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm font-semibold rounded-xl bg-muted border-0 text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(["today", "week"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${period === p ? "bg-amber-400 text-slate-950" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {p === "today" ? "Today" : "This Week"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Active Products" value={loading ? "—" : `${data?.activeProductCount ?? 0}`} sub="in catalogue" icon={Layers} loading={loading} accent="amber" />
        <KpiCard title={period === "today" ? "Revenue Today" : "Revenue This Week"} value={loading ? "—" : formatCurrency(periodData?.totalAmount ?? 0)} sub={`${periodData?.salesCount ?? 0} orders`} icon={TrendingUp} loading={loading} accent="green" />
        <KpiCard title={period === "today" ? "Units Sold Today" : "Units Sold This Week"} value={loading ? "—" : `${periodData?.totalQuantity ?? 0}`} sub="total units" icon={ShoppingCart} loading={loading} />
        <KpiCard title="Total In Stock" value={loading ? "—" : `${(data?.remaining ?? []).reduce((s, r) => s + r.remaining, 0)}`} sub="across all types" icon={Package} loading={loading} accent={(data?.remaining ?? []).some(r => r.remaining < 10) ? "red" : "default"} />
      </div>

      {/* Sales by product */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <ShoppingCart size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Sold by Product — {period === "today" ? "Today" : "This Week"}</CardTitle>
              <CardDescription className="text-xs">Units and revenue per bread type</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !periodData?.byProduct?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No sales {period === "today" ? "today" : "this week"} yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {periodData.byProduct.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity} units sold</p>
                  </div>
                  <p className="font-bold text-sm flex-shrink-0">{formatCurrency(item.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remaining stock per bread type */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <Factory size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Remaining Bread by Type</CardTitle>
              <CardDescription className="text-xs">Total produced minus total sold</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.remaining?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No products found.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/products")}>Add Products</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {data.remaining.map(item => {
                const pct = item.produced > 0 ? Math.round((item.sold / item.produced) * 100) : 0;
                const low = item.remaining < 10;
                return (
                  <div key={item.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                      <Badge variant={low ? "destructive" : "secondary"} className="text-xs">{item.remaining} left</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{item.sold}/{item.produced} sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setLocation("/production")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center flex-shrink-0">
              <Factory size={16} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Production</p>
              <p className="text-xs text-muted-foreground">Log batches</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setLocation("/allocations")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <PackageCheck size={16} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Allocations</p>
              <p className="text-xs text-muted-foreground">Assign to suppliers</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = getStoredUser();
  if (user?.role === "supplier") return <SellerDashboard />;
  if (user?.role === "receptionist") return <ReceptionistDashboard />;
  if (user?.role === "production_staff") return <ProductionDashboard />;
  return <ManagerDashboard />;
}
