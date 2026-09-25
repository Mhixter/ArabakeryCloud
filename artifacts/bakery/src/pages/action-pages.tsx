import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCreateSale, useCreateProduction, useListBranches,
  getListSalesQueryKey, getGetDailySalesSummaryQueryKey, getListProductionQueryKey,
  useCreateInventoryItem, useUpdateInventoryItem, useAdjustInventory,
  getListInventoryQueryKey, getGetLowStockItemsQueryKey,
  getListUsersQueryKey, getListBranchesQueryKey,
} from "@workspace/api-client-react";
import { useActiveBranch } from "@/lib/branch-context";
import { getStoredUser, getToken } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { businessDateFor, businessDateTimestamp } from "@/lib/business-date";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/components/subscription-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check } from "lucide-react";

type FormState = Record<string, string>;

function headers() {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers: { ...headers(), ...(options.headers ?? {}) }, credentials: "include" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? body?.message ?? "Unable to save changes");
  return body as T;
}

async function readRecord(resource: string, id: string) {
  try {
    return await api(`/${resource}/${id}`);
  } catch {
    const list = await api(`/${resource}`);
    return Array.isArray(list) ? list.find(item => String(item.id) === id) : null;
  }
}

function ActionShell({ title, description, back = "/dashboard", children }: { title: string; description: string; back?: string; children: React.ReactNode }) {
  const { isExpired } = useSubscription();
  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="page-action">
      <div className="flex items-center gap-3">
        <Link href={back} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground" data-testid="link-action-back">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Ara Bakery Cloud</p>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          {isExpired && <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Your subscription is expired. This page is available in view-only mode.</p>}
          <fieldset disabled={isExpired} className="min-w-0">{children}</fieldset>
        </CardContent>
      </Card>
    </div>
  );
}

function Actions({ busy, label, cancel = "/dashboard" }: { busy?: boolean; label: string; cancel?: string }) {
  const { isExpired } = useSubscription();
  return <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
    <Link href={cancel} className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted" data-testid="link-action-cancel">Cancel</Link>
    <Button type="submit" disabled={busy || isExpired} data-testid="button-action-submit"><Check size={15} className="mr-2" />{isExpired ? "View-only mode" : busy ? "Saving…" : label}</Button>
  </div>;
}

