import { useState, useEffect, useCallback } from "react";
import { getToken, getStoredUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Users, Tag, Phone, ChevronRight } from "lucide-react";
import { useListBranches } from "@workspace/api-client-react";

interface WorkerCategory { id: number; name: string; }
interface Worker { id: number; fullName: string; phone: string | null; isActive: boolean; workerCategoryId: number; categoryName: string; branchId: number | null; branchName: string | null; }

function apiHeaders(): Record<string, string> {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export default function WorkersPage() {
  const { toast } = useToast();
  const user = getStoredUser();
  const isDirector = user?.role === "managing_director";

  const [categories, setCategories] = useState<WorkerCategory[]>([]);
  const [workers, setWorkers]       = useState<Worker[]>([]);
  const [selectedCat, setSelectedCat] = useState<WorkerCategory | null>(null);
  const [loading, setLoading]         = useState(true);

  /* category dialog */
  const [catDialog, setCatDialog] = useState(false);
  const [editCat, setEditCat]     = useState<WorkerCategory | null>(null);
  const [catName, setCatName]     = useState("");
  const [catSaving, setCatSaving] = useState(false);

  /* worker dialog */
  const [workerDialog, setWorkerDialog] = useState(false);
  const [editWorker, setEditWorker]     = useState<Worker | null>(null);
  const [workerForm, setWorkerForm]     = useState({ fullName: "", phone: "", branchId: "" });
  const [workerSaving, setWorkerSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "cat" | "worker"; id: number } | null>(null);

  const { data: branches } = useListBranches();

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/worker-categories", { headers: apiHeaders() });
      const cats = res.ok ? await res.json() : [];
      setCategories(cats);
      if (cats.length && !selectedCat) setSelectedCat(cats[0]);
    } finally { setLoading(false); }
  }, []);

  const loadWorkers = useCallback(async (catId?: number) => {
    const id = catId ?? selectedCat?.id;
    if (!id) return;
    const res = await fetch(`/api/workers?categoryId=${id}`, { headers: apiHeaders() });
    setWorkers(res.ok ? await res.json() : []);
  }, [selectedCat?.id]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useEffect(() => { if (selectedCat) loadWorkers(selectedCat.id); }, [selectedCat, loadWorkers]);

  /* ── category CRUD ── */
  const openAddCat = () => { setEditCat(null); setCatName(""); setCatDialog(true); };
  const openEditCat = (c: WorkerCategory) => { setEditCat(c); setCatName(c.name); setCatDialog(true); };

  const saveCat = async () => {
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      const url = editCat ? `/api/worker-categories/${editCat.id}` : "/api/worker-categories";
      const method = editCat ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: apiHeaders(), body: JSON.stringify({ name: catName }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: (data as any).error ?? "Failed to save category", variant: "destructive" });
        return;
      }
      const data = await res.json();
      toast({ title: editCat ? "Category updated" : "Category created" });
      setCatDialog(false);
      await loadCategories();
      if (!editCat) setSelectedCat(data);
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally { setCatSaving(false); }
  };

  const deleteCat = async (id: number) => {
    const res = await fetch(`/api/worker-categories/${id}`, { method: "DELETE", headers: apiHeaders() });
    const data = await res.json();
    if (!res.ok) { toast({ title: data.error ?? "Failed", variant: "destructive" }); return; }
    toast({ title: "Category deleted" });
    setDeleteConfirm(null);
    if (selectedCat?.id === id) setSelectedCat(null);
    await loadCategories();
  };

  /* ── worker CRUD ── */
  const openAddWorker = () => { setEditWorker(null); setWorkerForm({ fullName: "", phone: "", branchId: "" }); setWorkerDialog(true); };
  const openEditWorker = (w: Worker) => {
    setEditWorker(w);
    setWorkerForm({ fullName: w.fullName, phone: w.phone ?? "", branchId: w.branchId?.toString() ?? "" });
    setWorkerDialog(true);
  };

  const saveWorker = async () => {
    if (!workerForm.fullName.trim()) return;
    if (!selectedCat) return;
    setWorkerSaving(true);
    try {
      const payload = { ...workerForm, workerCategoryId: selectedCat.id, branchId: workerForm.branchId || null };
      const url = editWorker ? `/api/workers/${editWorker.id}` : "/api/workers";
      const method = editWorker ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: apiHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: (data as any).error ?? "Failed to save worker", variant: "destructive" });
        return;
      }
      toast({ title: editWorker ? "Worker updated" : "Worker added" });
      setWorkerDialog(false);
      await loadWorkers(selectedCat.id);
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally { setWorkerSaving(false); }
  };

  const deleteWorker = async (id: number) => {
    await fetch(`/api/workers/${id}`, { method: "DELETE", headers: apiHeaders() });
    toast({ title: "Worker removed" });
    setDeleteConfirm(null);
    if (selectedCat) await loadWorkers(selectedCat.id);
  };

  return (
    <div className="space-y-4" data-testid="page-workers">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Workers</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage worker categories and staff list</p>
        </div>
        {isDirector && (
          <Button size="sm" onClick={openAddCat}>
            <Plus size={14} className="mr-1.5" /> Add Category
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: categories */}
        <Card className="rounded-2xl border-0 shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Tag size={15} className="text-amber-500" /> Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Tag size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No categories yet.</p>
                {isDirector && <Button variant="outline" size="sm" className="mt-3" onClick={openAddCat}>Add First Category</Button>}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {categories.map(cat => (
                  <div key={cat.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selectedCat?.id === cat.id ? "bg-amber-50 dark:bg-amber-950/20" : "hover:bg-muted/30"}`}
                    onClick={() => setSelectedCat(cat)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{cat.name}</p>
                    </div>
                    {isDirector && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEditCat(cat)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm({ type: "cat", id: cat.id })} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    )}
                    <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 ${selectedCat?.id === cat.id ? "text-amber-500" : ""}`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: workers in selected category */}
        <Card className="rounded-2xl border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users size={15} className="text-amber-500" />
                {selectedCat ? `Workers — ${selectedCat.name}` : "Select a category"}
              </CardTitle>
              {isDirector && selectedCat && (
                <Button size="sm" variant="outline" onClick={openAddWorker}>
                  <Plus size={13} className="mr-1" /> Add Worker
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedCat ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Select a category to view workers</p>
              </div>
            ) : workers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No workers in this category yet.</p>
                {isDirector && <Button variant="outline" size="sm" className="mt-3" onClick={openAddWorker}>Add First Worker</Button>}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {workers.map(w => (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-700 font-bold text-sm">{w.fullName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{w.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {w.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={10} />{w.phone}</span>}
                        {w.branchName && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{w.branchName}</Badge>}
                        {!w.isActive && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
                      </div>
                    </div>
                    {isDirector && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditWorker(w)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteConfirm({ type: "worker", id: w.id })} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCat ? "Edit Category" : "New Worker Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Category Name</Label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Bakers, Flow Workers, Operators" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button onClick={saveCat} disabled={catSaving || !catName.trim()}>{catSaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Worker dialog */}
      <Dialog open={workerDialog} onOpenChange={setWorkerDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editWorker ? "Edit Worker" : "Add Worker"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={workerForm.fullName} onChange={e => setWorkerForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Worker's full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input value={workerForm.phone} onChange={e => setWorkerForm(f => ({ ...f, phone: e.target.value }))} placeholder="08012345678" />
            </div>
            {branches && branches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Branch (optional)</Label>
                <Select value={workerForm.branchId} onValueChange={v => setWorkerForm(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkerDialog(false)}>Cancel</Button>
            <Button onClick={saveWorker} disabled={workerSaving || !workerForm.fullName.trim()}>{workerSaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {deleteConfirm?.type === "cat" ? "This will permanently delete the category. Workers must be removed first." : "This will remove the worker from the system."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm?.type === "cat" ? deleteCat(deleteConfirm.id) : deleteWorker(deleteConfirm.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
