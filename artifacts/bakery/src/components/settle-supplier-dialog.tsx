import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api";
import { HandCoins, Loader2, CheckCircle2, AlertCircle, Building2, PackageCheck } from "lucide-react";

export interface SupplierAllocationItem {
  id: number;
  breadType: string;
  quantity: number;
  unitPrice?: number;
  allocationDate?: string;
  isCleared?: boolean;
}

export interface SettleSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: number;
  sellerName: string;
  agentId?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  allocations: SupplierAllocationItem[];
  productPrices?: Map<string, number>;
  onSettled: (result: any) => void;
}

export function SettleSupplierDialog({
  open,
  onOpenChange,
  sellerId,
  sellerName,
  agentId,
  branchId,
  branchName,
  allocations,
  productPrices,
  onSettled,
}: SettleSupplierDialogProps) {
  const { toast } = useToast();
  const [amountSettled, setAmountSettled] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Group uncleared allocations by breadType
  const uncleared = allocations.filter(a => !a.isCleared);
  const byType = new Map<string, { quantity: number; unitPrice: number; total: number }>();

  for (const a of uncleared) {
    const unitPrice = a.unitPrice ?? (productPrices?.get(a.breadType) ?? 0);
    const prev = byType.get(a.breadType) ?? { quantity: 0, unitPrice, total: 0 };
    prev.quantity += a.quantity;
    prev.unitPrice = unitPrice;
    prev.total = prev.quantity * unitPrice;
    byType.set(a.breadType, prev);
  }

  const items = Array.from(byType.entries()).map(([breadType, d]) => ({
    breadType,
    quantity: d.quantity,
    unitPrice: d.unitPrice,
    total: d.total,
  }));

  const totalCalculatedValue = items.reduce((s, x) => s + x.total, 0);
  const totalUnits = items.reduce((s, x) => s + x.quantity, 0);

  // Initialize amountSettled when dialog opens or allocations change
  useEffect(() => {
    if (open) {
      setAmountSettled(totalCalculatedValue > 0 ? totalCalculatedValue.toString() : "");
      setPaymentMethod("cash");
      setNotes("");
    }
  }, [open, totalCalculatedValue]);

  const parsedAmount = parseFloat(amountSettled) || 0;
  const isDifferentFromCalculated = totalCalculatedValue > 0 && Math.abs(parsedAmount - totalCalculatedValue) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uncleared.length === 0) {
      toast({ title: "No active allocations to settle", variant: "destructive" });
      return;
    }

    if (parsedAmount < 0) {
      toast({ title: "Settled amount cannot be negative", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`${API_BASE}/api/allocations/settle-supplier`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          sellerId,
          amountSettled: parsedAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          branchId: branchId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to settle supplier allocations", variant: "destructive" });
        return;
      }

      toast({
        title: "Settlement Complete!",
        description: `₦${parsedAmount.toLocaleString("en-NG")} credited to sales and ${totalUnits} units cleared for ${sellerName}.`,
      });

      onSettled(data);
      onOpenChange(false);
    } catch {
      toast({ title: "Network error during settlement", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-600 flex items-center justify-center flex-shrink-0">
              <HandCoins size={22} className="text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Settle Supplier</DialogTitle>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{sellerName}</span>
                {agentId ? ` (${agentId})` : ""}
                {branchName ? ` · ${branchName}` : ""}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Allocated Products Breakdown */}
          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Allocated Bread</span>
              <span>{totalUnits} Units Total</span>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">No active allocations found.</p>
            ) : (
              <div className="divide-y divide-border/40 max-h-40 overflow-y-auto">
                {items.map(item => (
                  <div key={item.breadType} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-foreground">{item.breadType}</p>
                      <p className="text-muted-foreground">
                        {item.quantity} units {item.unitPrice > 0 ? `@ ₦${item.unitPrice.toLocaleString("en-NG")}` : ""}
                      </p>
                    </div>
                    <p className="font-bold text-foreground">
                      ₦{item.total.toLocaleString("en-NG", { minimumFractionDigits: 0 })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">Calculated Total</span>
              <span className="font-bold text-foreground text-base">
                ₦{totalCalculatedValue.toLocaleString("en-NG", { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {/* Amount Settled Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="amountSettled" className="text-sm font-semibold">
                Amount Settled (₦) <span className="text-red-500">*</span>
              </Label>
              {totalCalculatedValue > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountSettled(totalCalculatedValue.toString())}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium underline"
                >
                  Use full value (₦{totalCalculatedValue.toLocaleString()})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
                ₦
              </span>
              <Input
                id="amountSettled"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={amountSettled}
                onChange={e => setAmountSettled(e.target.value)}
                className="pl-8 text-base font-bold h-11 focus-visible:ring-amber-400"
                required
              />
            </div>
            {isDifferentFromCalculated && parsedAmount > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle size={12} />
                Settled amount differs from standard value (₦{(parsedAmount - totalCalculatedValue).toLocaleString(undefined, { signDisplay: "always" })}). Sales will be scaled accordingly.
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === "cash"
                    ? "bg-amber-400/15 border-amber-400 text-amber-900 dark:text-amber-200"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <CheckCircle2 size={16} className={paymentMethod === "cash" ? "text-amber-600" : "opacity-0"} />
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("transfer")}
                className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === "transfer"
                    ? "bg-amber-400/15 border-amber-400 text-amber-900 dark:text-amber-200"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <CheckCircle2 size={16} className={paymentMethod === "transfer" ? "text-amber-600" : "opacity-0"} />
                Bank Transfer
              </button>
            </div>
          </div>

          {/* Settlement Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="settlementNotes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Notes / Receipt Reference (optional)
            </Label>
            <Input
              id="settlementNotes"
              type="text"
              placeholder="e.g. Full remittance for morning trip"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5">
            <PackageCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p>
              Confirming this will record <strong>₦{parsedAmount.toLocaleString("en-NG")}</strong> in total sales credited to <span className="font-semibold">{sellerName}</span> and immediately clear <strong>{totalUnits} units</strong> from "With Suppliers".
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-slate-950 hover:bg-slate-800 text-white font-semibold gap-2"
              disabled={submitting || uncleared.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Settling…
                </>
              ) : (
                <>
                  <HandCoins size={16} className="text-amber-400" />
                  Confirm Settlement (₦{parsedAmount.toLocaleString("en-NG")})
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
