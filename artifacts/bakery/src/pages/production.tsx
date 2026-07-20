import { useState, useEffect } from "react";
import { useActiveBranch } from "@/lib/branch-context";
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
import { Plus, Factory, TrendingDown, Download, Clock } from "lucide-react";
import { useSubscription } from "@/components/subscription-guard";
import { format } from "date-fns";

import { API_BASE } from "@/lib/api";
import { generatePdf } from "@/lib/pdf";
import { getStoredCompany } from "@/lib/auth";

function todayStr() { return format(new Date(), "yyyy-MM-dd"); }

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

function useProducts() {
  const token = getToken();
  return useQuery<{ id: number; name: string; isActive: boolean }[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch(API_BASE + "/api/products", { headers: { Authorization: `Bearer ${token}` } });
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
  const { activeBranch } = useActiveBranch();
  const branchParam = activeBranch?.id ?? null;
  const [showNew, setShowNew] = useState(false);

  const [form, setForm] = useState({
    breadType: "",
    quantityProduced: "",
    wasteQuantity: "",
    branchId: user?.branchId?.toString() ?? "",
    notes: "",
  });

  useEffect(() => {
    if (activeBranch) {
      setForm(f => ({ ...f, branchId: activeBranch.id.toString() }));
    }
  }, [activeBranch]);

  const [filterDate, setFilterDate] = useState(todayStr());

  const { data: batches, isLoading } = useListProduction({ branchId: branchParam });
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

  /* Filter by selected date (client-side) */
  const visibleBatches = filterDate
    ? sorted.filter(b => b.productionDate.slice(0, 10) === filterDate)
    : sorted;

  /* Stats from visible (filtered) batches */
  const statProduced = visibleBatches.reduce((s, b) => s + b.quantityProduced, 0);
  const statWaste    = visibleBatches.reduce((s, b) => s + b.wasteQuantity, 0);
  const statNet      = statProduced - statWaste;

  const isFilterToday = filterDate === todayStr();
  const filterLabel   = filterDate
    ? (isFilterToday ? "Today" : format(new Date(filterDate + "T12:00:00"), "d MMM yyyy"))
    : "All Time";

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

      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Date:</Label>
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="w-40 h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={isFilterToday ? "default" : "outline"}
            size="sm" className="h-8 text-xs"
            onClick={() => setFilterDate(todayStr())}
          >
            Today
          </Button>
          <Button
            variant={!filterDate ? "default" : "outline"}
            size="sm" className="h-8 text-xs"
            onClick={() => setFilterDate("")}
          >
            All Time
          </Button>
        </div>
        <Badge variant="secondary" className="text-xs">{filterLabel}</Badge>
      </div>

      {/* Stats for selected date */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `Produced — ${filterLabel}`, value: statProduced, unit: "units", icon: Factory, accent: "bg-slate-950" },
          { label: `Net — ${filterLabel}`,      value: statNet,      unit: "units", icon: Factory, accent: "bg-emerald-600" },
          { label: `Waste — ${filterLabel}`,    value: statWaste,    unit: "units", icon: TrendingDown, accent: statWaste > 0 ? "bg-red-500" : "bg-slate-400" },
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                <Factory size={15} className="text-amber-400" />
              </div>
              <CardTitle className="text-sm font-bold tracking-tight">Production Batches</CardTitle>
            </div>
            {visibleBatches.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  const company = getStoredCompany();
                  generatePdf({
                    title: "Production Report",
                    subtitle: filterLabel,
                    companyName: company?.name ?? "Bakery",
                    companyPhone: company?.phone ?? undefined,
                    sections: [{
                      title: `Batches (${visibleBatches.length} records)`,
                      headers: ["Date", "Bread Type", "Produced", "Waste", "Net", "Efficiency", "Staff", "Branch", "Notes"],
                      rows: visibleBatches.map(b => [
                        format(new Date(b.productionDate), "dd/MM/yyyy HH:mm"),
                        b.breadType,
                        b.quantityProduced,
                        b.wasteQuantity,
                        b.netQuantity,
                        b.quantityProduced > 0 ? ((b.netQuantity / b.quantityProduced) * 100).toFixed(1) + "%" : "100%",
                        b.staffName,
                        b.branchName,
                        b.notes ?? "",
                      ]),
                      totals: ["", "", statProduced.toString(), statWaste.toString(), statNet.toString(), "", "", "", ""],
                    }],
                    filename: `production-${filterDate || format(new Date(), "yyyy-MM-dd")}.pdf`,
                  });
                }}>
                <Download size={12} /> Download PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : !visibleBatches.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Factory size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">{filterDate && !isFilterToday ? `No production batches on ${filterLabel}.` : "No production batches recorded yet."}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visibleBatches.map((batch) => {
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
                      <p className="font-semibold text-sm text-foreground truncate">
                        {batch.breadType}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(batch as any).syncStatus === "pending" && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 rounded px-1 border border-amber-200 align-middle">
                            <Clock className="h-2.5 w-2.5" />pending
                          </span>
                        )}
                      </p>
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
            {branches && branches.length > 1 && !user?.branchId && (
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
