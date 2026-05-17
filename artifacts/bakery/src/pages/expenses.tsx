import { useState, useEffect, useCallback } from "react";
import { getToken, getStoredUser, getStoredCompany } from "@/lib/auth";
import { useActiveBranch } from "@/lib/branch-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Receipt, Download, Tag, Filter } from "lucide-react";
import { format } from "date-fns";
import { useListBranches } from "@workspace/api-client-react";
import { generatePdf, fmtCurrency } from "@/lib/pdf";

interface ExpenseCategory { id: number; name: string; }
interface Worker { id: number; fullName: string; categoryName: string; }
interface Expense {
  id: number; note: string; amount: string; expenseDate: string;
  categoryName: string | null; workerName: string | null; workerCategoryName: string | null;
  branchName: string | null; createdByName: string | null;
  expenseCategoryId: number | null; workerId: number | null; branchId: number | null;
}

function apiHeaders(): Record<string, string> {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const user = getStoredUser();
  const company = getStoredCompany();
  const { activeBranch } = useActiveBranch();
  const isDirector = user?.role === "managing_director";
  const isManager  = user?.role === "manager";
  const canManage  = isDirector || isManager;

  const now = new Date();
  const [startDate, setStartDate] = useState(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate,   setEndDate]   = useState(toLocalDate(now));
  const [filterCat, setFilterCat] = useState("");
  const [filterBranch, setFilterBranch] = useState(activeBranch?.id?.toString() ?? "");

  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [workers, setWorkers]       = useState<Worker[]>([]);
  const [loading, setLoading]       = useState(true);

  const [dialog, setDialog]     = useState(false);
  const [editExp, setEditExp]   = useState<Expense | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [catDialog, setCatDialog] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catSaving, setCatSaving]   = useState(false);

  const [form, setForm] = useState({
    note: "", amount: "", expenseCategoryId: "", workerId: "", branchId: activeBranch?.id?.toString() ?? "", expenseDate: toLocalDate(now),
  });

  const { data: branches } = useListBranches();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", new Date(`${startDate}T00:00:00`).toISOString());
      if (endDate)   params.set("endDate",   new Date(`${endDate}T23:59:59`).toISOString());
      if (filterCat) params.set("categoryId", filterCat);
      if (filterBranch && isDirector) params.set("branchId", filterBranch);
      const [expRes, catRes, workerRes] = await Promise.all([
        fetch(`/api/expenses?${params}`, { headers: apiHeaders() }),
        fetch("/api/expense-categories", { headers: apiHeaders() }),
        fetch("/api/workers", { headers: apiHeaders() }),
      ]);
      setExpenses(expRes.ok ? await expRes.json() : []);
      setCategories(catRes.ok ? await catRes.json() : []);
      setWorkers(workerRes.ok ? await workerRes.json() : []);
    } finally { setLoading(false); }
  }, [startDate, endDate, filterCat, filterBranch, isDirector]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalAmount = expenses.reduce((s, e) => s + parseFloat(e.amount || "0"), 0);

  /* ── expense dialog ── */
  const openAdd = () => {
    setEditExp(null);
    setForm({ note: "", amount: "", expenseCategoryId: "", workerId: "", branchId: activeBranch?.id?.toString() ?? "", expenseDate: toLocalDate(now) });
    setDialog(true);
  };
  const openEdit = (e: Expense) => {
    setEditExp(e);
    setForm({ note: e.note, amount: parseFloat(e.amount).toFixed(2), expenseCategoryId: e.expenseCategoryId?.toString() ?? "", workerId: e.workerId?.toString() ?? "", branchId: e.branchId?.toString() ?? "", expenseDate: toLocalDate(new Date(e.expenseDate)) });
    setDialog(true);
  };

  const saveExpense = async () => {
    if (!form.note.trim() || !form.amount) return;
    setSaving(true);
    try {
      const url  = editExp ? `/api/expenses/${editExp.id}` : "/api/expenses";
      const meth = editExp ? "PATCH" : "POST";
      const res  = await fetch(url, { method: meth, headers: apiHeaders(), body: JSON.stringify({
        note: form.note, amount: form.amount,
        expenseCategoryId: form.expenseCategoryId || null,
        workerId: form.workerId || null,
        branchId: form.branchId || null,
        expenseDate: form.expenseDate ? new Date(`${form.expenseDate}T12:00:00`).toISOString() : undefined,
      })});
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Failed", variant: "destructive" }); return; }
      toast({ title: editExp ? "Expense updated" : "Expense recorded" });
      setDialog(false);
      await loadAll();
    } finally { setSaving(false); }
  };

  const deleteExpense = async (id: number) => {
    await fetch(`/api/expenses/${id}`, { method: "DELETE", headers: apiHeaders() });
    toast({ title: "Expense deleted" });
    setDeleteId(null);
    await loadAll();
  };

  /* ── category add ── */
  const saveCat = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      const res = await fetch("/api/expense-categories", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ name: newCatName }) });
      if (!res.ok) { toast({ title: "Failed to add category", variant: "destructive" }); return; }
      setNewCatName(""); setCatDialog(false);
      await loadAll();
    } finally { setCatSaving(false); }
  };

  /* ── PDF export ── */
  const exportPdf = () => {
    const branchLabel = isDirector
      ? (filterBranch ? branches?.find(b => b.id.toString() === filterBranch)?.name ?? "All Branches" : "All Branches")
      : (activeBranch?.name ?? undefined);

    generatePdf({
      title: "Expenses Report",
      subtitle: `${format(new Date(startDate), "d MMM yyyy")} – ${format(new Date(endDate), "d MMM yyyy")}`,
      companyName: company?.name ?? "Bakery",
      companyPhone: company?.phone ?? undefined,
      companyAddress: company?.address ?? undefined,
      branchName: branchLabel,
      logoUrl: company?.logoUrl ?? undefined,
      dateRange: `${format(new Date(startDate), "d MMM yyyy")} to ${format(new Date(endDate), "d MMM yyyy")}`,
      sections: [
        {
          title: `Expenses (${expenses.length} records — Total: ${fmtCurrency(totalAmount)})`,
          headers: ["Date", "Category", "Worker", "Note", "Branch", "Recorded By", "Amount"],
          rows: expenses.map(e => [
            format(new Date(e.expenseDate), "d MMM yyyy"),
            e.categoryName ?? "—",
            e.workerName ? `${e.workerName}${e.workerCategoryName ? ` (${e.workerCategoryName})` : ""}` : "—",
            e.note,
            e.branchName ?? "—",
            e.createdByName ?? "—",
            fmtCurrency(parseFloat(e.amount)),
          ]),
          totals: ["", "", "", "", "", "TOTAL", fmtCurrency(totalAmount)],
        },
      ],
      filename: `expenses-${startDate}-to-${endDate}.pdf`,
    });
  };

  /* ── by-category summary ── */
  const byCat: Record<string, number> = {};
  expenses.forEach(e => {
    const k = e.categoryName ?? "Uncategorised";
    byCat[k] = (byCat[k] ?? 0) + parseFloat(e.amount || "0");
  });

  return (
    <div className="space-y-4" data-testid="page-expenses">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track operational spending by branch and category</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setCatDialog(true)}>
              <Tag size={13} className="mr-1.5" /> Category
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={expenses.length === 0}>
            <Download size={13} className="mr-1.5" /> PDF
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} className="mr-1.5" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Total Expenses</p>
            {loading ? <Skeleton className="h-7 w-28" /> : <p className="text-2xl font-bold">{fmtCurrency(totalAmount)}</p>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Records</p>
            {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold">{expenses.length}</p>}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm col-span-2 md:col-span-1">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Categories Spent</p>
            {loading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold">{Object.keys(byCat).length}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Filter size={13} /> Filters
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-sm w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-sm w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="h-9 text-sm w-40"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isDirector && branches && branches.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Branch</Label>
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-9 text-sm w-40"><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      {Object.keys(byCat).length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(byCat).sort((a,b) => b[1]-a[1]).map(([name, amt]) => (
            <Card key={name} className="rounded-xl border-0 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground truncate">{name}</p>
                <p className="font-bold text-sm mt-0.5">{fmtCurrency(amt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Expense list */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center">
              <Receipt size={15} className="text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold">Expense Records</CardTitle>
              <CardDescription className="text-xs">{expenses.length} record{expenses.length !== 1 ? "s" : ""} in selected period</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">No expenses recorded in this period.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>Record First Expense</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{e.note}</p>
                      {e.categoryName && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{e.categoryName}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">{format(new Date(e.expenseDate), "d MMM yyyy")}</p>
                      {e.workerName && <span className="text-xs text-muted-foreground">· {e.workerName}{e.workerCategoryName ? ` (${e.workerCategoryName})` : ""}</span>}
                      {e.branchName && <span className="text-xs text-muted-foreground">· {e.branchName}</span>}
                      {e.createdByName && <span className="text-xs text-muted-foreground">· by {e.createdByName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="font-bold text-sm">{fmtCurrency(parseFloat(e.amount))}</p>
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteId(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/edit expense dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editExp ? "Edit Expense" : "Record Expense"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Note / Description <span className="text-destructive">*</span></Label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="What was this expense for?" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₦) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category (optional)</Label>
              <Select value={form.expenseCategoryId} onValueChange={v => setForm(f => ({ ...f, expenseCategoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No category</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Worker (optional)</Label>
              <Select value={form.workerId} onValueChange={v => setForm(f => ({ ...f, workerId: v }))}>
                <SelectTrigger><SelectValue placeholder="Link to a worker" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No worker</SelectItem>
                  {workers.map(w => <SelectItem key={w.id} value={w.id.toString()}>{w.fullName} ({w.categoryName})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isDirector && branches && branches.length > 1 && (
              <div className="space-y-1.5">
                <Label>Branch (optional)</Label>
                <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Company-wide" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Company-wide</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={saveExpense} disabled={saving || !form.note.trim() || !form.amount}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add category dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Add Expense Category</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Fuel, Ingredients, Maintenance" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
            <Button onClick={saveCat} disabled={catSaving || !newCatName.trim()}>{catSaving ? "Saving…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Delete Expense?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This will permanently remove this expense record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId !== null && deleteExpense(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
