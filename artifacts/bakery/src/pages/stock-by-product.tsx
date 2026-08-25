import { useCallback, useEffect, useState } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { API_BASE } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, Factory, Calculator, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ReconciliationRow = {
  productId: number; name: string; produced: number; waste: number; netProduced: number;
  allocated: number; recordedUnits: number; endingInStore: number; expectedUnits: number;
  expectedValue: number; recordedValue: number; unrecordedValue: number;
};
type Reconciliation = {
  startAt: string; endAt: string; expenses: number;
  total: { produced: number; waste: number; netProduced: number; allocated: number; recordedUnits: number; endingInStore: number; expectedUnits: number; expectedValue: number; recordedValue: number; unrecordedValue: number };
  rows: ReconciliationRow[];
  formulas: { expectedSales: string; unrecorded: string; netExpected: string };
};

const money = (value: number) => `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localDateTime = (date: Date) => `${localDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export default function StockByProductPage() {
  const { activeBranch } = useActiveBranch();
  const { toast } = useToast();
  const now = new Date();
  const [start, setStart] = useState(localDateTime(new Date(now.getFullYear(), now.getMonth(), now.getDate())));
  const [end, setEnd] = useState(localDateTime(now));
  const [report, setReport] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBranch) { setLoading(false); return; }
    setLoading(true);
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const params = new URLSearchParams({ branchId: String(activeBranch.id), startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() });
      const response = await fetch(`${API_BASE}/api/reports/stock-reconciliation?${params}`, { headers, credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load reconciliation");
      setReport(body);
    } catch (error) {
      toast({ title: "Could not load stock reconciliation", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
      setReport(null);
    } finally { setLoading(false); }
  }, [activeBranch?.id, end, start, toast]);

  useEffect(() => { load(); }, [load]);
  const total = report?.total;
  const netExpected = (total?.expectedValue ?? 0) - (report?.expenses ?? 0);
  const recordedNet = (total?.recordedValue ?? 0) - (report?.expenses ?? 0);
  const periodLabel = report ? `${new Date(report.startAt).toLocaleString()} – ${new Date(report.endAt).toLocaleString()}` : "";

  return (
    <div className="space-y-6" data-testid="page-stock-by-product">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Production & Stock Reconciliation</h1>
        <p className="text-sm text-muted-foreground mt-1">Compare recorded activity with expected sales for a selected day or time period.</p>
        {activeBranch && <p className="text-sm text-muted-foreground mt-2">Branch: <span className="font-semibold text-foreground">{activeBranch.name}</span></p>}
      </div>

      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5"><Label className="text-xs">From</Label><Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="h-9 text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs">To</Label><Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="h-9 text-sm" /></div>
            <button onClick={load} className="h-9 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Apply period</button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Times are applied to the selected branch. Date-only operational records use the Africa/Lagos business-day boundary.</p>
        </CardContent>
      </Card>

      {!activeBranch ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a branch to view reconciliation totals.</CardContent></Card> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Total Produced", `${total?.produced ?? 0} units`, Factory],
              ["Total Allocated", `${total?.allocated ?? 0} units`, Package],
              ["Expected Sales", money(total?.expectedValue ?? 0), Calculator],
              ["Expenses", money(report?.expenses ?? 0), AlertTriangle],
            ].map(([label, value, Icon]) => <Card key={String(label)} className="rounded-2xl border-0 shadow-sm"><CardContent className="p-4 flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground mb-1">{label}</p>{loading ? <Skeleton className="h-7 w-20" /> : <p className="text-xl font-bold">{value}</p>}</div><div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center"><Icon size={16} className="text-amber-400" /></div></CardContent></Card>)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Expected Net After Expenses</p><p className="text-lg font-bold mt-1">{money(netExpected)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recorded Net After Expenses</p><p className="text-lg font-bold mt-1">{money(recordedNet)}</p></CardContent></Card>
            <Card className={(total?.unrecordedValue ?? 0) > 0 ? "border-amber-200 bg-amber-50/50" : ""}><CardContent className="p-4"><p className="text-xs text-muted-foreground">Unrecorded / Missing</p><p className="text-lg font-bold mt-1">{money(total?.unrecordedValue ?? 0)}</p><p className="text-[11px] text-muted-foreground mt-1">{total?.expectedUnits ?? 0} expected units − {total?.recordedUnits ?? 0} recorded</p></CardContent></Card>
          </div>

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-bold">Stock by Product</CardTitle><CardDescription className="text-xs">{periodLabel || "Selected period"} · production, allocations, sales, and ending in-store stock</CardDescription></CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div> : !report?.rows.length ? <div className="text-center py-10 text-muted-foreground"><Package size={28} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No stock movements in this period.</p></div> : <div className="divide-y divide-border/50">
                {report.rows.map(row => <div key={row.productId} className="px-4 py-3.5"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-sm">{row.name}</p><Badge variant={row.unrecordedValue > 0 ? "outline" : "secondary"}>{row.unrecordedValue > 0 ? `${money(row.unrecordedValue)} missing` : "Reconciled"}</Badge></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-right"><div><p className="text-[11px] text-muted-foreground">Produced</p><p className="text-sm font-bold">{row.produced}</p></div><div><p className="text-[11px] text-muted-foreground">Allocated</p><p className="text-sm font-bold">{row.allocated}</p></div><div><p className="text-[11px] text-muted-foreground">Expected sales</p><p className="text-sm font-bold">{row.expectedUnits} · {money(row.expectedValue)}</p></div><div><p className="text-[11px] text-muted-foreground">Recorded sales</p><p className="text-sm font-bold">{row.recordedUnits} · {money(row.recordedValue)}</p></div><div><p className="text-[11px] text-muted-foreground">In store</p><p className="text-sm font-bold">{row.endingInStore}</p></div></div></div>)}
              </div>}
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-dashed"><CardContent className="p-4 text-xs text-muted-foreground space-y-1"><p className="font-semibold text-foreground">How this reconciliation works</p><p>Expected sales = {report?.formulas.expectedSales ?? "opening stock + net production + returns − allocations − ending stock"}.</p><p>Unrecorded/missing = {report?.formulas.unrecorded ?? "expected sales value − recorded direct sales value"}.</p><p>Supplier sales are excluded from store-stock depletion. This is a calculated variance only; it does not create a sale or stock adjustment.</p></CardContent></Card>
        </>
      )}
    </div>
  );
}