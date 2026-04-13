import { useState } from "react";
import {
  useListProduction, useCreateProduction, useListBranches, getListProductionQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStoredUser, getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Factory, TrendingDown } from "lucide-react";
import { useSubscription } from "@/components/subscription-guard";
import { format } from "date-fns";

function useProducts() {
  const token = getToken();
  return useQuery<{ id: number; name: string; isActive: boolean }[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export default function ProductionPage() {
  const user = getStoredUser();
  const { isExpired } = useSubscription();
  const { data: products } = useProducts();
  const activeProducts = products?.filter(p => p.isActive) ?? [];
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const [form, setForm] = useState({
    breadType: "",
    quantityProduced: "",
    wasteQuantity: "",
    branchId: user?.branchId?.toString() ?? "",
    notes: "",
  });

  const { data: batches, isLoading } = useListProduction({});
  const { data: branches } = useListBranches();
  const createProduction = useCreateProduction();

  const handleCreate = () => {
    if (!form.breadType || !form.quantityProduced || !form.branchId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createProduction.mutate(
      { data: {
        breadType: form.breadType,
        quantityProduced: parseInt(form.quantityProduced),
        wasteQuantity: parseInt(form.wasteQuantity || "0"),
        branchId: parseInt(form.branchId),
        notes: form.notes || null,
      }},
      {
        onSuccess: () => {
          toast({ title: "Production batch recorded" });
          queryClient.invalidateQueries({ queryKey: getListProductionQueryKey({}) });
          setShowNew(false);
          setForm({ breadType: "", quantityProduced: "", wasteQuantity: "", branchId: user?.branchId?.toString() ?? "", notes: "" });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to record batch";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const sorted = [...(batches ?? [])].reverse();

  /* Today's stats */
  const today = new Date().toDateString();
  const todayBatches = sorted.filter(b => new Date(b.productionDate).toDateString() === today);
  const todayProduced = todayBatches.reduce((s, b) => s + b.quantityProduced, 0);
  const todayWaste   = todayBatches.reduce((s, b) => s + b.wasteQuantity, 0);
  const todayNet     = todayProduced - todayWaste;

  return (
    <div className="space-y-6" data-testid="page-production">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Production</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Record and track daily bread batches</p>
        </div>
        <Button onClick={() => setShowNew(true)} size="sm" disabled={isExpired} data-testid="button-new-batch">
          <Plus size={14} className="mr-1.5" />
          Record Batch
        </Button>
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Produced Today", value: todayProduced, unit: "units", icon: Factory, accent: "bg-slate-950" },
          { label: "Net Today",      value: todayNet,      unit: "units", icon: Factory, accent: "bg-emerald-600" },
          { label: "Waste Today",    value: todayWaste,    unit: "units", icon: TrendingDown, accent: todayWaste > 0 ? "bg-red-500" : "bg-slate-400" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="rounded-2xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className={`w-8 h-8 rounded-lg ${s.accent} flex items-center justify-center mb-3`}>
                  <Icon size={15} className="text-white" />
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{isLoading ? "—" : s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Batches list */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <Factory size={15} className="text-amber-400" />
            </div>
            <CardTitle className="text-sm font-bold tracking-tight">Production Batches</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !sorted.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No production batches recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sorted.map((batch) => {
                const eff = batch.quantityProduced > 0
                  ? ((batch.quantityProduced - batch.wasteQuantity) / batch.quantityProduced * 100)
                  : 100;
                const effLabel = eff.toFixed(1) + "%";
                return (
                  <div key={batch.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-batch-${batch.id}`}>
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Factory size={15} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{batch.breadType}</p>
                      <p className="text-xs text-muted-foreground">
                        {batch.staffName} · {batch.branchName} · {format(new Date(batch.productionDate), "dd MMM, HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <div>
                        <p className="font-bold text-sm text-foreground">{batch.netQuantity}<span className="text-xs font-normal text-muted-foreground ml-1">net</span></p>
                        <p className="text-xs text-muted-foreground">{batch.quantityProduced} produced · {batch.wasteQuantity} waste</p>
                      </div>
                      <Badge
                        className="text-[10px]"
                        variant={eff >= 95 ? "default" : eff >= 80 ? "secondary" : "destructive"}>
                        {effLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Batch Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="tracking-tight">Record Production Batch</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Bread Type</Label>
              <Select value={form.breadType} onValueChange={(v) => setForm({ ...form, breadType: v })}>
                <SelectTrigger data-testid="select-batch-bread-type"><SelectValue placeholder="Select bread type" /></SelectTrigger>
                <SelectContent>
                  {activeProducts.length > 0
                    ? activeProducts.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)
                    : <SelectItem value="other" disabled>No products configured — add from Products page</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity Produced</Label>
                <Input type="number" min="0" placeholder="0" value={form.quantityProduced}
                  onChange={(e) => setForm({ ...form, quantityProduced: e.target.value })} data-testid="input-quantity-produced" />
              </div>
              <div className="space-y-1.5">
                <Label>Waste / Defective</Label>
                <Input type="number" min="0" placeholder="0" value={form.wasteQuantity}
                  onChange={(e) => setForm({ ...form, wasteQuantity: e.target.value })} data-testid="input-waste" />
              </div>
            </div>
            {form.quantityProduced && (
              <div className="bg-muted rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Net production</span>
                <span className="font-bold">{Math.max(0, parseInt(form.quantityProduced || "0") - parseInt(form.wasteQuantity || "0"))} units</span>
              </div>
            )}
            {branches && branches.length > 1 && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea placeholder="Any notes about this batch..." value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="textarea-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createProduction.isPending} data-testid="button-confirm-batch">
              {createProduction.isPending ? "Recording…" : "Record Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
