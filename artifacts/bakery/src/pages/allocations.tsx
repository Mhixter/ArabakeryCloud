import { useState, useEffect, useCallback } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PackageCheck, Plus, X, ChevronDown, Users, Calendar, RotateCcw, AlertCircle, Download,
  ArrowLeft, Building2, ChevronRight, CheckCircle2, HandCoins,
} from "lucide-react";
import { format } from "date-fns";
import { getStoredUser, getStoredCompany } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { API_BASE } from "@/lib/api";
import { generatePdf } from "@/lib/pdf";
import { SettleSupplierDialog, type SupplierAllocationItem } from "@/components/settle-supplier-dialog";

function formatDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

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

interface Allocation {
  id: number;
  breadType: string;
  quantity: number;
  sellerName: string;
  sellerId?: number;
  issuedByName: string;
  branchName: string;
  notes: string | null;
  isCleared?: boolean;
  clearedAt?: string | null;
  clearedByName?: string | null;
  allocationDate: string;
  createdAt: string;
}

interface Return {
  id: number;
  breadType: string;
  quantity: number;
  reason: string;
  reasonLabel: string;
  notes: string | null;
  sellerName: string;
  receptionistName: string | null;
  approvedByName: string | null;
  status: "pending" | "approved" | "rejected";
  returnDate: string;
}

interface StockItem { name: string; remaining: number }
interface Seller { id: number; fullName: string; agentId: string }
interface Product { id: number; name: string; isActive: boolean }

const RETURN_REASONS = [
  { value: "not_sold", label: "Not Sold" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "other", label: "Other" },
];