function Field({ label, name, value, onChange, type = "text", placeholder, required = false, min, step, readOnly = false }: { label: string; name: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; min?: number; step?: number; readOnly?: boolean }) {
  return <div className="space-y-1.5"><Label htmlFor={`action-${name}`}>{label}{required && <span className="text-destructive"> *</span>}</Label><Input id={`action-${name}`} data-testid={`input-action-${name}`} type={type} value={value} placeholder={placeholder} required={required} min={min} step={step} readOnly={readOnly} onChange={e => onChange(e.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options, placeholder = "Select an option", emptyLabel, required = false, testId }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; emptyLabel?: string; required?: boolean; testId?: string;
}) {
  return <div className="space-y-1.5"><Label>{label}{required && <span className="text-destructive"> *</span>}</Label><Select value={value || (emptyLabel ? "__none__" : "")} onValueChange={v => onChange(v === "__none__" ? "" : v)}><SelectTrigger data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{emptyLabel && <SelectItem value="__none__">{emptyLabel}</SelectItem>}{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function useActionList<T>(key: string, path: string) {
  return useQuery<T[]>({
    queryKey: ["action-page-list", key, path],
    queryFn: () => api<T[]>(path),
  });
}

type ActionProduct = { id: number; name: string; pricePerUnit: number; isActive: boolean; branchId?: number | null };

function productsForBranch(products: ActionProduct[], branchId?: number | null) {
  const byName = new Map<string, ActionProduct>();
  for (const product of products.filter(item => item.isActive && (branchId == null ? item.branchId == null : item.branchId == null || item.branchId === branchId))) {
    const existing = byName.get(product.name);
    if (!existing || (branchId != null && product.branchId === branchId && existing.branchId !== branchId)) {
      byName.set(product.name, product);
    }
  }
  return [...byName.values()];
}

function BranchField({ value, onChange, allowCompanyWide = false, emptyLabel = "Company-wide" }: { value: string; onChange: (v: string) => void; allowCompanyWide?: boolean; emptyLabel?: string }) {
  const { data: branches = [], isError, isLoading } = useListBranches();
  const user = getStoredUser();
  const { activeBranch } = useActiveBranch();
  const branch = activeBranch?.id?.toString() ?? (user?.role === "managing_director" ? undefined : user?.branchId?.toString());
  if (branch) return <input type="hidden" value={branch} readOnly />;
  return <div className="space-y-1.5">
    <SelectField label="Branch" value={value} onChange={onChange} options={branches.map(b => ({ value: String(b.id), label: b.name }))} placeholder={isError ? "Unable to load branches" : isLoading ? "Loading branches…" : "Select branch"} emptyLabel={allowCompanyWide ? emptyLabel : undefined} required={!allowCompanyWide} testId="select-action-branch" />
    {isError && <p role="alert" className="text-xs text-destructive">Branches could not be loaded.</p>}
  </div>;
}

function dateInputValue(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? businessDateFor() : businessDateFor(date);
}

function useInitialBranch() {
  const { activeBranch } = useActiveBranch();
  const user = getStoredUser();
  return activeBranch?.id?.toString() ?? user?.branchId?.toString() ?? "";
}

export function NewSalePage({ quick = false }: { quick?: boolean }) {
  const branch = useInitialBranch(); const { activeBranch } = useActiveBranch(); const [, setLocation] = useLocation(); const { toast } = useToast(); const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({ breadType: "", quantity: "", pricePerUnit: "", amount: "", paymentMethod: "cash", branchId: branch, notes: "" }); const [busy, setBusy] = useState(false);
  const create = useCreateSale();
  const productPath = `/products${form.branchId || branch ? `?branchId=${form.branchId || branch}` : ""}`;
  const { data: productRows = [], isLoading: productsLoading, isError: productsError } = useActionList<ActionProduct>(`sale-products-${form.branchId || branch || "all"}`, productPath);
  const products = productsForBranch(productRows, Number(form.branchId || branch) || activeBranch?.id);
  const update = (key: string) => (value: string) => setForm(f => ({ ...f, [key]: value }));
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quick) {
      const amount = Number(form.amount); const branchId = Number(form.branchId || branch);
      if (!amount || amount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
      if (!branchId) { toast({ title: "Branch is required", variant: "destructive" }); return; }
      setBusy(true); try { await api("/sales/quick", { method: "POST", body: JSON.stringify({ amount, paymentMethod: form.paymentMethod, branchId, notes: form.notes || null }) }); toast({ title: "Quick sale recorded" }); qc.invalidateQueries({ queryKey: getListSalesQueryKey({}) }); qc.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey({}) }); setLocation("/sales"); } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); } return;
    }
    const branchId = Number(form.branchId || branch);
    if (!form.breadType || !Number(form.quantity) || Number(form.quantity) < 1 || !Number(form.pricePerUnit) || Number(form.pricePerUnit) <= 0 || !branchId) { toast({ title: "Complete the required fields with valid values", variant: "destructive" }); return; }
    create.mutate({ data: { breadType: form.breadType, quantity: Number(form.quantity), pricePerUnit: Number(form.pricePerUnit), paymentMethod: form.paymentMethod as "cash" | "transfer", branchId, notes: form.notes || null } }, { onSuccess: () => { toast({ title: "Sale recorded successfully" }); qc.invalidateQueries({ queryKey: getListSalesQueryKey({}) }); qc.invalidateQueries({ queryKey: getGetDailySalesSummaryQueryKey({}) }); setLocation("/sales"); }, onError: err => toast({ title: (err as any)?.data?.error ?? "Failed to record sale", variant: "destructive" }) });
  };
  return <ActionShell title={quick ? "Record a quick sale" : "Record a sale"} description={quick ? "Capture a cash or transfer amount without selecting a product." : "Record one product sale with its quantity and price."} back="/sales"><form onSubmit={submit} className="space-y-5">
    {quick ? <Field label="Amount (₦)" name="amount" value={form.amount} onChange={update("amount")} type="number" min={0.01} step={0.01} placeholder="0.00" required /> : <>
      {productsError ? <p role="alert" className="text-sm text-destructive">Products could not be loaded. Refresh and try again.</p> : null}
      <SelectField label="Bread type" value={form.breadType} onChange={value => { const product = products.find(p => p.name === value); setForm(f => ({ ...f, breadType: value, pricePerUnit: product ? String(product.pricePerUnit) : f.pricePerUnit })); }} options={products.map(p => ({ value: p.name, label: p.name }))} placeholder={productsLoading ? "Loading products…" : "Select bread type"} required testId="select-action-product" />
       {!productsLoading && products.length === 0 && !productsError && <p className="text-xs text-muted-foreground">{!Number(form.branchId || branch) && !activeBranch ? "Select a branch to see available products." : "No active products for this branch. Add a product before recording a sale."}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity" name="quantity" value={form.quantity} onChange={update("quantity")} type="number" min={1} step={1} required /><Field label="Price per unit (₦)" name="pricePerUnit" value={form.pricePerUnit} onChange={update("pricePerUnit")} type="number" min={0.01} step={0.01} required /></div>
      {form.quantity && form.pricePerUnit && Number(form.quantity) > 0 && Number(form.pricePerUnit) > 0 && <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm"><span className="text-muted-foreground">Total amount</span><strong>₦{(Number(form.quantity) * Number(form.pricePerUnit)).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</strong></div>}
    </>}
    <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Payment method" value={form.paymentMethod} onChange={update("paymentMethod")} options={[{ value: "cash", label: "Cash" }, { value: "transfer", label: "Bank transfer" }]} /><BranchField value={form.branchId || branch} onChange={update("branchId")} /></div>
    <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes")(e.target.value)} placeholder="Optional note" /></div><Actions busy={busy || create.isPending} label={quick ? "Record quick sale" : "Record sale"} cancel="/sales" />
  </form></ActionShell>;
}

export function NewProductionPage() {
  const branch = useInitialBranch(); const { activeBranch } = useActiveBranch(); const [, setLocation] = useLocation(); const { toast } = useToast(); const qc = useQueryClient(); const create = useCreateProduction();
  const [form, setForm] = useState({ breadType: "", quantityProduced: "", wasteQuantity: "0", productionDate: businessDateFor(), branchId: branch, notes: "" }); const update = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));
  const productPath = `/products${form.branchId || branch ? `?branchId=${form.branchId || branch}` : ""}`;
  const { data: productRows = [], isLoading: productsLoading, isError: productsError } = useActionList<ActionProduct>(`production-products-${form.branchId || branch || "all"}`, productPath);
  const products = productsForBranch(productRows, Number(form.branchId || branch) || activeBranch?.id);
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  const submit = (e: React.FormEvent) => { e.preventDefault(); const branchId = Number(form.branchId || branch); if (!form.breadType || !Number(form.quantityProduced) || Number(form.quantityProduced) < 1 || Number(form.wasteQuantity) < 0 || !branchId) { toast({ title: "Complete the required fields with valid values", variant: "destructive" }); return; } create.mutate({ data: { breadType: form.breadType, quantityProduced: Number(form.quantityProduced), wasteQuantity: Number(form.wasteQuantity || 0), productionDate: businessDateTimestamp(form.productionDate), branchId, notes: form.notes || null } }, { onSuccess: () => { toast({ title: "Production batch recorded" }); qc.invalidateQueries({ queryKey: getListProductionQueryKey({}) }); setLocation("/production"); }, onError: err => toast({ title: (err as any)?.data?.error ?? "Failed to record batch", variant: "destructive" }) }); };
   return <ActionShell title="Record production batch" description="Log what came out of the oven and any waste for the business date." back="/production"><form onSubmit={submit} className="space-y-5">{productsError && <p role="alert" className="text-sm text-destructive">Products could not be loaded. Refresh and try again.</p>}<SelectField label="Bread type" value={form.breadType} onChange={value => update("breadType")(value)} options={products.map(p => ({ value: p.name, label: p.name }))} placeholder={productsLoading ? "Loading products…" : "Select bread type"} required testId="select-action-production-product" />{!productsLoading && products.length === 0 && !productsError && <p className="text-xs text-muted-foreground">{!Number(form.branchId || branch) && !activeBranch ? "Select a branch to see available products." : "No active products for this branch. Add a product before recording production."}</p>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Production date" name="productionDate" value={form.productionDate} onChange={update("productionDate")} type="date" required /><BranchField value={form.branchId || branch} onChange={update("branchId")} /><Field label="Quantity produced" name="quantityProduced" value={form.quantityProduced} onChange={update("quantityProduced")} type="number" min={1} step={1} required /><Field label="Waste / defective" name="wasteQuantity" value={form.wasteQuantity} onChange={update("wasteQuantity")} type="number" min={0} step={1} /></div><div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes")(e.target.value)} /></div><Actions busy={create.isPending} label="Record batch" cancel="/production" /></form></ActionShell>;
}

