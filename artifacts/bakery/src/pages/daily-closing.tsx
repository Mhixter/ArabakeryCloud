import { useEffect, useState } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { getToken, getStoredUser } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Save, CheckCircle2, HandCoins } from "lucide-react";
import { businessDateFor } from "@/lib/business-date";

type Line = {
  id?: number; productId?: number; productName: string; openingStock: number; produced: number;
  allocated: number; returned: number; recordedSales: number; closingStock: number;
  calculatedSales: number; variance: number; counted?: boolean; varianceReason?: string | null;
};
type Closing = {
  id: number; status: "draft" | "submitted" | "approved"; businessDate: string; branchId: number;
  stockSettledAmount?: string | null; stockSettlementPaymentMethod?: "cash" | "transfer" | null; stockSettledAt?: string | null;
};

export default function DailyClosingPage() {
  const { activeBranch } = useActiveBranch();
  const { toast } = useToast();
  const [date, setDate] = useState(businessDateFor());
  const [closing, setClosing] = useState<Closing | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [settlementNotes, setSettlementNotes] = useState("");
  const headers = { Authorization: `Bearer ${getToken() ?? ""}`, "Content-Type": "application/json" };

  async function load() {
    if (!activeBranch) return;
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/daily-closings?branchId=${activeBranch.id}&date=${date}`, { headers });
    const data = await res.json();
    setClosing(data.closing);
    setLines(data.lines ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [activeBranch?.id, date]);

  async function ensureDraft() {
    if (closing) return closing;
    const res = await fetch(`${API_BASE}/api/daily-closings`, {
      method: "POST", headers, body: JSON.stringify({ branchId: activeBranch?.id, businessDate: date }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "Could not start closing");
    const created = await res.json();
    setClosing(created.closing);
    setLines(created.lines ?? []);
    return created.closing as Closing;
  }
  async function save(submit = false) {
    if (!activeBranch) return;
    setSaving(true);
    try {
      const draft = await ensureDraft();
      const res = await fetch(`${API_BASE}/api/daily-closings/${draft.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ submit, lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save closing");
      toast({ title: submit ? "Closing submitted for approval" : "Closing draft saved" });
      await load();
    } catch (error) {
      toast({ title: "Closing not saved", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally { setSaving(false); }
  }
  async function approve() {
    if (!closing) return;
    const res = await fetch(`${API_BASE}/api/daily-closings/${closing.id}/approve`, { method: "PATCH", headers });
    if (!res.ok) { toast({ title: "Could not approve closing", variant: "destructive" }); return; }
    toast({ title: "Closing approved" }); await load();
  }
  async function settleRemainingStock() {
    if (!closing) return;
    const amount = Number(settlementAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: "Enter the amount collected from the manager", variant: "destructive" });
      return;
    }
    setSettling(true);
    try {
      const res = await fetch(`${API_BASE}/api/daily-closings/${closing.id}/settle-stock`, {
        method: "POST",
        headers,
        body: JSON.stringify({ amountSettled: amount, paymentMethod: settlementPaymentMethod, notes: settlementNotes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not settle remaining stock");
      toast({ title: "Remaining stock settled", description: `${data.totalUnits} units were removed from in-store stock. Allocations were not changed.` });
      await load();
    } catch (error) {
      toast({ title: "Stock settlement failed", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally { setSettling(false); }
  }
  const editable = !closing || closing.status === "draft";
  const totalVariance = lines.reduce((sum, line) => sum + (line.counted ? line.variance : 0), 0);
  const isManagingDirector = getStoredUser()?.role === "managing_director";
  const remainingUnits = lines.reduce((sum, line) => sum + (line.counted ? Math.max(0, line.closingStock) : 0), 0);

  return (
    <div className="space-y-6" data-testid="page-daily-closing">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Daily Closing</h1>
          <p className="text-sm text-muted-foreground mt-1">Count physical stock and reconcile expected store sales.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="closing-date" className="text-sm">Business date</Label>
          <Input id="closing-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[150px]" />
        </div>
      </div>
      {!activeBranch && <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a branch to start a closing.</CardContent></Card>}
      {activeBranch && (
        <>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4 flex items-center gap-3 text-sm">
              <ClipboardCheck className="text-amber-600" size={20} />
              <span><strong>{activeBranch.name}</strong> · {date}. Count the stock remaining after production and allocations. Allocations are not changed by this closing.</span>
              {closing && <Badge className="ml-auto" variant={closing.status === "approved" ? "default" : "secondary"}>{closing.status}</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Count remaining stock</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? <p className="p-6 text-sm text-muted-foreground">Loading movements…</p> : lines.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No active products are assigned to this branch.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                     <th className="p-3">Product</th><th className="p-3 w-[180px]">Physical count left</th>
                  </tr></thead>
                  <tbody>{lines.map((line, index) => {
                    const counted = line.counted === true;
                    const closingStock = Number.isFinite(line.closingStock) ? line.closingStock : 0;
                    const expected = counted ? Math.max(0, line.openingStock + line.produced + line.returned - line.allocated - closingStock) : null;
                    const variance = expected === null ? null : expected - line.recordedSales;
                    return <tr key={line.id ?? line.productName} className="border-b last:border-0">
                      <td className="p-3 font-medium">{line.productName}<div className="text-[11px] text-muted-foreground">{line.openingStock} opening · +{line.produced} baked · -{line.allocated} allocated</div></td>
                       <td className="p-3"><Input type="number" min="0" disabled={!editable} placeholder="Enter count" value={counted ? line.closingStock : ""} onChange={e => setLines(prev => prev.map((item, i) => i === index ? { ...item, counted: true, closingStock: Math.max(0, parseInt(e.target.value) || 0), calculatedSales: 0, variance: 0 } : item))} /></td>
                    </tr>;
                  })}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
             <p className="text-sm text-muted-foreground">
               {remainingUnits > 0 ? `${remainingUnits.toLocaleString()} units counted as remaining stock.` : "Enter the physical count for each product."}
            </p>
            <div className="flex gap-2">
              {closing?.status === "submitted" && <Button onClick={approve}><CheckCircle2 size={15} className="mr-2" />Approve reconciliation</Button>}
              {editable && <Button variant="outline" onClick={() => save(false)} disabled={saving || !lines.length}><Save size={15} className="mr-2" />{saving ? "Saving…" : "Save draft"}</Button>}
              {editable && <Button onClick={() => save(true)} disabled={saving || !lines.length}><Save size={15} className="mr-2" />Submit for approval</Button>}
            </div>
          </div>
          {isManagingDirector && closing && (closing.status === "submitted" || closing.status === "approved") && !closing.stockSettledAt && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><HandCoins size={18} className="text-emerald-700" />Settle remaining stock</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Collect the funds from the manager, then settle the {remainingUnits.toLocaleString()} counted units. This does not change allocations.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label htmlFor="closing-settlement-amount">Amount collected (₦)</Label><Input id="closing-settlement-amount" type="number" min="0" step="any" value={settlementAmount} onChange={e => setSettlementAmount(e.target.value)} placeholder="0.00" /></div>
                  <div><Label>Payment method</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={settlementPaymentMethod} onChange={e => setSettlementPaymentMethod(e.target.value as "cash" | "transfer")}><option value="cash">Cash</option><option value="transfer">Bank transfer</option></select></div>
                  <div><Label htmlFor="closing-settlement-notes">Notes</Label><Input id="closing-settlement-notes" value={settlementNotes} onChange={e => setSettlementNotes(e.target.value)} placeholder="Receipt/reference (optional)" /></div>
                </div>
                <Button onClick={settleRemainingStock} disabled={settling || remainingUnits === 0}><HandCoins size={15} className="mr-2" />{settling ? "Settling…" : "Confirm stock settlement"}</Button>
              </CardContent>
            </Card>
          )}
          {closing?.stockSettledAt && <p className="text-sm text-emerald-700 font-medium">Remaining stock settled: ₦{Number(closing.stockSettledAmount ?? 0).toLocaleString()} by the Managing Director. Allocations were unchanged.</p>}
        </>
      )}
    </div>
  );
}