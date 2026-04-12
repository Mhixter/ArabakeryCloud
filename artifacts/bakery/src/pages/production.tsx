import { useState } from "react";
import {
  useListProduction,
  useCreateProduction,
  useListBranches,
  getListProductionQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Factory } from "lucide-react";
import { format } from "date-fns";

const BREAD_TYPES = ["Standard White Loaf", "Whole Wheat Loaf", "Sweet Bread", "Agege Bread", "Coconut Bread", "Other"];

export default function ProductionPage() {
  const user = getStoredUser();
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
      {
        data: {
          breadType: form.breadType,
          quantityProduced: parseInt(form.quantityProduced),
          wasteQuantity: parseInt(form.wasteQuantity || "0"),
          branchId: parseInt(form.branchId),
          notes: form.notes || null,
        },
      },
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

  return (
    <div className="space-y-6" data-testid="page-production">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Production</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Record and track bread production batches</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="button-new-batch">
          <Plus size={16} className="mr-2" />
          Record Batch
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Production Batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !sorted.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Factory size={36} className="mx-auto mb-2 opacity-40" />
              <p>No production batches recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bread Type</TableHead>
                    <TableHead>Produced</TableHead>
                    <TableHead>Waste</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Efficiency</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((batch) => {
                    const efficiency = batch.quantityProduced > 0
                      ? ((batch.quantityProduced - batch.wasteQuantity) / batch.quantityProduced * 100).toFixed(1)
                      : "100.0";
                    const effNum = parseFloat(efficiency);
                    return (
                      <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                        <TableCell>{batch.breadType}</TableCell>
                        <TableCell>{batch.quantityProduced}</TableCell>
                        <TableCell>
                          {batch.wasteQuantity > 0 ? (
                            <span className="text-destructive">{batch.wasteQuantity}</span>
                          ) : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="font-semibold">{batch.netQuantity}</TableCell>
                        <TableCell>
                          <Badge variant={effNum >= 95 ? "default" : effNum >= 80 ? "secondary" : "destructive"} className="text-xs">
                            {efficiency}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{batch.staffName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{batch.branchName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(batch.productionDate), "dd/MM/yy HH:mm")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Production Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Bread Type</Label>
              <Select value={form.breadType} onValueChange={(v) => setForm({ ...form, breadType: v })}>
                <SelectTrigger data-testid="select-batch-bread-type">
                  <SelectValue placeholder="Select bread type" />
                </SelectTrigger>
                <SelectContent>
                  {BREAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity Produced</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.quantityProduced}
                  onChange={(e) => setForm({ ...form, quantityProduced: e.target.value })}
                  data-testid="input-quantity-produced"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Waste / Defective</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.wasteQuantity}
                  onChange={(e) => setForm({ ...form, wasteQuantity: e.target.value })}
                  data-testid="input-waste"
                />
              </div>
            </div>
            {form.quantityProduced && (
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">Net production: </span>
                <span className="font-bold">{Math.max(0, parseInt(form.quantityProduced || "0") - parseInt(form.wasteQuantity || "0"))} loaves</span>
              </div>
            )}
            {branches && branches.length > 1 && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this batch..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createProduction.isPending} data-testid="button-confirm-batch">
              {createProduction.isPending ? "Recording..." : "Record Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