export function NewAllocationPage({ returns = false }: { returns?: boolean }) {
  const branch = useInitialBranch(); const { activeBranch } = useActiveBranch(); const user = getStoredUser(); const [, setLocation] = useLocation(); const { toast } = useToast(); const [form, setForm] = useState({ sellerId: "", productId: "", quantity: "", allocationDate: businessDateFor(), reason: "not_sold", notes: "", branchId: branch }); const [busy, setBusy] = useState(false);
  const { data: sellers = [], isError: sellersError } = useActionList<{ id: number; fullName: string; agentId?: string | null; branchId?: number | null }>("allocation-sellers", "/allocations/sellers");
  const productPath = `/products${form.branchId || branch ? `?branchId=${form.branchId || branch}` : ""}`;
  const { data: productRows = [], isLoading: productsLoading, isError: productsError } = useActionList<ActionProduct>(`allocation-products-${form.branchId || branch || "all"}`, productPath);
  const products = productsForBranch(productRows, Number(form.branchId || branch) || activeBranch?.id);
  const product = products.find(p => String(p.id) === form.productId);
  const update = (key: string) => (v: string) => setForm(f => ({ ...f, [key]: v }));
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = Number(form.quantity); const branchId = Number(form.branchId || branch);
    if (!form.productId || !Number.isInteger(quantity) || quantity < 1) { toast({ title: "Select a product and enter a valid quantity", variant: "destructive" }); return; }
    if (!returns && (!form.sellerId || !form.allocationDate || !branchId)) { toast({ title: "Select a supplier, branch, and allocation date", variant: "destructive" }); return; }
    if (!product) { toast({ title: "That product is no longer available. Refresh and try again.", variant: "destructive" }); return; }
    setBusy(true);
    try {
      if (returns) { await api("/returns", { method: "POST", body: JSON.stringify({ productId: product.id, quantity, reason: form.reason, notes: form.notes || null }) }); toast({ title: "Return submitted" }); }
      else { await api("/allocations", { method: "POST", body: JSON.stringify({ sellerId: Number(form.sellerId), breadType: product.name, quantity, allocationDate: form.allocationDate, notes: form.notes || null, branchId }) }); toast({ title: "Allocation recorded" }); }
      setLocation("/allocations");
    } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); }
  };
  return <ActionShell title={returns ? "Return products" : "New bread allocation"} description={returns ? "Record bread coming back from a supplier." : "Allocate produced bread to a supplier for the selected business date."} back="/allocations"><form onSubmit={submit} className="space-y-5">
    {productsError && <p role="alert" className="text-sm text-destructive">Products could not be loaded. Refresh and try again.</p>}
    {!returns && sellersError && <p role="alert" className="text-sm text-destructive">Suppliers could not be loaded. Refresh and try again.</p>}
    {!returns && <><SelectField label="Supplier" value={form.sellerId} onChange={update("sellerId")} options={sellers.map(s => ({ value: String(s.id), label: `${s.fullName}${s.agentId ? ` (${s.agentId})` : ""}` }))} placeholder={sellersError ? "Unable to load suppliers" : "Select supplier"} required />{!sellersError && sellers.length === 0 && <p className="text-xs text-muted-foreground">No suppliers are available for this company.</p>}</>}
    {!returns && <Field label="Allocation date" name="allocationDate" value={form.allocationDate} onChange={update("allocationDate")} type="date" required />}
    {!returns && <BranchField value={form.branchId || branch} onChange={update("branchId")} />}
    {returns && user?.role === "managing_director" && !activeBranch && <BranchField value={form.branchId} onChange={update("branchId")} allowCompanyWide emptyLabel="All branches" />}
    <SelectField label="Bread type" value={form.productId} onChange={update("productId")} options={products.map(p => ({ value: String(p.id), label: p.name }))} placeholder={productsLoading ? "Loading products…" : "Select bread type"} required testId="select-action-allocation-product" />
    {products.length === 0 && !productsLoading && !productsError && <p className="text-xs text-muted-foreground">{!Number(form.branchId || branch) && !activeBranch ? "Select a branch to see available products." : "No active products are available for this branch."}</p>}
    <Field label="Quantity" name="quantity" value={form.quantity} onChange={update("quantity")} type="number" min={1} step={1} required />
    {returns && <SelectField label="Reason" value={form.reason} onChange={update("reason")} options={[{ value: "not_sold", label: "Not sold" }, { value: "damaged", label: "Damaged" }, { value: "expired", label: "Expired" }, { value: "wrong_item", label: "Wrong item" }, { value: "other", label: "Other" }]} />}
    <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes")(e.target.value)} /></div>
    <Actions busy={busy} label={returns ? "Submit return" : "Allocate bread"} cancel="/allocations" />
  </form></ActionShell>;
}

