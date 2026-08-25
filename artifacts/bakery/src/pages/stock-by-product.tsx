import { useCallback, useEffect, useState } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { API_BASE } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Factory } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StockRow = {
  name: string;
  produced: number;
  remaining: number;
};

export default function StockByProductPage() {
  const { activeBranch } = useActiveBranch();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBranch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const token = localStorage.getItem("nmb_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const response = await fetch(`${API_BASE}/api/reports/product-dashboard?branchId=${activeBranch.id}`, {
        headers,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not load stock totals");
      const dashboard = await response.json();
      setRows(Array.isArray(dashboard?.remaining) ? dashboard.remaining : []);
    } catch (error) {
      toast({
        title: "Could not load stock totals",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, toast]);

  useEffect(() => { load(); }, [load]);

  const totalProduced = rows.reduce((sum, row) => sum + (row.produced ?? 0), 0);
  const totalInStore = rows.reduce((sum, row) => sum + (row.remaining ?? 0), 0);

  return (
    <div className="space-y-6" data-testid="page-stock-by-product">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Production & In-Store Stock</h1>
        <p className="text-sm text-muted-foreground mt-1">Total production and current in-store stock by product.</p>
        {activeBranch && <p className="text-sm text-muted-foreground mt-2">Branch: <span className="font-semibold text-foreground">{activeBranch.name}</span></p>}
      </div>

      {!activeBranch ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a branch to view stock totals.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-medium text-muted-foreground mb-1.5">Total Production</p>{loading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold">{totalProduced.toLocaleString()}</p>}<p className="text-xs text-muted-foreground mt-1.5">units by product</p></div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><Factory size={18} className="text-white" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-medium text-muted-foreground mb-1.5">Current In Store</p>{loading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold">{totalInStore.toLocaleString()}</p>}<p className="text-xs text-muted-foreground mt-1.5">units available</p></div>
                  <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center"><Package size={18} className="text-amber-400" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold tracking-tight">Stock by Product</CardTitle>
              <CardDescription className="text-xs">Production totals and current in-store quantities</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? <div className="p-4 space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : !rows.length ? (
                <div className="text-center py-10 text-muted-foreground"><Package size={28} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No products found.</p></div>
              ) : (
                <div className="divide-y divide-border/50">
                  {rows.map(row => (
                    <div key={row.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-5 px-4 py-3">
                      <p className="font-semibold text-sm text-foreground">{row.name}</p>
                      <div className="text-right"><p className="text-xs text-muted-foreground">Produced</p><p className="text-sm font-bold tabular-nums">{(row.produced ?? 0).toLocaleString()}</p></div>
                      <div className="text-right min-w-20"><p className="text-xs text-muted-foreground">In store</p><p className="text-sm font-bold tabular-nums">{(row.remaining ?? 0).toLocaleString()}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}