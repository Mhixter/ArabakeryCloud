import { useState, useEffect, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Users, TrendingUp, Package, RotateCcw, Factory,
  Clock, ArrowRight, ShoppingBag, AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { API_BASE } from "@/lib/api";

/* ── Types ── */
type UserSummary = {
  id: number;
  fullName: string;
  role: string;
  agentId?: string | null;
  branchName?: string | null;
  lastActiveAt?: string | null;
  salesCount: number;
  totalRevenue: number;
  totalUnitsSold: number;
  returnsSubmitted: number;
  returnsApproved: number;
  batchesLogged: number;
  totalProduced: number;
  totalWaste: number;
  allocationsIssued: number;
  totalAllocatedUnits: number;
  allocationsReceived: number;
  totalReceivedUnits: number;
  inHandUnits: number;
};

type SaleItem = { id: number; breadType: string; quantity: number; totalAmount: number; paymentMethod: string; saleDate: string; receiptNumber?: string | null };
type ReturnItem = { id: number; breadType: string; quantity: number; reason?: string | null; status: string; returnDate: string };
type BatchItem = { id: number; breadType: string; quantityProduced: number; wasteQuantity: number; productionDate: string };
type AllocItem = { id: number; breadType: string; quantity: number; allocationDate: string };
type LogEntry = { id: number; action: string; entityType: string; details?: string | null; createdAt: string };

type UserDetail = {
  user: { id: number; fullName: string; role: string; agentId?: string | null; branchName?: string | null };
  sales: SaleItem[];
  returns: ReturnItem[];
  approvedReturns: ReturnItem[];
  batches: BatchItem[];
  allocationsIssued: AllocItem[];
  allocationsReceived: AllocItem[];
  recentLogs: LogEntry[];
};

/* ── Helpers ── */
const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  receptionist: "Receptionist",
  supplier: "Supplier",
  production_staff: "Production Staff",
};