export function AllocationHistoryPage() {
  const { activeBranch } = useActiveBranch();
  const { data: rows = [], isLoading, isError } = useActionList<any>(`allocation-history-${activeBranch?.id ?? "all"}`, `/allocations${activeBranch?.id ? `?branchId=${activeBranch.id}` : ""}`);
  return <ActionShell title="Allocated product history" description="Review allocations separately from the create workflow." back="/allocations"><div className="space-y-3">{isLoading ? <p className="text-sm text-muted-foreground">Loading allocation history…</p> : isError ? <p role="alert" className="text-sm text-destructive">Allocation history could not be loaded. Try again.</p> : rows.length === 0 ? <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">No allocations recorded yet.</p> : rows.map(r => <div key={r.id} className="flex items-center justify-between rounded-xl border border-border p-4"><div><p className="font-semibold">{r.breadType}</p><p className="text-xs text-muted-foreground">{r.sellerName} · {r.allocationDate ? businessDateFor(new Date(r.allocationDate)) : "—"}</p></div><p className="font-bold">{r.quantity} units</p></div>)}</div></ActionShell>;
}

function ProductFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const { toast } = useToast(); const qc = useQueryClient(); const { activeBranch } = useActiveBranch(); const branch = activeBranch?.id?.toString() ?? ""; const [form, setForm] = useState({ name: "", description: "", pricePerUnit: "", unit: "loaf", branchId: branch }); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(edit);
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  useEffect(() => { if (edit && params.id) readRecord("products", params.id).then(p => { if (p) setForm(f => ({ ...f, name: p.name, description: p.description ?? "", pricePerUnit: String(p.pricePerUnit ?? ""), unit: p.unit ?? "loaf" })); else toast({ title: "Product not found", variant: "destructive" }); }).catch(err => toast({ title: (err as Error).message, variant: "destructive" })).finally(() => setLoading(false)); }, [edit, params.id]);
  const update = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!form.name.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; } setBusy(true); try { const payload = { name: form.name.trim(), description: form.description, pricePerUnit: Number(form.pricePerUnit || 0), unit: form.unit || "loaf", ...(!edit ? { branchId: form.branchId ? Number(form.branchId) : null } : {}) }; await api(edit ? `/products/${params.id}` : "/products", { method: edit ? "PATCH" : "POST", body: JSON.stringify(payload) }); toast({ title: edit ? "Product updated" : "Product added" }); qc.invalidateQueries({ queryKey: ["products"] }); setLocation("/products"); } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); } };
  return <ActionShell title={edit ? "Edit product" : "Add product"} description="Keep the product name and selling price consistent across production and sales." back="/products"><form onSubmit={submit} className="space-y-5">{loading ? <p className="text-sm text-muted-foreground">Loading product…</p> : <><Field label="Product name" name="name" value={form.name} onChange={update("name")} required /><div className="grid gap-4 sm:grid-cols-2"><Field label="Price per unit (₦)" name="pricePerUnit" value={form.pricePerUnit} onChange={update("pricePerUnit")} type="number" min={0} step={0.01} /><Field label="Unit" name="unit" value={form.unit} onChange={update("unit")} /></div><Field label="Description" name="description" value={form.description} onChange={update("description")} />{!edit && <BranchField value={form.branchId || branch} onChange={update("branchId")} allowCompanyWide />}</>}<Actions busy={busy || loading} label={edit ? "Save changes" : "Add product"} cancel="/products" /></form></ActionShell>;
}
export function NewProductPage() { return <ProductFormPage />; }
export function EditProductPage() { return <ProductFormPage edit />; }

