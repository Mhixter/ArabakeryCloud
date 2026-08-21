import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Candidate = { id: number; name: string; branchId: number | null };
type ReviewItem = {
  id: number;
  transactionType: "production" | "sale" | "allocation" | "return";
  transactionId: number;
  breadType: string;
  candidateCount: number;
  reason: string;
  transaction: { quantity?: number; quantityProduced?: number; returnDate?: string; saleDate?: string; productionDate?: string; allocationDate?: string };
  candidates: Candidate[];
};

const labels: Record<ReviewItem["transactionType"], string> = {
  production: "Production",
  sale: "Sale",
  allocation: "Allocation",
  return: "Return",
};

function headers(): Record<string, string> {
  const token = getToken();
  const result: Record<string, string> = { "Content-Type": "application/json" };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

export default function StockIdentityReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/reports/stock-identity-review`, { headers: headers() });
      if (!response.ok) throw new Error("Could not load the review list.");
      const data = await response.json() as { issues?: ReviewItem[] };
      setItems(data.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the review list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (item: ReviewItem) => {
    const selected = selections[item.id];
    if (!selected) return;
    setSaving(item.id);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/reports/stock-identity-review/${item.transactionType}/${item.transactionId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ productId: Number(selected) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save the product selection.");
      }
      setItems(current => current.filter(candidate => candidate.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the product selection.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="page-stock-identity-review">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Product identity review</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Assign the correct active product to historical stock records.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertTriangle size={16} /><AlertDescription>{error}</AlertDescription></Alert>}
      {loading ? (
        <Card><CardContent className="p-5 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-14 text-center">
          <Check className="mx-auto mb-3 text-green-600" size={28} />
          <p className="font-semibold">All historical records are resolved</p>
          <p className="text-sm text-muted-foreground mt-1">There are no ambiguous product matches waiting for review.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{items.length} record{items.length === 1 ? "" : "s"} need{items.length === 1 ? "s" : ""} a product selection.</p>
          {items.map(item => (
            <Card key={item.id} className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{labels[item.transactionType]} #{item.transactionId}</CardTitle>
                    <CardDescription className="mt-1">Historical name: <span className="font-medium text-foreground">{item.breadType}</span></CardDescription>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {item.candidateCount} active candidates
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-medium">Correct product</label>
                  <Select value={selections[item.id] ?? ""} onValueChange={value => setSelections(current => ({ ...current, [item.id]: value }))}>
                    <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                    <SelectContent>
                      {item.candidates.map(candidate => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.name}{candidate.branchId ? ` · Branch ${candidate.branchId}` : " · All branches"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => resolve(item)} disabled={!selections[item.id] || saving === item.id} className="gap-1.5">
                  <Check size={15} /> {saving === item.id ? "Saving…" : "Save selection"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}