const ROLE_COLORS: Record<string, string> = {
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  receptionist: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  supplier: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  production_staff: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const ACTION_COLORS: Record<string, string> = {
  SALE_CREATED: "bg-emerald-100 text-emerald-700",
  RETURN_SUBMITTED: "bg-amber-100 text-amber-700",
  RETURN_APPROVED: "bg-teal-100 text-teal-700",
  RETURN_REJECTED: "bg-red-100 text-red-700",
  INVENTORY_CREATED: "bg-sky-100 text-sky-700",
  INVENTORY_ADJUSTED: "bg-blue-100 text-blue-700",
  PRODUCTION_RECORDED: "bg-violet-100 text-violet-700",
  ALLOCATION_CREATED: "bg-orange-100 text-orange-700",
  LOGIN: "bg-purple-100 text-purple-700",
};

function fmtCurrency(v: number) {
  return "₦" + v.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Supplier detail ── */
function SupplierDetail({ d }: { d: UserDetail }) {
  const totalReturn = d.returns.reduce((s, r) => s + r.quantity, 0);
  const approvedReturn = d.returns.filter(r => r.status === "approved").reduce((s, r) => s + r.quantity, 0);
  const totalReceived = d.allocationsReceived.reduce((s, a) => s + a.quantity, 0);
  const totalSoldUnits = d.sales.reduce((s, x) => s + x.quantity, 0);
  const inHand = Math.max(0, totalReceived - totalSoldUnits - approvedReturn);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total Sales" value={d.sales.length} sub={`${totalSoldUnits} units sold`} />
        <KpiCard label="Revenue" value={fmtCurrency(d.sales.reduce((s,x) => s+x.totalAmount,0))} />
        <KpiCard label="Allocated to Them" value={totalReceived} sub={`${d.allocationsReceived.length} batch${d.allocationsReceived.length !== 1 ? "es" : ""}`} />
        <KpiCard label="In Hand (Unsold)" value={inHand} sub={inHand > 0 ? "units still with supplier" : "fully accounted"} />
        <KpiCard label="Returns Submitted" value={d.returns.length} sub={`${totalReturn} units`} />
        <KpiCard label="Returns Approved" value={d.returns.filter(r=>r.status==="approved").length} sub={`${approvedReturn} units refunded`} />
      </div>
      {d.allocationsReceived.length > 0 && d.sales.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
          This supplier has <span className="font-semibold">{inHand} units</span> in hand but has not recorded any sales yet. Ask them to log their sales through the app.
        </div>
      )}
      {d.sales.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Sales</h4>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {d.sales.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2.5 py-1.5">
                <div>
                  <span className="font-medium">{s.breadType}</span>
                  <span className="text-muted-foreground ml-1.5">×{s.quantity}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{fmtCurrency(s.totalAmount)}</span>
                  <span className="text-muted-foreground ml-2">{format(new Date(s.saleDate), "dd/MM/yy")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Receptionist / Manager detail ── */
function ReceptionistDetail({ d }: { d: UserDetail }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Sales Handled" value={d.sales.length} sub={`${d.sales.reduce((s,x)=>s+x.quantity,0)} units`} />
        <KpiCard label="Revenue Processed" value={fmtCurrency(d.sales.reduce((s,x)=>s+x.totalAmount,0))} />
        <KpiCard label="Allocations Issued" value={d.allocationsIssued.length} sub={`${d.allocationsIssued.reduce((s,a)=>s+a.quantity,0)} units allocated`} />
        <KpiCard label="Returns Approved" value={d.approvedReturns.length} sub={`${d.approvedReturns.reduce((s,r)=>s+r.quantity,0)} units`} />
      </div>
      {d.allocationsIssued.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Allocations</h4>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {d.allocationsIssued.slice(0, 15).map(a => (
              <div key={a.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2.5 py-1.5">
                <span className="font-medium">{a.breadType}</span>
                <div>
                  <span className="font-medium">{a.quantity} units</span>
                  <span className="text-muted-foreground ml-2">{format(new Date(a.allocationDate), "dd/MM/yy")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Production Staff detail ── */
function ProductionDetail({ d }: { d: UserDetail }) {
  const totalProduced = d.batches.reduce((s,b)=>s+b.quantityProduced,0);
  const totalWaste = d.batches.reduce((s,b)=>s+b.wasteQuantity,0);
  const wasteRate = totalProduced > 0 ? ((totalWaste/totalProduced)*100).toFixed(1) : "0";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Batches Logged" value={d.batches.length} />
        <KpiCard label="Total Produced" value={totalProduced.toLocaleString()} sub="loaves" />
        <KpiCard label="Total Waste" value={totalWaste.toLocaleString()} sub="loaves" />
        <KpiCard label="Waste Rate" value={`${wasteRate}%`} sub={totalProduced > 0 ? "of production" : "no data"} />
      </div>
      {d.batches.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Batches</h4>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {d.batches.slice(0, 20).map(b => (
              <div key={b.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2.5 py-1.5">
                <div>
                  <span className="font-medium">{b.breadType}</span>
                  <span className="text-muted-foreground ml-1.5">produced: {b.quantityProduced}</span>
                  {b.wasteQuantity > 0 && <span className="text-red-500 ml-1.5">waste: {b.wasteQuantity}</span>}
                </div>
                <span className="text-muted-foreground">{format(new Date(b.productionDate), "dd/MM/yy")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── User card ── */
function UserCard({ u, onClick }: { u: UserSummary; onClick: () => void }) {
  const stats: { label: string; value: string }[] = [];
  if (u.role === "supplier") {
    stats.push({ label: "Sales", value: u.salesCount.toLocaleString() });
    stats.push({ label: "In Hand", value: u.inHandUnits.toLocaleString() });
    stats.push({ label: "Revenue", value: fmtCurrency(u.totalRevenue) });
  } else if (u.role === "receptionist" || u.role === "manager") {
    stats.push({ label: "Sales Handled", value: u.salesCount.toLocaleString() });
    stats.push({ label: "Allocations", value: u.allocationsIssued.toLocaleString() });
    stats.push({ label: "Returns OK'd", value: u.returnsApproved.toLocaleString() });
  } else if (u.role === "production_staff") {
    stats.push({ label: "Batches", value: u.batchesLogged.toLocaleString() });
    stats.push({ label: "Produced", value: u.totalProduced.toLocaleString() });
    stats.push({ label: "Waste", value: u.totalWaste.toLocaleString() });
  }

  return (
    <Card className="hover:border-amber-400/60 transition-colors cursor-pointer" onClick={onClick} data-testid={`user-card-${u.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{u.fullName}</p>
            {u.agentId && <p className="text-xs text-muted-foreground">{u.agentId}</p>}
            {u.branchName && <p className="text-xs text-muted-foreground">{u.branchName}</p>}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
            {ROLE_LABELS[u.role] ?? u.role}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock size={10} />
            {u.lastActiveAt
              ? formatDistanceToNow(new Date(u.lastActiveAt), { addSuffix: true })
              : "Never active"}
          </div>
          <ArrowRight size={12} className="text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main page ── */
export default function UserActivityPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(API_BASE + "/api/reports/user-activity", { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to load user activity");
      const data = await res.json();
      setUsers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const token = getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/reports/user-activity/${id}`, { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to load user detail");
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { if (selectedId != null) fetchDetail(selectedId); }, [selectedId, fetchDetail]);

  const filtered = roleFilter === "all" ? users : users.filter(u => u.role === roleFilter);
  const roleGroups = ["all", "supplier", "receptionist", "manager", "production_staff"];
  const counts = roleGroups.reduce((acc, r) => {
    acc[r] = r === "all" ? users.length : users.filter(u => u.role === r).length;
    return acc;
  }, {} as Record<string, number>);

  const selectedUser = users.find(u => u.id === selectedId);

  return (
    <div className="space-y-6" data-testid="page-user-activity">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Activity</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Performance metrics and activity for all staff members</p>
      </div>

      {/* Role filter tabs */}
      <div className="flex flex-wrap gap-2">
        {roleGroups.map(r => (
          counts[r] > 0 || r === "all" ? (
            <Button key={r} variant={roleFilter === r ? "default" : "outline"} size="sm" className="h-8 text-xs"
              onClick={() => setRoleFilter(r)}>
              {r === "all" ? "All Staff" : ROLE_LABELS[r] ?? r}
              <span className="ml-1.5 opacity-70">{counts[r]}</span>
            </Button>
          ) : null
        ))}
      </div>

      {/* User grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchUsers}>Retry</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No users found for this role.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => (
            <UserCard key={u.id} u={u} onClick={() => setSelectedId(u.id)} />
          ))}
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={selectedId !== null} onOpenChange={open => { if (!open) { setSelectedId(null); setDetail(null); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b mb-4">
            <SheetTitle className="text-lg font-bold">
              {selectedUser?.fullName ?? "User Detail"}
            </SheetTitle>
            {selectedUser && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[selectedUser.role] ?? ""}`}>
                  {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
                </span>
                {selectedUser.branchName && (
                  <span className="text-xs text-muted-foreground">{selectedUser.branchName}</span>
                )}
                {selectedUser.agentId && (
                  <Badge variant="outline" className="text-xs">{selectedUser.agentId}</Badge>
                )}
              </div>
            )}
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !detail ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Could not load details.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Role-specific stats */}
              {(detail.user.role === "supplier") && <SupplierDetail d={detail} />}
              {(detail.user.role === "receptionist" || detail.user.role === "manager") && <ReceptionistDetail d={detail} />}
              {detail.user.role === "production_staff" && <ProductionDetail d={detail} />}

              {/* Activity log */}
              {detail.recentLogs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Activity</h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {detail.recentLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2.5 text-xs py-1.5 border-b last:border-0">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap flex-shrink-0 ${ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-muted-foreground flex-1 min-w-0 truncate">{log.details ?? log.entityType}</span>
                        <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">{format(new Date(log.createdAt), "dd/MM HH:mm")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
