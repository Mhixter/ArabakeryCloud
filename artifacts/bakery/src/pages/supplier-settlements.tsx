import { useCallback, useEffect, useState } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HandCoins, Users, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { BUSINESS_TIMEZONE } from "@/lib/business-date";
import { useToast } from "@/hooks/use-toast";
import { SettleSupplierDialog, type SupplierAllocationItem } from "@/components/settle-supplier-dialog";

function toLocalDateStr(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(d);
}

export default function SupplierSettlementsPage() {
  const { activeBranch } = useActiveBranch();
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [productPrices, setProductPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [settleDialog, setSettleDialog] = useState<{
    open: boolean; sellerId: number; sellerName: string; branchId?: number | null;
    branchName?: string | null; allocationDate?: string | null; allocations: SupplierAllocationItem[];
  }>({ open: false, sellerId: 0, sellerName: "", allocations: [] });

  const load = useCallback(async () => {
    if (!activeBranch) return;
    setLoading(true);
    const headers: HeadersInit = { Authorization: `Bearer ${localStorage.getItem("nmb_token") ?? ""}` };
    try {
      const [allocRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/api/allocations?branchId=${activeBranch.id}`, { headers, credentials: "include" }),
        fetch(`${API_BASE}/api/products`, { headers, credentials: "include" }),
      ]);
      if (!allocRes.ok) throw new Error("Could not load supplier allocations");
      const [allocs, products] = await Promise.all([allocRes.json(), productsRes.ok ? productsRes.json() : []]);
      setAllocations(Array.isArray(allocs) ? allocs : []);
      const prices = new Map<string, number>();
      for (const product of Array.isArray(products) ? products : []) prices.set(product.name, Number(product.pricePerUnit) || 0);
      setProductPrices(prices);
    } catch (error) {
      toast({ title: "Could not load supplier settlements", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, toast]);

  useEffect(() => { load(); }, [load]);
  if (getStoredUser()?.role !== "managing_director") return null;

  const groups = new Map<number, { sellerId: number; sellerName: string; branchName: string; branchId?: number | null; allocations: any[] }>();
  for (const allocation of allocations) {
    if (!allocation.sellerId) continue;
    const group = groups.get(allocation.sellerId) ?? { sellerId: allocation.sellerId, sellerName: allocation.sellerName, branchName: allocation.branchName, branchId: allocation.branchId, allocations: [] };
    group.allocations.push(allocation);
    groups.set(allocation.sellerId, group);
  }
  const activeGroups = Array.from(groups.values()).filter(group => group.allocations.some(allocation => !allocation.isCleared));

  return (
    <div className="space-y-6" data-testid="page-supplier-settlements">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Supplier Stock & Settlements</h1>
        <p className="text-sm text-muted-foreground mt-1">Settle field suppliers, record sales remittances, and clear balances.</p>
      </div>
      {!activeBranch ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a branch to review supplier settlements.</CardContent></Card> : (
        <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white"><HandCoins size={16} /></div><div><CardTitle className="text-sm font-bold tracking-tight">Outstanding supplier balances</CardTitle><CardDescription className="text-xs">Settle one allocation date at a time.</CardDescription></div></div>
              <Badge variant={activeGroups.length > 0 ? "default" : "secondary"} className={activeGroups.length > 0 ? "bg-amber-500 text-white text-xs" : "text-xs"}>{activeGroups.length} Active {activeGroups.length === 1 ? "Supplier" : "Suppliers"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : activeGroups.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground"><CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" /><p className="text-sm font-semibold text-foreground">All suppliers are settled</p><p className="text-xs mt-1">No outstanding bread allocations currently with field suppliers.</p></div>
            ) : <div className="divide-y divide-border/50">{activeGroups.map(group => (
              <div key={group.sellerId} className="px-4 py-4">
                <div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center"><Users size={16} /></div><div><p className="font-bold text-sm">{group.sellerName}</p><p className="text-xs text-muted-foreground">{group.branchName || "All branches"}</p></div><Badge variant="outline" className="ml-auto text-[10px] bg-amber-50 text-amber-700 border-amber-300">{group.allocations.filter(a => !a.isCleared).reduce((sum, a) => sum + a.quantity, 0).toLocaleString()} units outstanding</Badge></div>
                <div className="space-y-2">{Array.from(group.allocations.reduce((dates, allocation) => { const key = toLocalDateStr(new Date(allocation.allocationDate)); const rows = dates.get(key) ?? []; rows.push(allocation); dates.set(key, rows); return dates; }, new Map<string, any[]>())).sort(([a], [b]) => b.localeCompare(a)).map(([dateKey, dateAllocations]) => {
                  const active = dateAllocations.filter(a => !a.isCleared);
                  const byType = dateAllocations.reduce((map, a) => map.set(a.breadType, (map.get(a.breadType) ?? 0) + a.quantity), new Map<string, number>());
                  const totalUnits = dateAllocations.reduce((sum, a) => sum + a.quantity, 0);
                  const totalValue = Array.from(byType.entries()).reduce((sum, [name, quantity]) => sum + (productPrices.get(name) ?? 0) * quantity, 0);
                  return <div key={dateKey} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-semibold">{format(new Date(`${dateKey}T12:00:00`), "dd MMM yyyy")}</p><Badge className="text-[10px]" variant="outline">{active.length ? "Outstanding" : "Settled"}</Badge></div><p className="text-xs text-muted-foreground mt-1">{Array.from(byType.entries()).map(([name, quantity]) => `${quantity}× ${name}`).join(", ")}</p><p className="text-xs text-muted-foreground mt-1">{totalUnits.toLocaleString()} units{totalValue > 0 ? ` · Estimated ₦${totalValue.toLocaleString("en-NG", { maximumFractionDigits: 0 })}` : ""}</p></div>{active.length > 0 && <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 h-8 text-xs" onClick={() => setSettleDialog({ open: true, sellerId: group.sellerId, sellerName: group.sellerName, branchId: group.branchId, branchName: group.branchName, allocationDate: format(new Date(`${dateKey}T12:00:00`), "dd MMM yyyy"), allocations: active })}><HandCoins size={14} /> Settle Date</Button>}</div></div>;
                })}</div>
              </div>
            ))}</div>}
          </CardContent>
        </Card>
      )}
      <SettleSupplierDialog {...settleDialog} onOpenChange={open => setSettleDialog(prev => ({ ...prev, open }))} productPrices={productPrices} onSettled={load} />
    </div>
  );
}