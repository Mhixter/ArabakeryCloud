import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  PackageCheck,
  RotateCcw,
  Store,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveBranch } from "@/lib/branch-context";
import { API_BASE } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { businessDateFor } from "@/lib/business-date";

interface AllocationRecord {
  id: number;
  sellerId: number;
  sellerName: string;
  productId?: number | null;
  breadType: string;
  quantity: number;
  branchId?: number | null;
  branchName: string;
  issuedByName?: string;
  allocationDate: string;
  createdAt: string;
  isCleared?: boolean;
  clearedAt?: string | null;
  clearedByName?: string | null;
  notes?: string | null;
}

interface SaleRecord {
  id: number;
  cashierId: number;
  cashierRole?: string | null;
  productId?: number | null;
  breadType: string;
  quantity: number;
  branchId?: number | null;
  branchName: string;
  saleDate: string;
  receiptNumber?: string;
}

interface ReturnRecord {
  id: number;
  sellerId: number;
  sellerName?: string;
  productId?: number | null;
  breadType: string;
  quantity: number;
  branchId?: number | null;
  branchName: string;
  reason: string;
  reasonLabel: string;
  status: "pending" | "approved" | "rejected";
  returnDate: string;
  notes?: string | null;
}

interface ActivityData {
  allocations: AllocationRecord[];
  sales: SaleRecord[];
  returns: ReturnRecord[];
}

type MovementKind = "allocation" | "sale" | "return";

interface ProductActivity {
  key: string;
  breadType: string;
  branchName: string;
  allocations: AllocationRecord[];
  sales: SaleRecord[];
  returns: ReturnRecord[];
}

const emptyActivity: ActivityData = { allocations: [], sales: [], returns: [] };

function asArray<T>(value: unknown, resource: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Unexpected ${resource} response`);
  return value as T[];
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const token = localStorage.getItem("nmb_token");
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Could not load ${path}`);
  }
  return response.json() as Promise<T>;
}

function getBusinessDate(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : businessDateFor(parsed);
}

function formatBusinessDate(dateKey: string, withWeekday = false) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return format(date, withWeekday ? "EEEE, dd MMM yyyy" : "dd MMM yyyy");
}

function isDateKey(value: string | null) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizedProductName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function movementMatchesAllocation(
  allocation: AllocationRecord,
  movement: { productId?: number | null; breadType: string; branchId?: number | null },
) {
  if (allocation.branchId != null && movement.branchId != null && allocation.branchId !== movement.branchId) {
    return false;
  }
  if (allocation.productId != null && movement.productId != null) {
    return allocation.productId === movement.productId;
  }
  return normalizedProductName(allocation.breadType) === normalizedProductName(movement.breadType);
}

function getProductKey(record: {
  productId?: number | null;
  breadType: string;
  branchId?: number | null;
}) {
  const identity = record.productId != null
    ? `product-${record.productId}`
    : `name-${normalizedProductName(record.breadType)}`;
  return `${record.branchId ?? "branch-unknown"}:${identity}`;
}

function makeProductActivities(
  allocations: AllocationRecord[],
  sales: SaleRecord[],
  returns: ReturnRecord[],
): ProductActivity[] {
  const groups = new Map<string, ProductActivity>();
  const getOrCreate = (record: {
    productId?: number | null;
    breadType: string;
    branchId?: number | null;
    branchName?: string;
  }) => {
    const key = getProductKey(record);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        breadType: record.breadType,
        branchName: record.branchName ?? "",
        allocations: [],
        sales: [],
        returns: [],
      };
      groups.set(key, group);
    } else if (!group.branchName && record.branchName) {
      group.branchName = record.branchName;
    }
    return group;
  };

  for (const allocation of allocations) getOrCreate(allocation).allocations.push(allocation);
  for (const sale of sales) {
    const group = allocations.find(allocation => movementMatchesAllocation(allocation, sale))
      ? getOrCreate(allocations.find(allocation => movementMatchesAllocation(allocation, sale))!)
      : getOrCreate(sale);
    group.sales.push(sale);
  }
  for (const item of returns) {
    const group = allocations.find(allocation => movementMatchesAllocation(allocation, item))
      ? getOrCreate(allocations.find(allocation => movementMatchesAllocation(allocation, item))!)
      : getOrCreate(item);
    group.returns.push(item);
  }

  return [...groups.values()].sort((a, b) =>
    a.branchName.localeCompare(b.branchName) || a.breadType.localeCompare(b.breadType),
  );
}