/* ── Return Product Form (for suppliers) ── */
function ReturnForm({ onClose, onCreated }: { onClose: () => void; onCreated: (r: Return) => void }) {
  const [myAllocations, setMyAllocations] = useState<Allocation[]>([]);
  const [loadingAlloc, setLoadingAlloc] = useState(true);
  const [breadType, setBreadType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("not_sold");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [mySales, setMySales] = useState<{ breadType: string; quantity: number }[]>([]);
  const [myReturns, setMyReturns] = useState<{ breadType: string; quantity: number; status: string }[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch(API_BASE + "/api/allocations", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/sales", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/returns", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ])
      .then(([allocs, sales, returns]) => {
        setMyAllocations(allocs);
        setMySales(sales);
        setMyReturns(returns);
      })
      .catch(() => {})
      .finally(() => setLoadingAlloc(false));
  }, []);

  /* Compute in-hand = allocated - sold - pending/approved returns per bread type
     Only bread the supplier still physically has can be returned */
  const inHandByType = new Map<string, number>();
  for (const a of myAllocations) {
    inHandByType.set(a.breadType, (inHandByType.get(a.breadType) ?? 0) + a.quantity);
  }
  for (const s of mySales) {
    inHandByType.set(s.breadType, Math.max(0, (inHandByType.get(s.breadType) ?? 0) - s.quantity));
  }
  for (const r of myReturns) {
    if (r.status !== "rejected") {
      inHandByType.set(r.breadType, Math.max(0, (inHandByType.get(r.breadType) ?? 0) - r.quantity));
    }
  }

  const availableTypes = Array.from(inHandByType.entries())
    .filter(([, qty]) => qty > 0)
    .map(([name, qty]) => ({ name, qty }));

  const maxQty = availableTypes.find(t => t.name === breadType)?.qty ?? undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breadType || !quantity || parseInt(quantity) < 1) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    setSubmitting(true);
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(API_BASE + "/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ breadType, quantity: parseInt(quantity), reason, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Failed to submit return", variant: "destructive" }); return; }
      toast({ title: `Return submitted: ${quantity} × ${breadType}` });
      onCreated(data);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-base tracking-tight">Return Products</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors"><X size={18} /></button>
        </div>

        {loadingAlloc ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading your allocations…</div>
        ) : availableTypes.length === 0 ? (
          <div className="p-8 text-center">
            <PackageCheck size={32} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-semibold text-foreground text-sm">
              {myAllocations.length > 0 ? "All bread accounted for" : "No products to return"}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {myAllocations.length > 0
                ? "All allocated bread has been sold or already returned. Nothing left in hand to return."
                : "You don't have any bread allocated to you yet."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bread Type *</label>
              <div className="relative">
                <select value={breadType} onChange={e => setBreadType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400" required>
                  <option value="">Select bread type…</option>
                  {availableTypes.map(t => (
                    <option key={t.name} value={t.name}>{t.name} — {t.qty} units allocated</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Quantity * {maxQty !== undefined && <span className="font-normal normal-case">(max {maxQty})</span>}
              </label>
              <input type="number" min="1" max={maxQty} value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="e.g. 5"
                className="w-full pl-3 pr-3 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Reason *</label>
              <div className="relative">
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400">
                  {RETURN_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any additional details…"
                className="w-full pl-3 pr-3 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Return"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Allocation Form (for receptionist/manager/MD) ── */
function AllocationForm({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Allocation) => void }) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [breadType, setBreadType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { activeBranch } = useActiveBranch();

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const sellersUrl = `${API_BASE}/api/allocations/sellers`;
    /* Always fetch company-wide stock (no branch filter) — the API validates per-company not per-branch,
       and branch-filtered dashboard can show 0 when production was logged to a different branch. */
    Promise.all([
      fetch(sellersUrl, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/products", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/reports/product-dashboard", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([s, p, dash]) => {
      setSellers(s);
      setProducts((p as Product[]).filter((pr: Product) => pr.isActive));
      if (dash?.remaining) setStock(dash.remaining as StockItem[]);
    }).catch(() => {});
  }, [activeBranch]);

  const selectedStock = stock.find(s => s.name === breadType);
  const availableQty = selectedStock?.remaining ?? null;
  const enteredQty = quantity ? parseInt(quantity) : 0;
  const overStock = availableQty !== null && enteredQty > availableQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId || !breadType || !quantity || parseInt(quantity) < 1) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    setSubmitting(true);
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(API_BASE + "/api/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ sellerId, breadType, quantity: parseInt(quantity), notes: notes || null, branchId: activeBranch?.id ?? null }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Failed to create allocation", variant: "destructive" }); return; }
      toast({ title: `Allocated ${quantity} × ${breadType} to ${data.sellerName}` });
      onCreated(data);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-base tracking-tight">New Bread Allocation</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Supplier *</label>
            <div className="relative">
              <select value={sellerId} onChange={e => setSellerId(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400" required>
                <option value="">Select supplier…</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.agentId})</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            {sellers.length === 0 && <p className="text-xs text-amber-600 mt-1">No suppliers found. Create a user with the Supplier role first.</p>}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bread Type *</label>
            <div className="relative">
              <select value={breadType} onChange={e => setBreadType(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400" required>
                <option value="">Select bread type…</option>
                {products.map(p => {
                  const s = stock.find(st => st.name === p.name);
                  return <option key={p.id} value={p.name}>{p.name}{s ? ` — ${s.remaining} available` : ""}</option>;
                })}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            {breadType && availableQty !== null && (
              <div className={`flex items-center gap-1.5 mt-1.5 text-xs font-medium ${availableQty === 0 ? "text-red-600" : availableQty < 10 ? "text-amber-600" : "text-emerald-600"}`}>
                <AlertCircle size={12} />
                {availableQty === 0 ? "No stock available — log production first" : `${availableQty} units available to allocate`}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Quantity (units) *</label>
            <input type="number" min="1" max={availableQty ?? undefined} value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              className={`w-full pl-3 pr-3 py-2.5 text-sm rounded-xl border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 ${overStock ? "bg-red-50 ring-2 ring-red-400" : "bg-muted"}`}
              required />
            {overStock && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                Exceeds available stock ({availableQty} units). Reduce quantity.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any additional info…"
              className="w-full pl-3 pr-3 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || (availableQty !== null && availableQty === 0)}>
            {submitting ? "Saving…" : "Allocate Bread"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AllocationsPage() {
  const user = getStoredUser();
  const role = user?.role ?? "";
  const isSeller = role === "supplier";
  const canCreate = ["managing_director", "manager", "receptionist"].includes(role);
  const canDelete = ["managing_director", "manager"].includes(role);
  const { activeBranch } = useActiveBranch();

  const [tab, setTab] = useState<"allocations" | "returns">("allocations");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  // Supplier detail drill-down (manager/receptionist view)
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [productPrices, setProductPrices] = useState<Map<string, number>>(new Map());
  const [settleDialog, setSettleDialog] = useState<{
    open: boolean;
    sellerId: number;
    sellerName: string;
    agentId?: string | null;
    branchId?: number | null;
    branchName?: string | null;
    allocations: SupplierAllocationItem[];
  }>({
    open: false,
    sellerId: 0,
    sellerName: "",
    allocations: [],
  });
  const { toast } = useToast();

  const load = useCallback(() => {
    const token = localStorage.getItem("nmb_token");
    setLoading(true);
    const allUrl = activeBranch ? `${API_BASE}/api/allocations?branchId=${activeBranch.id}` : `${API_BASE}/api/allocations`;
    const retUrl = activeBranch ? `${API_BASE}/api/returns?branchId=${activeBranch.id}` : `${API_BASE}/api/returns`;
    const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch(allUrl, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(retUrl, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch(API_BASE + "/api/products", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ])
      .then(([a, r, prods]) => {
        setAllocations(a);
        setReturns(r);
        const pm = new Map<string, number>();
        for (const p of (prods as { name: string; pricePerUnit: number }[])) {
          pm.set(p.name, p.pricePerUnit);
        }
        setProductPrices(pm);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeBranch]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: number) => {
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`${API_BASE}/api/allocations/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error ?? "Failed to cancel allocation", variant: "destructive" }); return;
      }
      setAllocations(prev => prev.filter(a => a.id !== id));
      toast({ title: "Allocation cancelled" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const handleClearAllocation = async (id: number) => {
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`${API_BASE}/api/allocations/${id}/clear`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error ?? "Failed to clear allocation", variant: "destructive" }); return;
      }
      const updated: Allocation = await res.json();
      setAllocations(prev => prev.map(a => a.id === id ? updated : a));
      toast({ title: "Allocation cleared — lifted from supplier balance" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const handleClearAllForSupplier = async (sellerId: number, sellerName: string) => {
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`${API_BASE}/api/allocations/clear-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ sellerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error ?? "Failed to clear allocations", variant: "destructive" }); return;
      }
      const data = await res.json();
      toast({ title: data.message ?? `Cleared all allocations for ${sellerName}` });
      load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const canApproveReturns = ["managing_director", "manager", "receptionist"].includes(role);

  const handleApproveReturn = async (id: number) => {
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`${API_BASE}/api/returns/${id}/approve`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error ?? "Failed to approve return", variant: "destructive" }); return;
      }
      const updated: Return = await res.json();
      setReturns(prev => prev.map(r => r.id === id ? updated : r));
      toast({ title: "Return approved — stock updated" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const handleRejectReturn = async (id: number) => {
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`${API_BASE}/api/returns/${id}/reject`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.error ?? "Failed to reject return", variant: "destructive" }); return;
      }
      const updated: Return = await res.json();
      setReturns(prev => prev.map(r => r.id === id ? updated : r));
      toast({ title: "Return rejected" });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const totalQty = allocations.reduce((s, a) => s + a.quantity, 0);
  const todayReturns = returns.filter(r => new Date(r.returnDate).toDateString() === new Date().toDateString());
  const pendingReturns = returns.filter(r => r.status === "pending");

  return (
    <div className="space-y-6" data-testid="page-allocations">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Allocations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isSeller ? "Bread allocated to you — return unsold stock here" : "Bread issued to field suppliers"}
          </p>
        </div>
        <div className="flex gap-2">
          {isSeller && (
            <Button size="sm" variant="outline" onClick={() => setShowReturnForm(true)}>
              <RotateCcw size={14} className="mr-1.5" />
              Return
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus size={14} className="mr-1.5" />
              New Allocation
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["allocations", "returns"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
              tab === t ? "bg-amber-400 text-slate-950" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {t === "allocations" ? "Allocations" : "Returns"}
            {t === "returns" && pendingReturns.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingReturns.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {tab === "allocations" && !loading && allocations.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Total Allocations</p>
              <p className="text-2xl font-bold tracking-tight">{allocations.length}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Total Units</p>
              <p className="text-2xl font-bold tracking-tight">{totalQty}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Allocations tab */}
      {tab === "allocations" && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                  <PackageCheck size={15} className="text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold tracking-tight">
                    {isSeller ? "My Allocations" : "All Allocations"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isSeller ? "Bread given to you from the store" : "Bread distributed to suppliers"}
                  </CardDescription>
                </div>
              </div>
              {allocations.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs flex-shrink-0"
                  onClick={() => {
                    const company = getStoredCompany();
                    const rows = [...allocations].reverse();
                    generatePdf({
                      title: "Allocation History",
                      companyName: company?.name ?? "Bakery",
                      companyPhone: company?.phone ?? undefined,
                      sections: [{
                        title: `Allocations (${rows.length} records)`,
                        headers: ["Date", "Bread Type", "Qty", "Supplier", "Issued By", "Branch", "Notes"],
                        rows: rows.map(a => [
                          formatDate(a.allocationDate),
                          a.breadType,
                          a.quantity,
                          a.sellerName,
                          a.issuedByName,
                          a.branchName,
                          a.notes ?? "",
                        ]),
                        totals: ["", "", rows.reduce((s, a) => s + a.quantity, 0).toString(), "", "", "", ""],
                      }],
                      filename: `allocations-${format(new Date(), "yyyy-MM-dd")}.pdf`,
                    });
                  }}>
                  <Download size={12} /> Download PDF
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : allocations.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <PackageCheck size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No allocations yet</p>
                <p className="text-xs mt-1">{isSeller ? "Ask your receptionist to allocate bread." : "Create an allocation to assign bread to a supplier."}</p>
                {canCreate && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                    <Plus size={13} className="mr-1.5" />New Allocation
                  </Button>
                )}
              </div>
            ) : isSeller ? (
              /* ── Supplier's own allocation list (flat) ── */
              <div className="divide-y divide-border/50">
                {[...allocations].reverse().map(alloc => (
                  <div key={alloc.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <PackageCheck size={16} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{alloc.breadType}</p>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">{alloc.quantity} units</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar size={11} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{formatDate(alloc.allocationDate)}</p>
                        </div>
                        {alloc.notes && <p className="text-xs text-muted-foreground/70 mt-1 italic">{alloc.notes}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedSeller ? (
              /* ── Supplier detail drill-down ── */
              (() => {
                const sellerAllocs = allocations.filter(a => a.sellerName === selectedSeller);
                // Group by breadType within this supplier
                const byType = new Map<string, { qty: number; latestDate: string; ids: number[] }>();
                for (const a of sellerAllocs) {
                  const prev = byType.get(a.breadType);
                  if (!prev) { byType.set(a.breadType, { qty: a.quantity, latestDate: a.allocationDate, ids: [a.id] }); }
                  else {
                    byType.set(a.breadType, {
                      qty: prev.qty + a.quantity,
                      latestDate: a.allocationDate > prev.latestDate ? a.allocationDate : prev.latestDate,
                      ids: [...prev.ids, a.id],
                    });
                  }
                }
                const rows = Array.from(byType.entries()).map(([breadType, d]) => {
                  const price = productPrices.get(breadType) ?? 0;
                  const total = price * d.qty;
                  return { breadType, qty: d.qty, price, total, latestDate: d.latestDate, ids: d.ids };
                });
                const grandTotal = rows.reduce((s, r) => s + r.total, 0);
                const totalUnits = rows.reduce((s, r) => s + r.qty, 0);
                const branchName = sellerAllocs[0]?.branchName ?? "";

                return (
                  <div>
                    {/* Detail header */}
                    <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
                      <button
                        onClick={() => setSelectedSeller(null)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <ArrowLeft size={15} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Users size={13} className="text-amber-700" />
                          </div>
                          <p className="font-bold text-sm text-foreground">{selectedSeller}</p>
                        </div>
                        {branchName && (
                          <div className="flex items-center gap-1.5 mt-0.5 ml-9">
                            <Building2 size={10} className="text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">{branchName}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canCreate && sellerAllocs.some(a => !a.isCleared) && (
                          <>
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 shadow-sm"
                              onClick={() => {
                                const sid = sellerAllocs[0]?.sellerId;
                                if (sid) {
                                  setSettleDialog({
                                    open: true,
                                    sellerId: sid,
                                    sellerName: selectedSeller,
                                    branchName: sellerAllocs[0]?.branchName,
                                    allocations: sellerAllocs.filter(a => !a.isCleared),
                                  });
                                }
                              }}
                            >
                              <HandCoins size={13} /> Settle Supplier
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-muted-foreground gap-1.5"
                              onClick={() => {
                                const sid = sellerAllocs[0]?.sellerId;
                                if (sid && confirm(`Mark ALL allocations cleared for ${selectedSeller} without recording sales remittance?`)) {
                                  handleClearAllForSupplier(sid, selectedSeller);
                                }
                              }}
                              title="Clear without recording sales"
                            >
                              <CheckCircle2 size={13} /> Quick Clear
                            </Button>
                          </>
                        )}
                        <div className="text-right ml-1">
                          <p className="text-xs font-semibold text-foreground">{totalUnits} units</p>
                          <p className="text-xs text-muted-foreground">{rows.length} product{rows.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </div>

                    {/* Product table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product Type</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total Value</TableHead>
                            {canDelete && <TableHead className="w-10" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map(row => (
                            <TableRow key={row.breadType}>
                              <TableCell>
                                <div>
                                  <p className="font-semibold text-sm">{row.breadType}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Last: {format(new Date(row.latestDate), "dd MMM yyyy, HH:mm")}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">{row.qty}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {row.price > 0 ? `₦${row.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {row.price > 0 ? `₦${row.total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "—"}
                              </TableCell>
                              {canDelete && (
                                <TableCell>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Cancel all ${row.qty} × ${row.breadType} allocated to ${selectedSeller}?`)) {
                                        Promise.all(row.ids.map(id => handleCancel(id)));
                                      }
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground/50 hover:text-red-500 transition-colors"
                                    title="Cancel allocation"
                                  >
                                    <X size={14} />
                                  </button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Grand total footer */}
                    <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Total allocation value</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{totalUnits} units across {rows.length} product{rows.length !== 1 ? "s" : ""}</p>
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        {grandTotal > 0 ? `₦${grandTotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : `${totalUnits} units`}
                      </p>
                    </div>

                    {/* Individual allocation history for this supplier */}
                    <div className="border-t border-border/50">
                      <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Allocation History
                      </p>
                      {[...sellerAllocs].reverse().map(alloc => (
                        <div key={alloc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors border-b border-border/30 last:border-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${alloc.isCleared ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                            <PackageCheck size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-foreground">{alloc.breadType}</p>
                              {alloc.isCleared ? (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                                  Cleared
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(alloc.allocationDate), "dd MMM yyyy, HH:mm")} · by {alloc.issuedByName}
                              {alloc.isCleared && alloc.clearedByName && ` · Cleared by ${alloc.clearedByName}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="secondary" className="text-xs">{alloc.quantity} units</Badge>
                            {canCreate && !alloc.isCleared && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-1"
                                onClick={() => handleClearAllocation(alloc.id)}
                              >
                                <CheckCircle2 size={12} /> Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ── Manager: Supplier list (click to drill down) ── */
              (() => {
                // Group by sellerName
                const sellerMap = new Map<string, { sellerName: string; branchName: string; allocations: Allocation[] }>();
                for (const alloc of allocations) {
                  const key = alloc.sellerName;
                  if (!sellerMap.has(key)) sellerMap.set(key, { sellerName: alloc.sellerName, branchName: alloc.branchName, allocations: [] });
                  sellerMap.get(key)!.allocations.push(alloc);
                }
                const supplierGroups = Array.from(sellerMap.values()).sort((a, b) => a.sellerName.localeCompare(b.sellerName));

                return (
                  <div className="divide-y divide-border/50">
                    {supplierGroups.map(group => {
                      const unclearedAllocs = group.allocations.filter(a => !a.isCleared);
                      const totalUnits = unclearedAllocs.reduce((s, a) => s + a.quantity, 0);
                      const isFullyCleared = group.allocations.length > 0 && unclearedAllocs.length === 0;
                      const byType = new Map<string, number>();
                      for (const a of unclearedAllocs) byType.set(a.breadType, (byType.get(a.breadType) ?? 0) + a.quantity);
                      const productCount = byType.size;
                      const totalValue = Array.from(byType.entries()).reduce((s, [bt, qty]) => {
                        const price = productPrices.get(bt) ?? 0;
                        return s + price * qty;
                      }, 0);
                      const latestDate = group.allocations.reduce((latest, a) =>
                        a.allocationDate > latest ? a.allocationDate : latest, group.allocations[0]?.allocationDate ?? "");

                      return (
                        <button
                          key={group.sellerName}
                          className="w-full px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left flex items-center gap-3"
                          onClick={() => setSelectedSeller(group.sellerName)}
                        >
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isFullyCleared ? "bg-emerald-100 text-emerald-800" : "bg-slate-950 text-amber-400"}`}>
                            <Users size={16} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-foreground truncate">{group.sellerName}</p>
                              {isFullyCleared ? (
                                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                                  All Cleared
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                                  With Supplier
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {group.branchName && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Building2 size={10} />
                                  {group.branchName}
                                </span>
                              )}
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <span className="text-xs text-muted-foreground">
                                {isFullyCleared ? "0 active items" : `${productCount} product${productCount !== 1 ? "s" : ""}`}
                              </span>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar size={10} />
                                {format(new Date(latestDate), "dd MMM, HH:mm")}
                              </span>
                            </div>
                          </div>

                          {/* Right: totals + Settle button + chevron */}
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <div className="text-right">
                              <p className={`font-bold text-sm ${isFullyCleared ? "text-emerald-600" : "text-foreground"}`}>
                                {isFullyCleared ? "0 units" : `${totalUnits} units`}
                              </p>
                              {totalValue > 0 && !isFullyCleared && (
                                <p className="text-xs text-muted-foreground">
                                  ₦{totalValue.toLocaleString("en-NG", { minimumFractionDigits: 0 })}
                                </p>
                              )}
                            </div>
                            {canCreate && !isFullyCleared && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1 px-2.5 shadow-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const sid = group.allocations[0]?.sellerId;
                                  if (sid) {
                                    setSettleDialog({
                                      open: true,
                                      sellerId: sid,
                                      sellerName: group.sellerName,
                                      branchName: group.branchName,
                                      allocations: group.allocations.filter(a => !a.isCleared),
                                    });
                                  }
                                }}
                              >
                                <HandCoins size={12} /> Settle
                              </Button>
                            )}
                            <ChevronRight size={16} className="text-muted-foreground/50" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
      )}

      {/* Returns tab */}
      {tab === "returns" && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
                  <RotateCcw size={15} className="text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold tracking-tight">Product Returns</CardTitle>
                  <CardDescription className="text-xs">
                    {isSeller ? "Bread returned to the receptionist" : "Returns submitted by suppliers"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {returns.length > 0 && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      const company = getStoredCompany();
                      const rows = [...returns].reverse();
                      generatePdf({
                        title: "Returns History",
                        companyName: company?.name ?? "Bakery",
                        companyPhone: company?.phone ?? undefined,
                        sections: [{
                          title: `Returns (${rows.length} records)`,
                          headers: ["Date", "Supplier", "Bread Type", "Qty", "Reason", "Status", "Actioned By", "Notes"],
                          rows: rows.map(r => [
                            formatDate(r.returnDate),
                            r.sellerName,
                            r.breadType,
                            r.quantity,
                            r.reasonLabel,
                            r.status,
                            r.approvedByName ?? "",
                            r.notes ?? "",
                          ]),
                          totals: ["", "", "", rows.reduce((s, r) => s + r.quantity, 0).toString(), "", "", "", ""],
                        }],
                        filename: `returns-${format(new Date(), "yyyy-MM-dd")}.pdf`,
                      });
                    }}>
                    <Download size={12} /> Download PDF
                  </Button>
                )}
                {isSeller && (
                  <Button size="sm" variant="outline" onClick={() => setShowReturnForm(true)}>
                    <RotateCcw size={13} className="mr-1.5" />Return
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : returns.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <RotateCcw size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No returns yet</p>
                {isSeller && <p className="text-xs mt-1">Use the Return button to return unsold or damaged bread.</p>}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {[...returns].reverse().map(ret => (
                  <div key={ret.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${ret.status === "approved" ? "bg-emerald-50" : ret.status === "rejected" ? "bg-red-50" : "bg-amber-50"}`}>
                        <RotateCcw size={15} className={ret.status === "approved" ? "text-emerald-500" : ret.status === "rejected" ? "text-red-500" : "text-amber-500"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{ret.breadType}</p>
                            {/* Status badge */}
                            {ret.status === "pending" && (
                              <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300" variant="outline">Pending</Badge>
                            )}
                            {ret.status === "approved" && (
                              <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300" variant="outline">Approved</Badge>
                            )}
                            {ret.status === "rejected" && (
                              <Badge className="text-xs bg-red-100 text-red-700 border-red-200" variant="outline">Rejected</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">{ret.quantity} units</Badge>
                            <Badge
                              className={`text-xs ${ret.reason === "damaged" ? "bg-red-100 text-red-700 border-red-200" : ret.reason === "expired" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}
                              variant="outline"
                            >
                              {ret.reasonLabel}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <Calendar size={11} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{formatDate(ret.returnDate)}</p>
                          {!isSeller && ret.sellerName && (
                            <>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <p className="text-xs text-muted-foreground">by <span className="font-medium">{ret.sellerName}</span></p>
                            </>
                          )}
                          {ret.status === "approved" && ret.approvedByName && (
                            <>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <p className="text-xs text-emerald-600 font-medium">Approved by {ret.approvedByName}</p>
                            </>
                          )}
                          {ret.status === "rejected" && ret.approvedByName && (
                            <>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <p className="text-xs text-red-600 font-medium">Rejected by {ret.approvedByName}</p>
                            </>
                          )}
                        </div>
                        {ret.notes && <p className="text-xs text-muted-foreground/70 mt-1 italic">{ret.notes}</p>}
                        {/* Approve / Reject buttons — only for authorised staff on pending returns */}
                        {ret.status === "pending" && canApproveReturns && (
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleApproveReturn(ret.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50"
                              onClick={() => handleRejectReturn(ret.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showForm && <AllocationForm onClose={() => setShowForm(false)} onCreated={a => { setAllocations(prev => [...prev, a]); setShowForm(false); }} />}
      {showReturnForm && <ReturnForm onClose={() => setShowReturnForm(false)} onCreated={r => { setReturns(prev => [...prev, r]); setShowReturnForm(false); }} />}

      {/* Settle Supplier Dialog */}
      <SettleSupplierDialog
        open={settleDialog.open}
        onOpenChange={open => setSettleDialog(prev => ({ ...prev, open }))}
        sellerId={settleDialog.sellerId}
        sellerName={settleDialog.sellerName}
        agentId={settleDialog.agentId}
        branchId={settleDialog.branchId}
        branchName={settleDialog.branchName}
        allocations={settleDialog.allocations}
        productPrices={productPrices}
        onSettled={() => {
          load();
        }}
      />
    </div>
  );
}
