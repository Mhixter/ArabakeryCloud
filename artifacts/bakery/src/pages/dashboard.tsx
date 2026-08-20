import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingCart, Factory, Package, PackageCheck,
  Plus, FileText, Clock, ArrowUpRight, Layers, RotateCcw, Download,
  CheckCircle2, AlertTriangle, Smartphone, Share, HandCoins, Users, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/api";
import { SettleSupplierDialog, type SupplierAllocationItem } from "@/components/settle-supplier-dialog";

/* ── PWA Install Prompt ── */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useInstallPrompt() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsIos(ios);
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (isIos) { setShowIosHint(h => !h); return; }
    if (!deferredRef.current) return;
    await deferredRef.current.prompt();
    const { outcome } = await deferredRef.current.userChoice;
    if (outcome === "accepted") { deferredRef.current = null; setCanInstall(false); }
  };

  return { canInstall: canInstall || (isIos && !isStandalone), install, isIos, isStandalone, showIosHint, setShowIosHint };
}

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* Auto-refreshing current date — updates every 60 s so the UI never shows yesterday's date */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
interface ReturnItem { id: number; breadType: string; quantity: number; reason: string; reasonLabel: string; returnDate: string; status: string }

function SellerDashboard() {
  const [, setLocation] = useLocation();
  const [allocations, setAllocations]   = useState<Allocation[]>([]);
  const [allTimeSales, setAllTimeSales] = useState<Sale[]>([]);
  const [todaySales, setTodaySales]     = useState<Sale[]>([]);
  const [returns, setReturns]           = useState<ReturnItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const { canInstall, install, showIosHint } = useInstallPrompt();

  const now = useNow();
  const todayDate = toLocalDateStr(now);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    /* Convert local-midnight and local-end-of-day to UTC ISO strings so the server
       comparison is timezone-correct regardless of where the server runs. */
    const startOfDay = new Date(`${todayDate}T00:00:00`).toISOString();
    const endOfDay   = new Date(`${todayDate}T23:59:59`).toISOString();
    Promise.all([
      fetch(API_BASE + "/api/allocations", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/sales", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/sales?startDate=${encodeURIComponent(startOfDay)}&endDate=${encodeURIComponent(endOfDay)}`, { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/returns", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([a, allS, todayS, ret]) => {
      setAllocations(a);
      setAllTimeSales(allS);
      setTodaySales(todayS);
      setReturns(ret);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [todayDate]);

  /* Today's allocations — compare local date (not UTC prefix) so timezone-shifted records land on the right day */
  const todayAllocations = allocations.filter(a => toLocalDateStr(new Date(a.allocationDate)) === todayDate);

  /* In Hand per bread type: total_allocated - total_sold_alltime - approved_returned
     Only approved returns reduce stock — pending/rejected don't change the count yet. */
  const approvedReturns = returns.filter(r => r.status === "approved");
  const breadTypes = [...new Set(allocations.map(a => a.breadType))];
  const remaining = breadTypes.map(bt => {
    const allocated = allocations.filter(a => a.breadType === bt).reduce((s, a) => s + a.quantity, 0);
    const sold      = allTimeSales.filter(s => s.breadType === bt).reduce((s, x) => s + x.quantity, 0);
    const returned  = approvedReturns.filter(r => r.breadType === bt).reduce((s, r) => s + r.quantity, 0);
    return { breadType: bt, allocated, sold, returned, remaining: Math.max(0, allocated - sold - returned) };
  });

  const todayAllocatedUnits = todayAllocations.reduce((s, a) => s + a.quantity, 0);
  const todaySoldUnits = todaySales.reduce((s, s2) => s + s2.quantity, 0);
  const todayRevenue   = todaySales.reduce((s, s2) => s + s2.totalAmount, 0);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(now, "EEEE, d MMMM")}
        subtitle="Your daily allocation and sales"
        action={
          <div className="flex items-center gap-2">
            {canInstall && (
              <Button variant="outline" size="sm" onClick={install} title="Install the app">
                <Smartphone size={14} className="mr-1.5" />
                Install
              </Button>
            )}
            <Button onClick={() => setLocation("/sales")} size="sm">
              <Plus size={14} className="mr-1.5" />
              Record Sale
            </Button>
          </div>
        }
      />
      {showIosHint && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
          <Share size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Add to Home Screen on iPhone/iPad</p>
            <p className="text-xs text-blue-700">Tap the <strong>Share</strong> button in Safari, then choose <strong>"Add to Home Screen"</strong>.</p>
          </div>
        </div>
      )}

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
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [returns, setReturns]      = useState<{ id: number; breadType: string; quantity: number; reasonLabel: string; returnDate: string; status: string }[]>([]);
  const [dailySummary, setDailySummary] = useState<{ totalSales: number; cashSales: number; totalUnits: number } | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [todaySales, setTodaySales]     = useState<Sale[]>([]);
  const { canInstall, install, showIosHint } = useInstallPrompt();

  const now = useNow();
  const todayDate = toLocalDateStr(now);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    /* Use UTC-converted timestamps for accurate date filtering on the server */
    const startOfDay = new Date(`${todayDate}T00:00:00`).toISOString();
    const endOfDay   = new Date(`${todayDate}T23:59:59`).toISOString();
    setDailyLoading(true);
    setStockLoading(true);
    Promise.all([
      fetch(API_BASE + "/api/reports/product-dashboard", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(API_BASE + "/api/returns", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/sales?startDate=${encodeURIComponent(startOfDay)}&endDate=${encodeURIComponent(endOfDay)}`, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([dash, ret, ts]) => {
      if (dash?.remaining) {
        setStockData(dash.remaining);
        /* Sum in-store + with-suppliers across all bread types for the Total In Stock KPI */
        const breadTotal = (dash.remaining as { remaining: number; allocated: number }[])
          .reduce((s, r) => s + r.remaining + (r.allocated ?? 0), 0);
        setInventoryTotal(breadTotal);
      }
      setReturns(ret);
      const salesArr = ts as Sale[];
      setTodaySales(salesArr);
      const totalUnits = salesArr.reduce((s: number, x: Sale) => s + x.quantity, 0);
      const cashSales  = salesArr.filter((x: Sale) => x.paymentMethod === "cash").reduce((s: number, x: Sale) => s + x.totalAmount, 0);
      setDailySummary({ totalSales: salesArr.length, cashSales, totalUnits });
    }).catch(() => {}).finally(() => { setStockLoading(false); setDailyLoading(false); });
  }, [todayDate]);

  const todayUnits = dailySummary?.totalUnits ?? 0;
  /* Use status field — pending returns are those awaiting receptionist action */
  const pendingReturns = returns.filter(r => r.status === "pending");
  const todayPendingReturns = pendingReturns.filter(r => toLocalDateStr(new Date(r.returnDate)) === todayDate);

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(now, "EEEE, d MMMM")}
        subtitle="Today's activity overview"
        action={
          <div className="flex items-center gap-2">
            {canInstall && (
              <Button variant="outline" size="sm" onClick={install} title="Install the app">
                <Smartphone size={14} className="mr-1.5" />
                Install
              </Button>
            )}
            <Button onClick={() => setLocation("/allocations")} size="sm">
              <Plus size={14} className="mr-1.5" />
              Allocate
            </Button>
          </div>
        }
      />
      {showIosHint && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
          <Share size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Add to Home Screen on iPhone/iPad</p>
            <p className="text-xs text-blue-700">Tap the <strong>Share</strong> button in Safari, then choose <strong>"Add to Home Screen"</strong>.</p>
          </div>
        </div>
      )}

      {/* Daily KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Sales Today" value={`${dailySummary?.totalSales ?? 0}`} sub="orders" icon={ShoppingCart} loading={dailyLoading} />
        <KpiCard title="Units Sold" value={`${todayUnits}`} sub="today" icon={Package} loading={dailyLoading} accent="amber" />
        <KpiCard title="Cash Collected" value={formatCurrency(dailySummary?.cashSales ?? 0)} sub="cash today" icon={TrendingUp} loading={dailyLoading} accent="green" />
        <KpiCard title="Pending Returns" value={`${todayPendingReturns.length}`} sub="from suppliers today" icon={RotateCcw} loading={stockLoading} accent={todayPendingReturns.length > 0 ? "red" : "default"} />
        <KpiCard title="Total In Stock" value={stockLoading ? "—" : `${inventoryTotal}`} sub="bread units (in store + with suppliers)" icon={Layers} loading={stockLoading} accent={inventoryTotal < 10 ? "red" : "default"} />
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
interface ProdBatch {
  id?: number;
  breadType: string;
  quantityProduced: number;
  wasteQuantity: number;
  netQuantity?: number;
  productionDate: string;
  staffName?: string;
  branchName?: string;
  notes?: string | null;
}

function downloadCSV(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? "").replace(/"/g, '""');
      return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v}"` : v;
    }).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ProductionDashboard() {
  const [, setLocation] = useLocation();
  const [stockData, setStockData] = useState<{ name: string; produced: number; sold: number; remaining: number; allocated: number }[]>([]);
  const [todayBatches, setTodayBatches] = useState<ProdBatch[]>([]);
  const [weekBatches, setWeekBatches] = useState<ProdBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const { canInstall, install, showIosHint } = useInstallPrompt();

  const now = useNow();
  const todayStr = toLocalDateStr(now);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const todayStart = new Date(`${todayStr}T00:00:00`).toISOString();
    const todayEnd   = new Date(`${todayStr}T23:59:59`).toISOString();
    // Week: last 7 days
    const weekStartDate = new Date(now); weekStartDate.setDate(weekStartDate.getDate() - 6);
    const weekStartStr  = toLocalDateStr(weekStartDate);
    const weekStartUtc  = new Date(`${weekStartStr}T00:00:00`).toISOString();
    Promise.all([
      fetch(API_BASE + "/api/reports/product-dashboard", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/production?startDate=${encodeURIComponent(todayStart)}&endDate=${encodeURIComponent(todayEnd)}`, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/production?startDate=${encodeURIComponent(weekStartUtc)}&endDate=${encodeURIComponent(todayEnd)}`, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([dash, today_prod, week_prod]) => {
      if (dash?.remaining) setStockData(dash.remaining);
      setTodayBatches(today_prod);
      setWeekBatches(week_prod);
    }).catch(() => {}).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  /* Today stats */
  const todayProduced = todayBatches.reduce((s, p) => s + p.quantityProduced, 0);
  const todayWaste   = todayBatches.reduce((s, p) => s + p.wasteQuantity, 0);
  const todayNet     = todayProduced - todayWaste;
  const todayEff     = todayProduced > 0 ? Math.round((todayNet / todayProduced) * 100) : 100;

  /* Week stats */
  const weekProduced = weekBatches.reduce((s, p) => s + p.quantityProduced, 0);
  const weekWaste    = weekBatches.reduce((s, p) => s + p.wasteQuantity, 0);
  const weekNet      = weekProduced - weekWaste;

  /* Stock */
  const totalInStore   = stockData.reduce((s, r) => s + r.remaining, 0);
  const totalWithSups  = stockData.reduce((s, r) => s + (r.allocated ?? 0), 0);
  const totalStock     = totalInStore + totalWithSups;
  const lowStockTypes  = stockData.filter(s => s.remaining < 20).length;

  const effBadge = (eff: number) => {
    if (eff >= 95) return { label: "Excellent", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    if (eff >= 85) return { label: "Good", cls: "bg-blue-100 text-blue-700 border-blue-200" };
    if (eff >= 70) return { label: "Fair", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "Poor", cls: "bg-red-100 text-red-700 border-red-200" };
  };

  return (
    <div className="space-y-5" data-testid="page-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{format(now, "EEEE, d MMMM")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Production overview — your shift today</p>
        </div>
        <div className="flex items-center gap-2">
          {canInstall && (
            <Button variant="outline" size="sm" onClick={install} title="Install the app">
              <Smartphone size={14} className="mr-1.5" />
              Install
            </Button>
          )}
          <Button onClick={() => setLocation("/production")} size="sm">
            <Plus size={14} className="mr-1.5" />
            Log Batch
          </Button>
        </div>
      </div>
      {showIosHint && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
          <Share size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Add to Home Screen on iPhone/iPad</p>
            <p className="text-xs text-blue-700">Tap the <strong>Share</strong> button in Safari, then choose <strong>"Add to Home Screen"</strong>.</p>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center mb-3">
              <Factory size={15} className="text-amber-400" />
            </div>
            {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-bold tracking-tight leading-none">{todayProduced}</p>}
            <p className="text-xs text-muted-foreground mt-1">Produced Today</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 size={15} className="text-white" />
            </div>
            {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-bold tracking-tight leading-none">{todayNet}</p>}
            <p className="text-xs text-muted-foreground mt-1">Net Today</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className={`w-8 h-8 rounded-lg ${todayWaste > 0 ? "bg-red-500" : "bg-slate-400"} flex items-center justify-center mb-3`}>
              <AlertTriangle size={15} className="text-white" />
            </div>
            {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-bold tracking-tight leading-none">{todayWaste}</p>}
            <p className="text-xs text-muted-foreground mt-1">Waste Today</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className={`w-8 h-8 rounded-lg ${todayEff >= 90 ? "bg-emerald-600" : todayEff >= 75 ? "bg-amber-500" : "bg-red-500"} flex items-center justify-center mb-3`}>
              <TrendingUp size={15} className="text-white" />
            </div>
            {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-bold tracking-tight leading-none">{todayEff}%</p>}
            <p className="text-xs text-muted-foreground mt-1">Efficiency Today</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's batch list */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Clock size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Today's Batches</CardTitle>
                <CardDescription className="text-xs">{todayBatches.length} production run{todayBatches.length !== 1 ? "s" : ""} logged</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {todayBatches.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                  onClick={() => downloadCSV(todayBatches.map((b, i) => ({
                    "#": i + 1,
                    Time: format(new Date(b.productionDate), "HH:mm"),
                    "Bread Type": b.breadType,
                    Produced: b.quantityProduced,
                    Waste: b.wasteQuantity,
                    Net: b.quantityProduced - b.wasteQuantity,
                    "Efficiency (%)": b.quantityProduced > 0 ? Math.round(((b.quantityProduced - b.wasteQuantity) / b.quantityProduced) * 100) : 100,
                    Notes: b.notes ?? "",
                  })), `batches-${todayStr}.csv`)}>
                  <Download size={12} /> CSV
                </Button>
              )}
              <Badge variant="secondary" className="text-xs">{todayBatches.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : todayBatches.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No batches logged today</p>
              <p className="text-xs mt-1 mb-3">Tap the button above to record your first batch.</p>
              <Button variant="outline" size="sm" onClick={() => setLocation("/production")}>
                <Plus size={13} className="mr-1.5" />Log Batch
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {todayBatches.map((batch, idx) => {
                const net = batch.quantityProduced - batch.wasteQuantity;
                const eff = batch.quantityProduced > 0 ? Math.round((net / batch.quantityProduced) * 100) : 100;
                const eb = effBadge(eff);
                return (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-slate-500">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{batch.breadType}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(batch.productionDate), "HH:mm")} · {batch.quantityProduced} baked · {batch.wasteQuantity} waste
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-foreground">{net}<span className="text-xs font-normal text-muted-foreground ml-1">net</span></p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${eb.cls}`}>{eff}% · {eb.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Week summary bar */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Last 7 Days</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold tracking-tight">{weekProduced}</p>}
              <p className="text-xs text-muted-foreground">Produced</p>
            </div>
            <div>
              {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold tracking-tight text-emerald-600">{weekNet}</p>}
              <p className="text-xs text-muted-foreground">Net</p>
            </div>
            <div>
              {loading ? <Skeleton className="h-6 w-12 mx-auto mb-1" /> : <p className="text-lg font-bold tracking-tight text-red-500">{weekWaste}</p>}
              <p className="text-xs text-muted-foreground">Waste</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock remaining by bread type */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Package size={15} className="text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Remaining Stock</CardTitle>
                <CardDescription className="text-xs">
                  {totalInStore} in store · {totalWithSups} with suppliers
                  {lowStockTypes > 0 ? ` · ${lowStockTypes} type${lowStockTypes > 1 ? "s" : ""} low` : ""}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : stockData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Package size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No stock data yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {stockData.map(item => {
                const withSups   = item.allocated ?? 0;
                const total      = item.remaining + withSups;
                const inStorePct = total > 0 ? Math.round((item.remaining / total) * 100) : 0;
                const supsPct    = total > 0 ? 100 - inStorePct : 0;
                const isLow      = item.remaining < 20;
                return (
                  <div key={item.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground">{item.name}</p>
                        {isLow && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Low</Badge>}
                      </div>
                      <p className="text-sm font-bold text-foreground">{total}<span className="text-xs font-normal text-muted-foreground ml-1">total</span></p>
                    </div>
                    {/* Stacked bar: in-store (amber) vs with-suppliers (slate) */}
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted gap-0.5">
                      {inStorePct > 0 && (
                        <div className={`h-full rounded-l-full ${isLow ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${inStorePct}%` }} />
                      )}
                      {supsPct > 0 && (
                        <div className="h-full rounded-r-full bg-slate-400" style={{ width: `${supsPct}%` }} />
                      )}
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-[11px] text-muted-foreground">{item.remaining} in store</p>
                      <p className="text-[11px] text-muted-foreground">{withSups} with suppliers</p>
                    </div>
                  </div>
                );
              })}
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
  today: { totalAmount: number; totalQuantity: number; salesCount: number; totalExpenses: number; byProduct: { name: string; quantity: number; amount: number }[] };
  week: { totalAmount: number; totalQuantity: number; salesCount: number; totalExpenses: number; byProduct: { name: string; quantity: number; amount: number }[] };
  allTime: { totalAmount: number; totalQuantity: number; salesCount: number };
  remaining: { name: string; produced: number; sold: number; allocated: number; remaining: number }[];
}

function ManagerDashboard() {
  const [, setLocation] = useLocation();
  const { activeBranch } = useActiveBranch();
  const { canInstall, install, showIosHint } = useInstallPrompt();

  const [period, setPeriod] = useState<"today" | "week" | "date">("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [data, setData] = useState<ProductDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventoryTotal, setInventoryTotal] = useState(0);

  /* Supplier settlements state */
  const [allocations, setAllocations] = useState<any[]>([]);
  const [productPrices, setProductPrices] = useState<Map<string, number>>(new Map());
  const [allocLoading, setAllocLoading] = useState(true);
  const [settleDialog, setSettleDialog] = useState<{
    open: boolean;
    sellerId: number;
    sellerName: string;
    agentId?: string | null;
    branchId?: number | null;
    branchName?: string | null;
    allocationDate?: string | null;
    allocations: SupplierAllocationItem[];
  }>({
    open: false,
    sellerId: 0,
    sellerName: "",
    allocations: [],
  });

  const fetchDashboard = useCallback((date?: string) => {
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const params = new URLSearchParams();
    if (activeBranch?.id) params.set("branchId", activeBranch.id.toString());
    if (date) params.set("date", date);
    const qs = params.toString();
    const url = `${API_BASE}/api/reports/product-dashboard${qs ? `?${qs}` : ""}`;
    setLoading(true);
    setAllocLoading(true);
    const allocUrl = activeBranch?.id ? `${API_BASE}/api/allocations?branchId=${activeBranch.id}` : `${API_BASE}/api/allocations`;

    Promise.all([
      fetch(url, { headers, credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(allocUrl, { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/products`, { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ])
      .then(([d, a, prods]) => {
        if (d) {
          setData(d);
          const breadTotal = (d.remaining as { remaining: number; allocated: number }[] ?? [])
            .reduce((s, r) => s + r.remaining + (r.allocated ?? 0), 0);
          setInventoryTotal(breadTotal);
        }
        if (Array.isArray(a)) {
          setAllocations(a);
        }
        if (Array.isArray(prods)) {
          const pm = new Map<string, number>();
          for (const p of prods) {
            pm.set(p.name, parseFloat(p.pricePerUnit as unknown as string) || 0);
          }
          setProductPrices(pm);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setAllocLoading(false);
      });
  }, [activeBranch?.id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* When user picks a custom date, re-fetch */
  useEffect(() => {
    if (period === "date" && customDate) fetchDashboard(customDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDate]);

  const periodData = data ? (period === "date" ? data["today"] : data[period]) : null;
  const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : customDate ? format(new Date(customDate + "T12:00:00"), "d MMM yyyy") : "Selected Date";

  // Group allocations by supplier. Keep settled rows in the group so the
  // dashboard can show date history while only outstanding dates are actions.
  const supplierUnclearedMap = new Map<number, {
    sellerId: number;
    sellerName: string;
    branchName: string;
    branchId?: number | null;
    allocations: any[];
  }>();

  for (const alloc of allocations) {
    if (alloc.sellerId) {
      const prev = supplierUnclearedMap.get(alloc.sellerId) ?? {
        sellerId: alloc.sellerId,
        sellerName: alloc.sellerName,
        branchName: alloc.branchName,
        branchId: alloc.branchId,
        allocations: [],
      };
      prev.allocations.push(alloc);
      supplierUnclearedMap.set(alloc.sellerId, prev);
    }
  }

  const activeSupplierGroups = Array.from(supplierUnclearedMap.values())
    .filter(group => group.allocations.some(alloc => !alloc.isCleared));

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Product sales, stock and supplier overview"
        action={
          <div className="flex items-center gap-2">
            {canInstall && (
              <Button variant="outline" size="sm" onClick={install} title="Install the app on your device">
                <Smartphone size={14} className="mr-1.5" />
                Install App
              </Button>
            )}
            <Button onClick={() => setLocation("/sales")} size="sm">
              <Plus size={14} className="mr-1.5" />
              New Sale
            </Button>
          </div>
        }
      />

      {showIosHint && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
          <Share size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Add to Home Screen on iPhone/iPad</p>
            <p className="text-xs text-blue-700">
              Tap the <Share size={11} className="inline" /> <strong>Share</strong> button at the bottom of Safari, then choose <strong>"Add to Home Screen"</strong>. The app will work like a native app — no App Store needed.
            </p>
          </div>
        </div>
      )}

      {activeBranch && (
        <p className="text-sm text-muted-foreground">
          Branch: <span className="font-semibold text-foreground">{activeBranch.name}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {(["today", "week", "date"] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${period === p ? "bg-amber-400 text-slate-950" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {p === "today" ? "Today" : p === "week" ? "This Week" : "Pick Date"}
          </button>
        ))}
        {period === "date" && (
          <input
            type="date"
            value={customDate}
            max={format(new Date(), "yyyy-MM-dd")}
            onChange={e => setCustomDate(e.target.value)}
            className="text-sm border border-border rounded-xl px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        )}
      </div>

      {/* Stock at a glance — 4 KPIs */}
      {(() => {
        const totalInStore    = (data?.remaining ?? []).reduce((s, r) => s + r.remaining, 0);
        const totalAllocated  = (data?.remaining ?? []).reduce((s, r) => s + (r.allocated ?? 0), 0);
        return (
          <div className="grid grid-cols-2 gap-3">
            <KpiCard title="In Store (Available)" value={loading ? "—" : `${totalInStore}`} sub="units ready to sell/allocate" icon={Package} loading={loading} accent={totalInStore < 10 ? "red" : "default"} />
            <KpiCard title="With Suppliers" value={loading ? "—" : `${totalAllocated}`} sub="units currently allocated" icon={PackageCheck} loading={loading} accent="amber" />
            <KpiCard title="Total In Stock" value={loading ? "—" : `${inventoryTotal}`} sub="in store + with suppliers" icon={Layers} loading={loading} />
            <KpiCard title="Active Products" value={loading ? "—" : `${data?.remaining?.filter(r => r.remaining > 0 || r.allocated > 0).length ?? 0}`} sub="with stock" icon={Layers} loading={loading} accent="amber" />
          </div>
        );
      })()}

      {/* All-time totals — always visible regardless of period */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard title="Total Revenue" value={loading ? "—" : formatCurrency(data?.allTime?.totalAmount ?? 0)} sub="all time" icon={TrendingUp} loading={loading} accent="green" />
        <KpiCard title="Total Orders" value={loading ? "—" : `${data?.allTime?.salesCount ?? 0}`} sub="all time" icon={FileText} loading={loading} accent="amber" />
        <KpiCard title="Total Sold" value={loading ? "—" : `${data?.allTime?.totalQuantity ?? 0}`} sub="units all time" icon={ShoppingCart} loading={loading} />
      </div>

      {/* Period-filtered totals */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard title={`Revenue — ${periodLabel}`} value={loading ? "—" : formatCurrency(periodData?.totalAmount ?? 0)} sub={`${periodData?.salesCount ?? 0} orders`} icon={TrendingUp} loading={loading} accent="green" />
        <KpiCard title={`Units Sold — ${periodLabel}`} value={loading ? "—" : `${periodData?.totalQuantity ?? 0}`} sub="total units sold" icon={ShoppingCart} loading={loading} />
      </div>

      {/* Expenses & Net Profit for period */}
      {periodData && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard title={`Expenses — ${periodLabel}`} value={loading ? "—" : formatCurrency(periodData.totalExpenses ?? 0)} sub="recorded expenses" icon={ArrowUpRight} loading={loading} accent="red" />
          <KpiCard title={`Net — ${periodLabel}`} value={loading ? "—" : formatCurrency((periodData.totalAmount ?? 0) - (periodData.totalExpenses ?? 0))} sub="revenue minus expenses" icon={TrendingUp} loading={loading} accent={(periodData.totalAmount ?? 0) - (periodData.totalExpenses ?? 0) >= 0 ? "green" : "red"} />
        </div>
      )}

      {/* ── SUPPLIER BALANCES & SETTLEMENT SECTION (Director Action) ── */}
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                <HandCoins size={16} />
              </div>
              <div>
                <CardTitle className="text-sm font-bold tracking-tight">Supplier Stock & Settlements</CardTitle>
                <CardDescription className="text-xs">Settle field suppliers, record sales remittances, and clear balances</CardDescription>
              </div>
            </div>
            <Badge variant={activeSupplierGroups.length > 0 ? "default" : "secondary"} className={activeSupplierGroups.length > 0 ? "bg-amber-500 text-white text-xs" : "text-xs"}>
              {activeSupplierGroups.length} Active {activeSupplierGroups.length === 1 ? "Supplier" : "Suppliers"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {allocLoading ? (
            <div className="p-4 space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : activeSupplierGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500 opacity-80" />
              <p className="text-sm font-semibold text-foreground">All suppliers are settled</p>
              <p className="text-xs text-muted-foreground mt-0.5">No outstanding bread allocations currently with field suppliers.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setLocation("/allocations")}>
                View Allocations History
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {activeSupplierGroups.map(group => {
                return (
                  <div key={group.sellerId} className="px-4 py-3.5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center flex-shrink-0">
                        <Users size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{group.sellerName}</p>
                        <p className="text-xs text-muted-foreground">{group.branchName || "All branches"}</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                        {group.allocations.filter(a => !a.isCleared).reduce((s, a) => s + a.quantity, 0)} units outstanding
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {Array.from(
                        group.allocations.reduce((dates, allocation) => {
                          const key = toLocalDateStr(new Date(allocation.allocationDate));
                          const dateRows = dates.get(key) ?? [];
                          dateRows.push(allocation);
                          dates.set(key, dateRows);
                          return dates;
                        }, new Map<string, any[]>())
                      ).sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, dateAllocations]) => {
                        const activeDateAllocations = dateAllocations.filter(a => !a.isCleared);
                        const totalUnits = dateAllocations.reduce((s, a) => s + a.quantity, 0);
                        const outstandingUnits = activeDateAllocations.reduce((s, a) => s + a.quantity, 0);
                        const byType = dateAllocations.reduce((map, a) => {
                          map.set(a.breadType, (map.get(a.breadType) ?? 0) + a.quantity);
                          return map;
                        }, new Map<string, number>());
                        const totalValue = Array.from(byType.entries()).reduce((s, [bt, qty]) => s + (productPrices.get(bt) ?? 0) * qty, 0);
                        return (
                          <div key={dateKey} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold">{format(new Date(`${dateKey}T12:00:00`), "dd MMM yyyy")}</p>
                                  {activeDateAllocations.length === 0 ? (
                                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Settled</Badge>
                                  ) : (
                                    <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200" variant="outline">Outstanding</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {Array.from(byType.entries()).map(([bt, qty]) => `${qty}× ${bt}`).join(", ")}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {totalUnits} units{totalValue > 0 ? ` · Estimated ₦${totalValue.toLocaleString("en-NG", { minimumFractionDigits: 0 })}` : ""}
                                </p>
                              </div>
                              {activeDateAllocations.length > 0 && (
                                <Button
                                  size="sm"
                                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 h-8 text-xs shadow-sm flex-shrink-0"
                                  onClick={() => setSettleDialog({
                                    open: true,
                                    sellerId: group.sellerId,
                                    sellerName: group.sellerName,
                                    branchId: group.branchId,
                                    branchName: group.branchName,
                                    allocationDate: format(new Date(`${dateKey}T12:00:00`), "dd MMM yyyy"),
                                    allocations: activeDateAllocations,
                                  })}
                                >
                                  <HandCoins size={14} /> Settle Date
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales by product */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <ShoppingCart size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Sold by Product — {periodLabel}</CardTitle>
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
              <p className="text-sm">No sales {period === "date" ? `on ${periodLabel}` : period === "today" ? "today" : "this week"} yet.</p>
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

      {/* Remaining stock per bread type — in store vs with suppliers */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <Factory size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Remaining Bread by Type</CardTitle>
              <CardDescription className="text-xs">In-store stock vs with suppliers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !data?.remaining?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No products found.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/products")}>Add Products</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {data.remaining.map(item => {
                const inStore = item.remaining;
                const withSuppliers = item.allocated ?? 0;
                const total = inStore + withSuppliers;
                const inStorePct = total > 0 ? Math.round((inStore / total) * 100) : 0;
                const supplierPct = total > 0 ? Math.round((withSuppliers / total) * 100) : 0;
                const low = inStore < 10;
                return (
                  <div key={item.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                      {low && <Badge variant="destructive" className="text-xs">Low</Badge>}
                    </div>
                    {/* Stacked bar: amber = in store, slate = with suppliers */}
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden mb-1.5">
                      <div className="flex h-full">
                        <div className="bg-amber-400 h-full rounded-l-full" style={{ width: `${inStorePct}%` }} />
                        <div className="bg-slate-400 h-full rounded-r-full" style={{ width: `${supplierPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{inStore} in store</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />{withSuppliers} with suppliers</span>
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

      {/* Settlement Dialog */}
      <SettleSupplierDialog
        open={settleDialog.open}
        onOpenChange={open => setSettleDialog(prev => ({ ...prev, open }))}
        sellerId={settleDialog.sellerId}
        sellerName={settleDialog.sellerName}
        agentId={settleDialog.agentId}
        branchId={settleDialog.branchId}
        branchName={settleDialog.branchName}
        allocationDate={settleDialog.allocationDate}
        allocations={settleDialog.allocations}
        productPrices={productPrices}
        onSettled={() => {
          fetchDashboard();
        }}
      />
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