function InventoryFormPage({ mode }: { mode: "new" | "edit" | "adjust" }) {
  const params = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const { toast } = useToast(); const qc = useQueryClient(); const branch = useInitialBranch(); const [form, setForm] = useState({ name: "", category: "", unit: "", currentQuantity: "", minimumQuantity: "", costPerUnit: "", branchId: branch, adjustment: "", reason: "" }); const [loading, setLoading] = useState(mode !== "new");
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  useEffect(() => { if (mode !== "new" && params.id) readRecord("inventory", params.id).then(i => { if (i) setForm(f => ({ ...f, name: i.name, category: i.category, unit: i.unit, currentQuantity: String(i.currentQuantity), minimumQuantity: String(i.minimumQuantity), costPerUnit: String(i.costPerUnit), branchId: String(i.branchId) })); else toast({ title: "Inventory item not found", variant: "destructive" }); }).catch(err => toast({ title: (err as Error).message, variant: "destructive" })).finally(() => setLoading(false)); }, [mode, params.id]);
  const create = useCreateInventoryItem(); const updateItem = useUpdateInventoryItem(); const adjust = useAdjustInventory(); const update = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const finish = () => { qc.invalidateQueries({ queryKey: getListInventoryQueryKey({}) }); qc.invalidateQueries({ queryKey: getGetLowStockItemsQueryKey({}) }); setLocation("/inventory"); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (mode === "adjust") { const adjustment = Number(form.adjustment); if (!Number.isFinite(adjustment) || adjustment === 0 || !form.reason.trim()) { toast({ title: "Enter a non-zero adjustment and a reason", variant: "destructive" }); return; } adjust.mutate({ id: Number(params.id), data: { adjustment, reason: form.reason } }, { onSuccess: () => { toast({ title: "Stock adjusted" }); finish(); }, onError: () => toast({ title: "Failed to adjust stock", variant: "destructive" }) }); return; } const branchId = Number(form.branchId || branch); if (!form.name.trim() || (mode === "new" && (!form.category || !form.unit || !branchId))) { toast({ title: "Complete the required fields", variant: "destructive" }); return; } if (mode === "new" && Number(form.currentQuantity || 0) < 0) { toast({ title: "Quantity cannot be negative", variant: "destructive" }); return; } const data: any = mode === "new" ? { name: form.name.trim(), category: form.category, unit: form.unit, currentQuantity: Number(form.currentQuantity || 0), minimumQuantity: Number(form.minimumQuantity || 0), costPerUnit: Number(form.costPerUnit || 0), branchId } : { name: form.name.trim(), minimumQuantity: form.minimumQuantity ? Number(form.minimumQuantity) : null, costPerUnit: form.costPerUnit ? Number(form.costPerUnit) : null }; if (mode === "new") create.mutate({ data }, { onSuccess: () => { toast({ title: "Inventory item added" }); finish(); }, onError: () => toast({ title: "Failed to add item", variant: "destructive" }) }); else updateItem.mutate({ id: Number(params.id), data }, { onSuccess: () => { toast({ title: "Inventory item updated" }); finish(); }, onError: () => toast({ title: "Failed to update item", variant: "destructive" }) }); };
  const busyMutation = create.isPending || updateItem.isPending || adjust.isPending;
  const categories = ["Flour", "Yeast", "Sugar", "Salt", "Fat/Oil", "Eggs", "Flavoring", "Packaging", "Other"];
  const units = ["kg", "g", "liters", "ml", "pcs", "bags", "boxes"];
  return <ActionShell title={mode === "adjust" ? "Adjust stock" : mode === "edit" ? "Edit inventory item" : "Add inventory item"} description={mode === "adjust" ? "Record a stock movement with a reason." : "Track the raw materials your branch uses every day."} back="/inventory"><form onSubmit={submit} className="space-y-5">{loading ? <p className="text-sm text-muted-foreground">Loading inventory item…</p> : mode === "adjust" ? <><div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Stock changes are recorded in the adjustment history.</div><div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm"><span className="text-muted-foreground">Current stock</span><strong>{form.currentQuantity} {form.unit}</strong></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Adjustment (+/-)" name="adjustment" value={form.adjustment} onChange={update("adjustment")} type="number" step={1} required /><Field label="Reason" name="reason" value={form.reason} onChange={update("reason")} required /></div>{form.adjustment && Number.isFinite(Number(form.adjustment)) && <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm"><span className="text-muted-foreground">New stock</span><strong>{Math.max(0, Number(form.currentQuantity || 0) + Number(form.adjustment)).toFixed(2)} {form.unit}</strong></div>}</> : <><Field label="Item name" name="name" value={form.name} onChange={update("name")} required /><div className="grid gap-4 sm:grid-cols-2">{mode === "new" && <><SelectField label="Category" value={form.category} onChange={update("category")} options={categories.map(x => ({ value: x, label: x }))} required /><SelectField label="Unit" value={form.unit} onChange={update("unit")} options={units.map(x => ({ value: x, label: x }))} required /><Field label="Current quantity" name="currentQuantity" value={form.currentQuantity} onChange={update("currentQuantity")} type="number" min={0} step={0.01} /> </>}<Field label="Minimum quantity" name="minimumQuantity" value={form.minimumQuantity} onChange={update("minimumQuantity")} type="number" min={0} step={0.01} /><Field label="Cost per unit (₦)" name="costPerUnit" value={form.costPerUnit} onChange={update("costPerUnit")} type="number" min={0} step={0.01} />{mode === "edit" && <Field label="Current quantity (use Adjust stock to change)" name="currentQuantity" value={form.currentQuantity} onChange={() => {}} type="number" readOnly />}</div>{mode === "new" && <BranchField value={form.branchId || branch} onChange={update("branchId")} />}</>}<Actions busy={busyMutation || loading} label={mode === "adjust" ? "Adjust stock" : mode === "edit" ? "Save changes" : "Add item"} cancel="/inventory" /></form></ActionShell>;
}
export function NewInventoryPage() { return <InventoryFormPage mode="new" />; } export function EditInventoryPage() { return <InventoryFormPage mode="edit" />; } export function AdjustInventoryPage() { return <InventoryFormPage mode="adjust" />; }

function SimpleRawPage({ resource, title, back, fields, edit = false, endpoint }: { resource: string; title: string; back: string; fields: { key: string; label: string; type?: string; required?: boolean }[]; edit?: boolean; endpoint?: string }) {
  const params = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const { toast } = useToast(); const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(edit); const [form, setForm] = useState<FormState>(() => Object.fromEntries(fields.map(f => [f.key, ""])));
  useEffect(() => { if (edit && params.id) readRecord(resource, params.id).then(data => { if (data) setForm(Object.fromEntries(fields.map(f => [f.key, data[f.key] == null ? "" : f.type === "date" ? String(data[f.key]).slice(0, 10) : String(data[f.key])]))) ; else toast({ title: `${title} not found`, variant: "destructive" }); }).catch(err => toast({ title: (err as Error).message, variant: "destructive" })).finally(() => setLoading(false)); }, [edit, params.id]);
  const update = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      const result = await api<any>(edit ? `${endpoint ?? `/${resource}`}/${params.id}` : `/${resource}`, { method: edit ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast({ title: edit ? `${title} updated` : `${title} created` });
      if (resource === "branches") qc.invalidateQueries({ queryKey: getListBranchesQueryKey() });
      setLocation(resource === "worker-categories" && !edit && result?.id ? `/workers?categoryId=${result.id}` : back);
    } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); }
  };
  return <ActionShell title={`${edit ? "Edit" : "Add"} ${title.toLowerCase()}`} description={`Keep ${title.toLowerCase()} records current for your bakery.`} back={back}><form onSubmit={submit} className="space-y-5">{loading ? <p className="text-sm text-muted-foreground">Loading {title.toLowerCase()}…</p> : fields.map(f => <Field key={f.key} label={f.label} name={f.key} value={form[f.key] ?? ""} onChange={update(f.key)} type={f.type} required={f.required} />)}<Actions busy={busy || loading} label={edit ? "Save changes" : `Add ${title.toLowerCase()}`} cancel={back} /></form></ActionShell>;
}

function ExpenseFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const { toast } = useToast(); const { activeBranch } = useActiveBranch(); const user = getStoredUser(); const { data: branches } = useListBranches();
  const branch = activeBranch?.id?.toString() ?? (user?.role === "managing_director" ? "" : user?.branchId?.toString() ?? "");
  const [form, setForm] = useState({ note: "", amount: "", expenseDate: businessDateFor(), expenseCategoryId: "", workerId: "", branchId: branch }); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(edit);
  const { data: categories = [], isError: categoriesError } = useActionList<{ id: number; name: string }>("expense-categories", "/expense-categories");
  const workersPath = `/workers${form.branchId || branch ? `?branchId=${form.branchId || branch}` : ""}`;
  const { data: workers = [], isError: workersError } = useActionList<{ id: number; fullName: string; categoryName?: string }>(`expense-workers-${form.branchId || branch || "all"}`, workersPath);
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  useEffect(() => { if (edit && params.id) readRecord("expenses", params.id).then(data => { if (data) setForm({ note: data.note ?? "", amount: String(data.amount ?? ""), expenseDate: dateInputValue(data.expenseDate), expenseCategoryId: data.expenseCategoryId == null ? "" : String(data.expenseCategoryId), workerId: data.workerId == null ? "" : String(data.workerId), branchId: data.branchId == null ? "" : String(data.branchId) }); else toast({ title: "Expense not found", variant: "destructive" }); }).catch(err => toast({ title: (err as Error).message, variant: "destructive" })).finally(() => setLoading(false)); }, [edit, params.id]);
  const update = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); const amount = Number(form.amount);
    if (!form.note.trim() || !Number.isFinite(amount) || amount <= 0 || !form.expenseDate) { toast({ title: "Enter a description, valid amount, and date", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { note: form.note.trim(), amount, expenseCategoryId: form.expenseCategoryId ? Number(form.expenseCategoryId) : null, workerId: form.workerId ? Number(form.workerId) : null, expenseDate: businessDateTimestamp(form.expenseDate) };
      if (!edit) payload.branchId = form.branchId ? Number(form.branchId) : null;
      await api(edit ? `/expenses/${params.id}` : "/expenses", { method: edit ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast({ title: edit ? "Expense updated" : "Expense recorded" }); setLocation("/expenses");
    } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); }
  };
  return <ActionShell title={edit ? "Edit expense" : "Add expense"} description="Record the amount, date, and optional category or worker." back="/expenses"><form onSubmit={submit} className="space-y-5">{loading ? <p className="text-sm text-muted-foreground">Loading expense…</p> : <>
    {categoriesError && <p role="alert" className="text-sm text-destructive">Expense categories could not be loaded.</p>}{workersError && <p role="alert" className="text-sm text-destructive">Workers could not be loaded.</p>}
    <Field label="Note / description" name="note" value={form.note} onChange={update("note")} placeholder="What was this expense for?" required />
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Amount (₦)" name="amount" value={form.amount} onChange={update("amount")} type="number" min={0.01} step={0.01} required /><Field label="Date" name="expenseDate" value={form.expenseDate} onChange={update("expenseDate")} type="date" required /></div>
    <div className="grid gap-4 sm:grid-cols-2"><SelectField label="Category (optional)" value={form.expenseCategoryId} onChange={update("expenseCategoryId")} options={categories.map(c => ({ value: String(c.id), label: c.name }))} emptyLabel="No category" placeholder={categoriesError ? "Unable to load categories" : "Select category"} /><SelectField label="Worker (optional)" value={form.workerId} onChange={update("workerId")} options={workers.map(w => ({ value: String(w.id), label: w.categoryName ? `${w.fullName} (${w.categoryName})` : w.fullName }))} emptyLabel="No worker" placeholder={workersError ? "Unable to load workers" : "Link to a worker"} /></div>
    {user?.role === "managing_director" && !activeBranch && (branches?.length ?? 0) > 1 && !edit && <BranchField value={form.branchId} onChange={update("branchId")} allowCompanyWide emptyLabel="Company-wide" />}
  </>}<Actions busy={busy || loading} label={edit ? "Save changes" : "Record expense"} cancel="/expenses" /></form></ActionShell>;
}
export function NewExpensePage() { return <ExpenseFormPage />; }
export function EditExpensePage() { return <ExpenseFormPage edit />; }
export function NewExpenseCategoryPage() { return <SimpleRawPage resource="expense-categories" title="Expense category" back="/expenses" fields={[{ key: "name", label: "Category name", required: true }]} />; }
export function NewWorkerCategoryPage() { return <SimpleRawPage resource="worker-categories" title="Worker category" back="/workers" fields={[{ key: "name", label: "Category name", required: true }]} />; }
export function EditWorkerCategoryPage() { const categoryId = new URLSearchParams(window.location.search).get("categoryId"); const back = categoryId ? `/workers?categoryId=${categoryId}` : "/workers"; return <SimpleRawPage resource="worker-categories" title="Worker category" back={back} edit fields={[{ key: "name", label: "Category name", required: true }]} />; }
function WorkerFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ id: string }>(); const [location, setLocation] = useLocation(); const { toast } = useToast(); const { activeBranch } = useActiveBranch(); const user = getStoredUser(); const branch = activeBranch?.id?.toString() ?? (user?.role === "managing_director" ? "" : user?.branchId?.toString() ?? "");
  const initialCategory = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("categoryId") ?? "";
  const [form, setForm] = useState({ fullName: "", phone: "", workerCategoryId: initialCategory, branchId: branch }); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(edit);
  const { data: categories = [], isError: categoriesError } = useActionList<{ id: number; name: string }>("worker-categories", "/worker-categories");
  const { data: branches } = useListBranches();
  useEffect(() => { if (branch) setForm(f => ({ ...f, branchId: f.branchId || branch })); }, [branch]);
  useEffect(() => { if (categories.length && !form.workerCategoryId) setForm(f => ({ ...f, workerCategoryId: String(categories[0].id) })); }, [categories]);
  useEffect(() => { if (edit && params.id) readRecord("workers", params.id).then(data => { if (data) setForm({ fullName: data.fullName ?? "", phone: data.phone ?? "", workerCategoryId: String(data.workerCategoryId ?? ""), branchId: data.branchId == null ? "" : String(data.branchId) }); else toast({ title: "Worker not found", variant: "destructive" }); }).catch(err => toast({ title: (err as Error).message, variant: "destructive" })).finally(() => setLoading(false)); }, [edit, params.id]);
  const update = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));
  const back = form.workerCategoryId ? `/workers?categoryId=${form.workerCategoryId}` : "/workers";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form.fullName.trim() || !form.workerCategoryId) { toast({ title: "Enter the worker's name and choose a category", variant: "destructive" }); return; }
    setBusy(true);
    try {
      await api(edit ? `/workers/${params.id}` : "/workers", { method: edit ? "PATCH" : "POST", body: JSON.stringify({ fullName: form.fullName.trim(), phone: form.phone.trim() || null, workerCategoryId: Number(form.workerCategoryId), branchId: form.branchId ? Number(form.branchId) : null }) });
      toast({ title: edit ? "Worker updated" : "Worker added" }); setLocation(back);
    } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); }
  };
  return <ActionShell title={edit ? "Edit worker" : "Add worker"} description="Keep contact, category, and branch details up to date." back={back}><form onSubmit={submit} className="space-y-5">{loading ? <p className="text-sm text-muted-foreground">Loading worker…</p> : <>
    {categoriesError && <p role="alert" className="text-sm text-destructive">Worker categories could not be loaded.</p>}
    <Field label="Full name" name="fullName" value={form.fullName} onChange={update("fullName")} required />
    <Field label="Phone (optional)" name="phone" value={form.phone} onChange={update("phone")} />
    <SelectField label="Category" value={form.workerCategoryId} onChange={update("workerCategoryId")} options={categories.map(c => ({ value: String(c.id), label: c.name }))} placeholder={categoriesError ? "Unable to load categories" : "Select category"} required />
    {!activeBranch && user?.role === "managing_director" && (branches?.length ?? 0) > 0 && <BranchField value={form.branchId} onChange={update("branchId")} allowCompanyWide emptyLabel="All branches" />}
  </>}<Actions busy={busy || loading || categories.length === 0} label={edit ? "Save changes" : "Add worker"} cancel={back} /></form></ActionShell>;
}
export function NewWorkerPage() { return <WorkerFormPage />; }
export function EditWorkerPage() { return <WorkerFormPage edit />; }

