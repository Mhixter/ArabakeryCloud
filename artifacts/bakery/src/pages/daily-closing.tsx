import { useEffect, useState } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { getToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Save, Send, CheckCircle2 } from "lucide-react";

type Line = {
  id?: number; productId?: number; productName: string; openingStock: number; produced: number;
  allocated: number; returned: number; recordedSales: number; closingStock: number;
  calculatedSales: number; variance: number; varianceReason?: string | null;
};
type Closing = { id: number; status: "draft" | "submitted" | "approved"; businessDate: string; branchId: number };

export default function DailyClosingPage() {
  const { activeBranch } = useActiveBranch();
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [closing, setClosing] = useState<Closing | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const editable = !closing || closing.status === "draft";
  const totalVariance = lines.reduce((sum, line) => sum + line.variance, 0);

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
              <span><strong>{activeBranch.name}</strong> · {date}. Expected sales are calculated from stock movements; quick sales are not counted as product units.</span>
              {closing && <Badge className="ml-auto" variant={closing.status === "approved" ? "default" : "secondary"}>{closing.status}</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Physical closing count</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loading ? <p className="p-6 text-sm text-muted-foreground">Loading movements…</p> : lines.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No active products are assigned to this branch.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="p-3">Product</th><th className="p-3 text-right">Opening</th><th className="p-3 text-right">Produced</th><th className="p-3 text-right">Allocated</th><th className="p-3 text-right">Known sales</th><th className="p-3 w-[130px]">Physical close</th><th className="p-3 text-right">Expected sales</th><th className="p-3 text-right">Variance</th><th className="p-3 min-w-[190px]">Reason if different</th>
                  </tr></thead>
                  <tbody>{lines.map((line, index) => {
                    const closingStock = Number.isFinite(line.closingStock) ? line.closingStock : 0;
                    const expected = line.openingStock + line.produced + line.returned - line.allocated - closingStock;
                    const variance = expected - line.recordedSales;
                    return <tr key={line.id ?? line.productName} className="border-b last:border-0">
                      <td className="p-3 font-medium">{line.productName}</td>
                      <td className="p-3 text-right">{line.openingStock}</td><td className="p-3 text-right text-emerald-700">+{line.produced}</td><td className="p-3 text-right text-orange-700">-{line.allocated}</td><td className="p-3 text-right">{line.recordedSales}</td>
                      <td className="p-3"><Input type="number" min="0" disabled={!editable} value={line.closingStock} onChange={e => setLines(prev => prev.map((item, i) => i === index ? { ...item, closingStock: Math.max(0, parseInt(e.target.value) || 0), calculatedSales: expected, variance } : item))} /></td>
                      <td className="p-3 text-right font-semibold">{expected}</td><td className={`p-3 text-right font-semibold ${variance === 0 ? "text-emerald-600" : "text-rose-600"}`}>{variance > 0 ? "+" : ""}{variance}</td>
                      <td className="p-3"><Input disabled={!editable || variance === 0} placeholder={variance === 0 ? "No variance" : "Required before submit"} value={line.varianceReason ?? ""} onChange={e => setLines(prev => prev.map((item, i) => i === index ? { ...item, varianceReason: e.target.value } : item))} /></td>
                    </tr>;
                  })}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${totalVariance === 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {totalVariance === 0 ? "Counts match recorded product sales." : `${Math.abs(totalVariance)} unit${Math.abs(totalVariance) === 1 ? "" : "s"} variance requires a reason and approval.`}
            </p>
            <div className="flex gap-2">
              {closing?.status === "submitted" && <Button onClick={approve}><CheckCircle2 size={15} className="mr-2" />Approve reconciliation</Button>}
              {editable && <><Button variant="outline" onClick={() => save(false)} disabled={saving}><Save size={15} className="mr-2" />Save draft</Button><Button onClick={() => save(true)} disabled={saving || !lines.length}><Send size={15} className="mr-2" />Submit closing</Button></>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}