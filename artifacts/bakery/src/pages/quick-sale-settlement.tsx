import { useCallback, useEffect, useState } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { getStoredUser, getToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { businessDateFor } from "@/lib/business-date";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HandCoins, CheckCircle2 } from "lucide-react";

type Day = {
  date: string;
  amount: number;
  count: number;
  entries: { id: number; amount: number; paymentMethod: string; recordedBy: string; saleDate: string; notes: string | null }[];
};

type SettlementData = {
  weekStart: string;
  weekEnd: string;
  days: Day[];
  totalAmount: number;
  accepted: { amount: number; paymentMethod: string; acceptedAt: string; stockClearedAt: string | null; stockClearedProducts: number } | null;
};

function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function currency(value: number) {
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function QuickSaleSettlementPage() {
  const { activeBranch } = useActiveBranch();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(mondayOf(businessDateFor()));
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!activeBranch) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/quick-sale-settlements?branchId=${activeBranch.id}&weekStart=${weekStart}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not load Quick Sales");
      setData(result);
    } catch (error) {
      toast({ title: "Could not load weekly Quick Sales", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, weekStart, toast]);

  useEffect(() => { load(); }, [load]);

  async function acceptWeek() {
    if (!data || data.totalAmount <= 0 || (data.accepted?.stockClearedAt)) return;
    setAccepting(true);
    try {
      const res = await fetch(`${API_BASE}/api/quick-sale-settlements/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}`, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId: activeBranch?.id, weekStart, paymentMethod, notes: notes.trim() || undefined }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not accept weekly settlement");
      toast({ title: "Weekly Quick Sale accepted", description: `${currency(result.settlement.amount)} accepted from manager.` });
      await load();
    } catch (error) {
      toast({ title: "Weekly settlement failed", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  }

  if (getStoredUser()?.role !== "managing_director") return null;

  return (
    <div className="space-y-6" data-testid="page-quick-sale-settlement">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Quick Sale Settlement</h1>
        <p className="text-sm text-muted-foreground mt-1">Review manager-recorded Quick Sales and accept the weekly amount collected.</p>
      </div>
      {!activeBranch ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Select a branch to review Quick Sales.</CardContent></Card> : (
        <>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs uppercase tracking-wide text-emerald-800 font-semibold">Selected week</p><p className="font-bold text-emerald-950">{data?.weekStart ?? weekStart} to {data?.weekEnd ?? "—"}</p></div>
              <Input type="date" value={weekStart} max={mondayOf(businessDateFor())} onChange={e => setWeekStart(mondayOf(e.target.value))} className="w-[155px]" />
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Weekly Quick Sales</p><p className="text-2xl font-bold mt-1">{currency(data?.totalAmount ?? 0)}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Recorded entries</p><p className="text-2xl font-bold mt-1">{data?.days.reduce((sum, day) => sum + day.count, 0) ?? 0}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">Weekly status</p><p className="text-2xl font-bold mt-1">{data?.accepted ? "Accepted" : "Unaccepted"}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Quick Sales by day</CardTitle><CardDescription>Only Quick Sales entered by managers are shown here. These entries do not represent bread units.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : data?.days.map(day => (
                <div key={day.date} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{day.date}</p><p className="text-xs text-muted-foreground">{day.count} Quick Sale entr{day.count === 1 ? "y" : "ies"}</p></div><p className="font-bold">{currency(day.amount)}</p></div>
                  {day.entries.length > 0 && <div className="mt-2 space-y-1 border-t pt-2">{day.entries.map(entry => <div key={entry.id} className="flex justify-between text-xs text-muted-foreground"><span>{entry.recordedBy} · {entry.paymentMethod}</span><span>{currency(entry.amount)}</span></div>)}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
           <Card className="border-amber-200">
             <CardHeader><CardTitle className="text-base flex items-center gap-2"><HandCoins size={18} />Accept weekly settlement</CardTitle><CardDescription>Accept the weekly amount and clear all remaining in-store stock for this branch. Supplier allocations remain unchanged.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
               {data?.accepted?.stockClearedAt ? <div className="flex items-center gap-2 text-emerald-700 font-medium"><CheckCircle2 size={18} />Accepted {currency(data.accepted.amount)} by {data.accepted.paymentMethod}; cleared {data.accepted.stockClearedProducts} product stock balances.</div> : (
                <div className="flex flex-wrap items-end gap-3">
                  <div><Label>Payment method</Label><select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as "cash" | "transfer")}><option value="cash">Cash</option><option value="transfer">Transfer</option></select></div>
                  <div><Label htmlFor="weekly-notes">Notes / reference</Label><Input id="weekly-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></div>
                   <Button onClick={acceptWeek} disabled={accepting || !data || data.totalAmount <= 0}><HandCoins size={15} className="mr-2" />{accepting ? "Processing…" : data?.accepted ? "Clear remaining stock" : `Accept ${currency(data?.totalAmount ?? 0)}`}</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}