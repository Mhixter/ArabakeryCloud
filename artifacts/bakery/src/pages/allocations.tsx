import { useState, useEffect, useCallback } from "react";
import { useActiveBranch } from "@/lib/branch-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PackageCheck, Plus, X, ChevronDown, Users, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { getStoredUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

function formatDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

interface Allocation {
  id: number;
  breadType: string;
  quantity: number;
  sellerName: string;
  issuedByName: string;
  branchName: string;
  notes: string | null;
  allocationDate: string;
  createdAt: string;
}

interface Seller { id: number; fullName: string; agentId: string }
interface Product { id: number; name: string; isActive: boolean }

function AllocationForm({
  onClose,
  onCreated,
}: { onClose: () => void; onCreated: (a: Allocation) => void }) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [breadType, setBreadType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { activeBranch } = useActiveBranch();

  useEffect(() => {
    const token = localStorage.getItem("nmb_token");
    const h = token ? { Authorization: `Bearer ${token}` } : {};
    const sellersUrl = activeBranch
      ? `/api/allocations/sellers?branchId=${activeBranch.id}`
      : "/api/allocations/sellers";
    Promise.all([
      fetch(sellersUrl, { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
      fetch("/api/products", { headers: h, credentials: "include" }).then(r => r.ok ? r.json() : []),
    ]).then(([s, p]) => {
      setSellers(s);
      setProducts((p as Product[]).filter((pr: Product) => pr.isActive));
    }).catch(() => {});
  }, [activeBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId || !breadType || !quantity || parseInt(quantity) < 1) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    setSubmitting(true);
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch("/api/allocations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ sellerId, breadType, quantity: parseInt(quantity), notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Failed to create allocation", variant: "destructive" }); return;
      }
      toast({ title: `Allocated ${quantity} × ${breadType} to ${data.sellerName}` });
      onCreated(data);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-base tracking-tight">New Bread Allocation</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Seller *
            </label>
            <div className="relative">
              <select
                value={sellerId}
                onChange={e => setSellerId(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              >
                <option value="">Select seller…</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.fullName} ({s.agentId})</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            {sellers.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No sellers found. Create a user with the Seller role first.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Bread Type *
            </label>
            <div className="relative">
              <select
                value={breadType}
                onChange={e => setBreadType(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              >
                <option value="">Select bread type…</option>
                {products.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Quantity (units) *
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              className="w-full pl-3 pr-3 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional info…"
              className="w-full pl-3 pr-3 py-2.5 text-sm rounded-xl bg-muted border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
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
  const isSeller = role === "seller";
  const canCreate = ["managing_director", "manager", "receptionist"].includes(role);
  const { activeBranch } = useActiveBranch();

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const load = useCallback(() => {
    const token = localStorage.getItem("nmb_token");
    setLoading(true);
    const url = activeBranch
      ? `/api/allocations?branchId=${activeBranch.id}`
      : "/api/allocations";
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : [])
      .then(setAllocations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeBranch]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: number) => {
    const token = localStorage.getItem("nmb_token");
    try {
      const res = await fetch(`/api/allocations/${id}`, {
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

  const totalQty = allocations.reduce((s, a) => s + a.quantity, 0);

  return (
    <div className="space-y-6" data-testid="page-allocations">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Allocations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isSeller ? "Bread allocated to you by the receptionist" : "Bread issued to field sellers"}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1.5" />
            New Allocation
          </Button>
        )}
      </div>

      {/* Summary */}
      {!loading && allocations.length > 0 && (
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

      {/* Allocations list */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <PackageCheck size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">
                {isSeller ? "My Allocations" : "All Allocations"}
              </CardTitle>
              <CardDescription className="text-xs">
                {isSeller ? "Bread given to you from the store" : "Bread distributed to sellers"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <PackageCheck size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No allocations yet</p>
              <p className="text-xs mt-1">
                {isSeller ? "Ask your receptionist to allocate bread to you." : "Create an allocation to assign bread to a seller."}
              </p>
              {canCreate && (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                  <Plus size={13} className="mr-1.5" />
                  New Allocation
                </Button>
              )}
            </div>
          ) : (
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
                      {!isSeller && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Users size={11} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{alloc.sellerName}</p>
                          <span className="text-muted-foreground/40 text-xs">·</span>
                          <p className="text-xs text-muted-foreground">{alloc.branchName}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar size={11} className="text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{formatDate(alloc.allocationDate)}</p>
                        {!isSeller && (
                          <>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <p className="text-xs text-muted-foreground">by {alloc.issuedByName}</p>
                          </>
                        )}
                      </div>
                      {alloc.notes && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">{alloc.notes}</p>
                      )}
                    </div>
                    {canCreate && (
                      <button
                        onClick={() => {
                          if (confirm(`Cancel allocation of ${alloc.quantity} × ${alloc.breadType}?`)) {
                            handleCancel(alloc.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground/50 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Cancel allocation"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New allocation form modal */}
      {showForm && (
        <AllocationForm
          onClose={() => setShowForm(false)}
          onCreated={newAlloc => {
            setAllocations(prev => [...prev, newAlloc]);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
