import { useState, useEffect, useCallback } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { useGetDailySalesSummary, useListSales, useGetDashboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, ShoppingCart, Factory, Package, PackageCheck,
  Plus, FileText, Clock, ArrowUpRight, Layers, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { useLocation } from "wouter";

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

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
   SELLER DASHBOARD
   ══════════════════════════════════════════════ */
interface Allocation {
  id: number;
  breadType: string;
  quantity: number;
  issuedByName: string;
  allocationDate: string;
}

interface Sale {
  id: number;
  breadType: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  saleDate: string;
  receiptNumber: string;
}

function SellerDashboard() {
  const [, setLocation] = useLocation();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch("/api/allocations", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/sales", { headers, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([a, s]) => {
      setAllocations(a);
      setSales(s);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /* Compute remaining per bread type */
  const breadTypes = [...new Set([...allocations.map(a => a.breadType), ...sales.map(s => s.breadType)])];
  const remaining = breadTypes.map(bt => {
    const allocated = allocations.filter(a => a.breadType === bt).reduce((s, a) => s + a.quantity, 0);
    const sold = sales.filter(s => s.breadType === bt).reduce((s2, s) => s2 + s.quantity, 0);
    return { breadType: bt, allocated, sold, remaining: Math.max(0, allocated - sold) };
  });

  const totalAllocated = allocations.reduce((s, a) => s + a.quantity, 0);
  const totalSold = sales.reduce((s, s2) => s + s2.quantity, 0);
  const totalRevenue = sales.reduce((s, s2) => s + s2.totalAmount, 0);
  const todaySales = sales.filter(s => new Date(s.saleDate).toDateString() === new Date().toDateString());

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      <PageHeader
        title={format(new Date(), "EEEE, d MMMM")}
        subtitle="Your bread allocation and sales"
        action={
          <Button onClick={() => setLocation("/sales")} size="sm">
            <Plus size={14} className="mr-1.5" />
            Record Sale
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Total Allocated" value={`${totalAllocated}`} sub="bread units received" icon={PackageCheck} loading={loading} accent="amber" />
        <KpiCard title="In Hand"         value={`${Math.max(0, totalAllocated - totalSold)}`} sub="unsold units" icon={Package} loading={loading} accent={(totalAllocated - totalSold) <= 5 ? "red" : "default"} />
        <KpiCard title="Total Sold"      value={`${totalSold}`} sub="units sold" icon={ShoppingCart} loading={loading} />
        <KpiCard title="Total Revenue"   value={formatCurrency(totalRevenue)} sub="all time" icon={TrendingUp} loading={loading} accent="green" />
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
              <CardDescription className="text-xs">Allocated minus sold per type</CardDescription>
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
                      <Badge variant={low ? "destructive" : "secondary"} className="text-xs">
                        {r.remaining} left
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">
                        {r.sold}/{r.allocated} sold
                      </p>
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
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/sales")}>
                Record a Sale
              </Button>
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
    </div>
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
  const dashToday = (dash as { today?: { produced?: number } } | undefined)?.today;
  const produced = dashToday?.produced ?? 0;
  const remaining = Math.max(0, produced - totalUnits);

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

      <div className="grid grid-cols-2 gap-3">
        <KpiCard title="Total Sales"     value={`${daily?.totalSales ?? 0}`}             sub="orders today"    icon={ShoppingCart} loading={dailyLoading} />
        <KpiCard title="Total Amount"    value={formatCurrency(daily?.totalRevenue ?? 0)} sub="today's revenue" icon={TrendingUp}   loading={dailyLoading} accent="green" />
        <KpiCard title="Units Sold"      value={`${totalUnits}`}                          sub="units today"     icon={Package}      loading={salesLoading} accent="amber" />
        <KpiCard title="Remaining Stock" value={dashLoading || salesLoading ? "—" : `${remaining}`} sub="units left" icon={Factory} loading={dashLoading || salesLoading} accent={remaining < 20 ? "red" : "default"} />
      </div>

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
  const { setActiveBranch } = useActiveBranch();

  const [period, setPeriod] = useState<"today" | "week">("today");
  const [data, setData] = useState<ProductDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const fetchDashboard = useCallback((branchId: number | null) => {
    const token = localStorage.getItem("nmb_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
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
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (isDirector) {
      fetch("/api/branches", { headers, credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then((bs: Branch[]) => setBranches(bs))
        .catch(() => {});
    }
    fetchDashboard(null);
  }, [isDirector, fetchDashboard]);

  useEffect(() => {
    fetchDashboard(selectedBranchId);
  }, [selectedBranchId, fetchDashboard]);

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

      {/* Branch selector for MD */}
      {isDirector && branches.length > 1 && (
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
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      )}

      {/* Period toggle */}
      <div className="flex gap-2">
        {(["today", "week"] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              period === p
                ? "bg-amber-400 text-slate-950"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p === "today" ? "Today" : "This Week"}
          </button>
        ))}
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          title="Active Products"
          value={loading ? "—" : `${data?.activeProductCount ?? 0}`}
          sub="in your catalogue"
          icon={Layers}
          loading={loading}
          accent="amber"
        />
        <KpiCard
          title={period === "today" ? "Amount Today" : "Amount This Week"}
          value={loading ? "—" : formatCurrency(periodData?.totalAmount ?? 0)}
          sub={`${periodData?.salesCount ?? 0} orders`}
          icon={TrendingUp}
          loading={loading}
          accent="green"
        />
        <KpiCard
          title={period === "today" ? "Units Sold Today" : "Units Sold This Week"}
          value={loading ? "—" : `${periodData?.totalQuantity ?? 0}`}
          sub="total units"
          icon={ShoppingCart}
          loading={loading}
        />
        <KpiCard
          title="Total In Stock"
          value={loading ? "—" : `${(data?.remaining ?? []).reduce((s, r) => s + r.remaining, 0)}`}
          sub="across all types"
          icon={Package}
          loading={loading}
          accent={(data?.remaining ?? []).some(r => r.remaining < 10) ? "red" : "default"}
        />
      </div>

      {/* Sales by product */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <ShoppingCart size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">
                Sold by Product — {period === "today" ? "Today" : "This Week"}
              </CardTitle>
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
              <p className="text-sm">No products found. Add products first.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/products")}>
                Add Products
              </Button>
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
                      <Badge variant={low ? "destructive" : "secondary"} className="text-xs">
                        {item.remaining} left
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">
                        {item.sold}/{item.produced} sold
                      </p>
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
              <p className="text-xs text-muted-foreground">Assign to sellers</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = getStoredUser();
  if (user?.role === "seller") return <SellerDashboard />;
  if (user?.role === "receptionist") return <ReceptionistDashboard />;
  return <ManagerDashboard />;
}