const USER_ROLES = [
  { value: "managing_director", label: "Managing Director" },
  { value: "manager", label: "Manager" },
  { value: "receptionist", label: "Receptionist" },
  { value: "production_staff", label: "Production Staff" },
  { value: "supplier", label: "Supplier" },
];

function UserFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const { toast } = useToast(); const qc = useQueryClient(); const { activeBranch } = useActiveBranch(); const { data: branches } = useListBranches();
  const [form, setForm] = useState({ fullName: "", username: "", password: "", role: "", branchId: activeBranch?.id?.toString() ?? "" }); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(edit);
  useEffect(() => { if (activeBranch) setForm(f => ({ ...f, branchId: activeBranch.id.toString() })); }, [activeBranch?.id]);
  useEffect(() => { if (edit && params.id) readRecord("users", params.id).then(data => { if (data) setForm({ fullName: data.fullName ?? "", username: data.username ?? "", password: "", role: data.role ?? "", branchId: data.branchId == null ? "" : String(data.branchId) }); else toast({ title: "User not found", variant: "destructive" }); }).catch(err => toast({ title: (err as Error).message, variant: "destructive" })).finally(() => setLoading(false)); }, [edit, params.id]);
  const update = (key: keyof typeof form) => (value: string) => setForm(f => ({ ...f, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.role || (!edit && (!form.username.trim() || !form.password))) { toast({ title: "Complete the required user details", variant: "destructive" }); return; }
    if (form.password && form.password.length < 4) { toast({ title: "Password must be at least 4 characters", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { fullName: form.fullName.trim(), role: form.role, branchId: form.branchId ? Number(form.branchId) : null };
      if (!edit) { payload.username = form.username.trim(); payload.password = form.password; }
      else if (form.password) payload.password = form.password;
      await api(edit ? `/users/${params.id}` : "/users", { method: edit ? "PATCH" : "POST", body: JSON.stringify(payload) });
      toast({ title: edit ? "User updated" : "User created successfully" }); qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); setLocation("/users");
    } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); }
  };
  return <ActionShell title={edit ? "Edit user" : "Add user"} description="Set the staff member's account, access role, and branch." back="/users"><form onSubmit={submit} className="space-y-5">{loading ? <p className="text-sm text-muted-foreground">Loading user…</p> : <>
    <Field label="Full name" name="fullName" value={form.fullName} onChange={update("fullName")} required />
    {!edit && <Field label="Username" name="username" value={form.username} onChange={update("username")} required />}
    <Field label={edit ? "New password (optional)" : "Password"} name="password" value={form.password} onChange={update("password")} type="password" required={!edit} />
    <SelectField label="Role" value={form.role} onChange={update("role")} options={USER_ROLES} placeholder="Select role" required />
    {activeBranch ? <div className="rounded-lg bg-muted px-3 py-2 text-sm">Branch: <strong>{activeBranch.name}</strong></div> : <BranchField value={form.branchId} onChange={update("branchId")} allowCompanyWide emptyLabel="No branch" />}
  </>}<Actions busy={busy || loading} label={edit ? "Save changes" : "Create user"} cancel="/users" /></form></ActionShell>;
}
export function NewUserPage() { return <UserFormPage />; }
export function EditUserPage() { return <UserFormPage edit />; }
export function ResetUserPage() {
  const params = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const { toast } = useToast(); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (password.length < 4) { toast({ title: "Password must be at least 4 characters", variant: "destructive" }); return; } setBusy(true); try { await api(`/users/${params.id}/reset-password`, { method: "PATCH", body: JSON.stringify({ newPassword: password }) }); toast({ title: "Password reset successfully" }); setLocation("/users"); } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusy(false); } };
  return <ActionShell title="Reset user password" description="Set a new sign-in password for this staff account." back="/users"><form onSubmit={submit} className="space-y-5"><Field label="New password" name="newPassword" value={password} onChange={setPassword} type="password" required /><p className="text-xs text-muted-foreground">Use at least four characters.</p><Actions busy={busy} label="Reset password" cancel="/users" /></form></ActionShell>;
}
export function NewBranchPage() { return <SimpleRawPage resource="branches" title="Branch" back="/settings" fields={[{ key: "name", label: "Branch name", required: true }, { key: "address", label: "Address" }, { key: "phone", label: "Phone" }]} />; }
export function EditBranchPage() { return <SimpleRawPage resource="branches" title="Branch" back="/settings" edit fields={[{ key: "name", label: "Branch name", required: true }, { key: "address", label: "Address" }, { key: "phone", label: "Phone" }]} />; }

