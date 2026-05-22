import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getToken, getStoredUser } from "@/lib/auth";
import { API_BASE } from "@/lib/api";
import { useActiveBranch } from "@/lib/branch-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@/components/subscription-guard";

interface Product {
  id: number;
  name: string;
  description: string | null;
  pricePerUnit: number;
  unit: string;
  isActive: boolean;
}

function api(path: string, options?: RequestInit) {
  const token = getToken();
  return fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
  });
}

function useProducts(branchId?: number | null) {
  return useQuery<Product[]>({
    queryKey: ["products", branchId ?? null],
    queryFn: async () => {
      const url = branchId ? `/products?branchId=${branchId}` : "/products";
      const res = await api(url);
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
  });
}

const emptyForm = { name: "", description: "", pricePerUnit: "", unit: "loaf" };

export default function ProductsPage() {
  const { isExpired } = useSubscription();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const { activeBranch } = useActiveBranch();
  const canWrite = !isExpired && (user?.role === "managing_director" || user?.role === "manager");
  const canDelete = !isExpired && user?.role === "managing_director";

  const { data: products, isLoading } = useProducts(activeBranch?.id);

  const [showNew, setShowNew] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  const createMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const payload = { ...body, branchId: activeBranch?.id ?? null };
      const res = await api("/products", { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Failed to create product"); }
      return res.json();
    },
    onSuccess: () => {
      invalidateProducts();
      toast({ title: "Product added" });
      setShowNew(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<typeof emptyForm> & { isActive?: boolean } }) => {
      const res = await api(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Failed to update product"); }
      return res.json();
    },
    onSuccess: () => {
      invalidateProducts();
      toast({ title: "Product updated" });
      setEditProduct(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api(`/products/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? "Failed to delete product"); }
      return res.json();
    },
    onSuccess: () => {
      invalidateProducts();
      toast({ title: "Product deleted" });
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; }
    createMutation.mutate(form);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description ?? "", pricePerUnit: p.pricePerUnit.toString(), unit: p.unit });
  };

  const handleEdit = () => {
    if (!editProduct) return;
    if (!form.name.trim()) { toast({ title: "Product name is required", variant: "destructive" }); return; }
    updateMutation.mutate({ id: editProduct.id, body: form });
  };

  const toggleActive = (p: Product) => {
    updateMutation.mutate({ id: p.id, body: { isActive: !p.isActive } });
  };

  const activeProducts = products?.filter(p => p.isActive) ?? [];
  const inactiveProducts = products?.filter(p => !p.isActive) ?? [];

  return (
    <div className="space-y-6" data-testid="page-products">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage bread types used in production and sales</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowNew(true); }} disabled={!canWrite} data-testid="button-add-product">
          <Plus size={16} className="mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-950 flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{products?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Products</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeProducts.length}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{inactiveProducts.length}</p>
              <p className="text-xs text-muted-foreground">Inactive</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Products</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : !products?.length ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Package size={22} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No products yet</p>
              <p className="text-muted-foreground text-sm mt-1">Add your bread types to use them in production and sales.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {products.map(product => (
                <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-950 flex items-center justify-center flex-shrink-0">
                    <Package size={15} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                      <Badge variant={product.isActive ? "default" : "secondary"} className={product.isActive ? "bg-green-500/15 text-green-700 border-green-200" : ""}>
                        {product.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      ₦{product.pricePerUnit.toLocaleString("en-NG", { minimumFractionDigits: 2 })} / {product.unit}
                      {product.description && <span className="ml-2 text-slate-400">· {product.description}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canWrite && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleActive(product)}
                        title={product.isActive ? "Deactivate" : "Activate"}>
                        {product.isActive
                          ? <ToggleRight size={16} className="text-green-600" />
                          : <ToggleLeft size={16} className="text-slate-400" />}
                      </Button>
                    )}
                    {canWrite && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(product)}
                        data-testid={`button-edit-product-${product.id}`}>
                        <Pencil size={14} />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(product)} data-testid={`button-delete-product-${product.id}`}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <ProductForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-add-product">
              {createMutation.isPending ? "Adding…" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editProduct} onOpenChange={open => !open && setEditProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          <ProductForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} data-testid="button-confirm-edit-product">
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Product</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone. Existing production and sales records that use this product will not be affected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending} data-testid="button-confirm-delete-product">
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ form, setForm }: {
  form: { name: string; description: string; pricePerUnit: string; unit: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="prod-name">Product Name *</Label>
        <Input id="prod-name" placeholder="e.g. Agege Bread" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="prod-price">Price per Unit (₦)</Label>
          <Input id="prod-price" type="number" min="0" step="0.01" placeholder="0.00"
            value={form.pricePerUnit} onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prod-unit">Unit</Label>
          <Input id="prod-unit" placeholder="loaf, piece, bag…" value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prod-desc">Description (optional)</Label>
        <Input id="prod-desc" placeholder="Short description" value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
    </div>
  );
}