function quantityTotal(items: Array<{ quantity: number }>) {
  return items.reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function returnStatusLabel(status: ReturnRecord["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function movementTime(kind: MovementKind, record: AllocationRecord | SaleRecord | ReturnRecord) {
  const value = movementDateValue(kind, record);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    }).format(date);
}

function movementDateValue(kind: MovementKind, record: AllocationRecord | SaleRecord | ReturnRecord) {
  return kind === "allocation"
    ? (record as AllocationRecord).createdAt || (record as AllocationRecord).allocationDate
    : kind === "sale"
      ? (record as SaleRecord).saleDate
      : (record as ReturnRecord).returnDate;
}

function ActivityLoading() {
  return (
    <div className="space-y-4" aria-label="Loading supplier activity">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

export default function SupplierAllocationActivityPage() {
  const params = useParams<{ sellerId: string; date?: string }>();
  const sellerId = Number(params.sellerId);
  const dateKey = params.date ?? null;
  const user = getStoredUser();
  const { activeBranch } = useActiveBranch();
  const isSupplier = user?.role === "supplier";
  const canView = Number.isInteger(sellerId) && sellerId > 0 && (!isSupplier || Number(user?.id) === sellerId);
  const validDate = isDateKey(dateKey);
  const [data, setData] = useState<ActivityData>(emptyActivity);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    if (!canView || !validDate) {
      setLoading(false);
      return () => controller.abort();
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const branchQuery = activeBranch?.id
          ? `?${new URLSearchParams({ branchId: String(activeBranch.id) })}`
          : "";
        const [allAllocations, allReturns] = await Promise.all([
          getJson<unknown>(`/api/allocations${branchQuery}`, controller.signal),
          getJson<unknown>(`/api/returns${branchQuery}`, controller.signal),
        ]);
        const allocations = asArray<AllocationRecord>(allAllocations, "allocations")
          .filter(allocation => Number(allocation.sellerId) === sellerId);
        const returns = asArray<ReturnRecord>(allReturns, "returns")
          .filter(item => Number(item.sellerId) === sellerId);

        const allocationDates = allocations.map(item => getBusinessDate(item.allocationDate)).filter(Boolean).sort();
        const startDate = dateKey ?? allocationDates[0] ?? businessDateFor();
        const endDate = dateKey ?? [businessDateFor(), allocationDates.at(-1) ?? businessDateFor()].sort().at(-1)!;
        const salesQuery = new URLSearchParams({ startDate, endDate });
        if (activeBranch?.id) salesQuery.set("branchId", String(activeBranch.id));
        const allSales = await getJson<unknown>(`/api/sales?${salesQuery}`, controller.signal);
        const sales = asArray<SaleRecord>(allSales, "sales")
          .filter(sale => Number(sale.cashierId) === sellerId);

        setData({ allocations, sales, returns });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load supplier activity");
        setData(emptyActivity);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [activeBranch?.id, canView, dateKey, sellerId, validDate]);

  const supplierAllocations = useMemo(() => data.allocations.filter(item =>
    !dateKey || getBusinessDate(item.allocationDate) === dateKey,
  ), [data.allocations, dateKey]);
  const supplierSales = useMemo(() => data.sales.filter(item =>
    !dateKey || getBusinessDate(item.saleDate) === dateKey,
  ), [data.sales, dateKey]);
  const supplierReturns = useMemo(() => data.returns.filter(item =>
    !dateKey || getBusinessDate(item.returnDate) === dateKey,
  ), [data.returns, dateKey]);
  const supplierName = data.allocations[0]?.sellerName
    ?? data.returns[0]?.sellerName
    ?? (isSupplier ? user?.fullName : null)
    ?? `Supplier #${sellerId}`;
  const productActivities = useMemo(
    () => makeProductActivities(supplierAllocations, supplierSales, supplierReturns),
    [supplierAllocations, supplierSales, supplierReturns],
  );
  const dayKeys = useMemo(() => {
    const keys = new Set([
      ...data.allocations.map(item => getBusinessDate(item.allocationDate)),
      ...data.sales.map(item => getBusinessDate(item.saleDate)),
      ...data.returns.map(item => getBusinessDate(item.returnDate)),
    ].filter(Boolean));
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [data]);

  if (loading) return <ActivityLoading />;

  if (!canView || !validDate) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-8 text-center">
          <CircleAlert className="mx-auto mb-3 text-amber-600" size={24} />
          <h1 className="font-semibold">{!validDate ? "Invalid business date" : "Supplier activity unavailable"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSupplier ? "You can only view your own supplier activity." : "Check the supplier link and try again."}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={isSupplier ? `/allocations/suppliers/${user?.id}` : "/allocations"}>Back to allocations</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-8 text-center">
          <CircleAlert className="mx-auto mb-3 text-red-600" size={24} />
          <h1 className="font-semibold">Could not load supplier activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/allocations">Back to allocations</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (dateKey) {
    const allocatedUnits = quantityTotal(supplierAllocations);
    const soldUnits = quantityTotal(supplierSales);
    const returnedUnits = quantityTotal(supplierReturns);
    const outstandingCount = supplierAllocations.filter(item => !item.isCleared).length;

    return (
      <div className="space-y-5" data-testid="supplier-date-activity">
        <div className="rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-lg shadow-slate-950/10 sm:px-6">
          <Link
            href={`/allocations/suppliers/${sellerId}`}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft size={15} /> Back to {supplierName}
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">Supplier activity</p>
              <h1 className="text-2xl font-bold tracking-tight text-white">{formatBusinessDate(dateKey, true)}</h1>
              <p className="mt-1 text-sm text-slate-300">{supplierName} · Business date</p>
            </div>
            <Badge variant="outline" className={outstandingCount
              ? "border-amber-300/50 bg-amber-400/10 text-amber-200"
              : "border-emerald-300/50 bg-emerald-400/10 text-emerald-200"}>
              {supplierAllocations.length === 0 ? "No allocations" : outstandingCount ? "Outstanding" : "Cleared"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard label="Allocated" value={allocatedUnits} icon={<PackageCheck size={16} />} tone="amber" />
          <MetricCard label="Supplier sales" value={soldUnits} icon={<ArrowUpRight size={16} />} tone="blue" />
          <MetricCard label="Returns submitted" value={returnedUnits} icon={<RotateCcw size={16} />} tone="violet" />
        </div>

        {productActivities.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-8 text-center">
              <CalendarDays className="mx-auto mb-3 text-muted-foreground" size={22} />
              <p className="font-semibold">No activity recorded for this date</p>
              <p className="mt-1 text-sm text-muted-foreground">There are no allocations, supplier sales, or returns for this business date.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-bold">Product movements</h2>
              <p className="text-sm text-muted-foreground">Allocation clearing is shown separately from sales and returns.</p>
            </div>
            {productActivities.map(activity => (
              <ProductActivityCard key={activity.key} activity={activity} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="supplier-activity">
      <div className="rounded-2xl bg-slate-950 px-5 py-5 text-white shadow-lg shadow-slate-950/10 sm:px-6">
        <Link href="/allocations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-300 transition-colors hover:text-white">
          <ArrowLeft size={15} /> Supplier allocations
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">Supplier account activity</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">{supplierName}</h1>
            <p className="mt-1 text-sm text-slate-300">Allocations, sales, and returns by business date</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users size={15} />
            <span>{dayKeys.length} active date{dayKeys.length === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>

      {dayKeys.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center">
            <CalendarDays className="mx-auto mb-3 text-muted-foreground" size={22} />
            <p className="font-semibold">No supplier activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Allocations, supplier sales, and returns will appear here by business date.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dayKeys.map(day => {
            const allocations = data.allocations.filter(item => getBusinessDate(item.allocationDate) === day);
            const sales = data.sales.filter(item => getBusinessDate(item.saleDate) === day);
            const returns = data.returns.filter(item => getBusinessDate(item.returnDate) === day);
            const outstandingCount = allocations.filter(item => !item.isCleared).length;
            const branchNames = [...new Set(allocations.map(item => item.branchName).filter(Boolean))];

            return (
              <Link
                key={day}
                href={`/allocations/suppliers/${sellerId}/${day}`}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                data-testid={`supplier-activity-date-${day}`}
              >
                <Card className="rounded-2xl border-border/70 shadow-sm transition-colors hover:border-amber-300 hover:bg-muted/20">
                  <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${outstandingCount ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      <CalendarDays size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold sm:text-base">{formatBusinessDate(day)}</h2>
                        <Badge variant="outline" className={outstandingCount
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : allocations.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground"}>
                          {allocations.length === 0 ? "Activity only" : outstandingCount ? "Outstanding" : "Cleared"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {branchNames.length > 0 && <span className="inline-flex items-center gap-1"><Building2 size={11} />{branchNames.join(", ")}</span>}
                        <span>{allocations.length} allocation{allocations.length === 1 ? "" : "s"} · {sales.length} sale{sales.length === 1 ? "" : "s"} · {returns.length} return{returns.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{quantityTotal(allocations)} allocated</p>
                        <p className="text-xs text-muted-foreground">{quantityTotal(sales)} sold · {quantityTotal(returns)} returned</p>
                      </div>
                      <ArrowDownRight size={16} className="rotate-[-45deg] text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: "amber" | "blue" | "violet";
}) {
  const toneClasses = {
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold">{value} <span className="text-xs font-medium text-muted-foreground">units</span></p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductActivityCard({ activity }: { activity: ProductActivity }) {
  const movements: Array<{
    id: string;
    kind: MovementKind;
    title: string;
    quantity: number;
    timestamp: string;
    sortAt: number;
    detail?: string;
    status?: string;
    settled?: boolean;
  }> = [
    ...activity.allocations.map(item => ({
      id: `allocation-${item.id}`,
      kind: "allocation" as const,
      title: "Allocated",
      quantity: item.quantity,
      timestamp: movementTime("allocation", item),
      sortAt: Date.parse(movementDateValue("allocation", item)) || 0,
      detail: item.issuedByName ? `Issued by ${item.issuedByName}` : undefined,
      status: item.isCleared ? "Cleared" : "Open",
      settled: Boolean(item.isCleared),
    })),
    ...activity.sales.map(item => ({
      id: `sale-${item.id}`,
      kind: "sale" as const,
      title: "Supplier sale",
      quantity: item.quantity,
      timestamp: movementTime("sale", item),
      sortAt: Date.parse(movementDateValue("sale", item)) || 0,
      detail: item.receiptNumber ? `Receipt ${item.receiptNumber}` : undefined,
    })),
    ...activity.returns.map(item => ({
      id: `return-${item.id}`,
      kind: "return" as const,
      title: "Return",
      quantity: item.quantity,
      timestamp: movementTime("return", item),
      sortAt: Date.parse(movementDateValue("return", item)) || 0,
      detail: item.reasonLabel || item.reason.replaceAll("_", " "),
      status: returnStatusLabel(item.status),
    })),
  ].sort((a, b) => a.sortAt - b.sortAt);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Store size={15} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold">{activity.breadType}</h3>
            {activity.branchName && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Building2 size={10} />{activity.branchName}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{quantityTotal(activity.allocations)} allocated</Badge>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{quantityTotal(activity.sales)} sold</Badge>
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">{quantityTotal(activity.returns)} returned</Badge>
        </div>
      </div>
      <CardContent className="p-0">
        {movements.map(movement => {
          const icon = movement.kind === "allocation"
            ? movement.settled ? <CheckCircle2 size={14} /> : <PackageCheck size={14} />
            : movement.kind === "sale" ? <ArrowUpRight size={14} /> : <RotateCcw size={14} />;
          const iconClasses = movement.kind === "allocation"
            ? movement.settled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            : movement.kind === "sale" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700";

          return (
            <div key={movement.id} className="flex items-center gap-3 border-b border-border/40 px-4 py-3 last:border-0">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClasses}`}>{icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold">{movement.title}</p>
                  {movement.status && (
                    <Badge variant="outline" className={`px-1.5 py-0 text-[10px] ${
                      movement.status === "Approved" || movement.status === "Cleared"
                        ? "border-emerald-200 text-emerald-700"
                        : movement.status === "Rejected"
                          ? "border-red-200 text-red-700"
                          : "border-amber-200 text-amber-700"
                    }`}>{movement.status}</Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {movement.detail ? `${movement.detail} · ` : ""}{movement.timestamp}
                </p>
              </div>
              <p className="whitespace-nowrap text-sm font-bold">
                {movement.kind === "sale" ? "−" : movement.kind === "return" ? "↩ " : "+"}{movement.quantity}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}