export function ReturnReviewPage() {
  const { activeBranch } = useActiveBranch(); const qc = useQueryClient(); const { toast } = useToast();
  const returnsPath = `/returns${activeBranch?.id ? `?branchId=${activeBranch.id}` : ""}`;
  const { data: rows = [], isLoading, isError, refetch } = useActionList<any>(`returns-review-${activeBranch?.id ?? "all"}`, returnsPath);
  const [busyId, setBusyId] = useState<number | null>(null);
  const approve = async (id: number, action: "approve" | "reject") => { setBusyId(id); try { await api(`/returns/${id}/${action}`, { method: "PATCH" }); toast({ title: action === "approve" ? "Return approved" : "Return rejected" }); await refetch(); qc.invalidateQueries({ queryKey: ["pending-returns-count"] }); } catch (err) { toast({ title: (err as Error).message, variant: "destructive" }); } finally { setBusyId(null); } };
  const pending = rows.filter(r => r.status === "pending");
  return <ActionShell title="Review supplier returns" description="Approve or reject pending returned bread without opening the create workflow." back="/allocations"><div className="space-y-3">{isLoading ? <p className="text-sm text-muted-foreground">Loading returns…</p> : isError ? <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">Returns could not be loaded. <Button variant="link" onClick={() => refetch()}>Try again</Button></div> : pending.map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{r.breadType} · {r.quantity} units</p><p className="text-xs text-muted-foreground">{r.sellerName} · {r.reasonLabel ?? r.reason} · {r.returnDate ? businessDateFor(new Date(r.returnDate)) : ""}</p></div><Button size="sm" disabled={busyId !== null} onClick={() => approve(r.id, "approve")}>{busyId === r.id ? "Saving…" : "Approve"}</Button><Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => approve(r.id, "reject")}>Reject</Button></div>)}{!isLoading && !isError && pending.length === 0 && <p className="rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">No pending returns.</p>}</div></ActionShell>;
}