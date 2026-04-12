import { useState } from "react";
import {
  useListInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useAdjustInventory,
  useListBranches,
  getListInventoryQueryKey,
  getGetLowStockItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getStoredUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, AlertTriangle, Pencil, Trash2, ArrowUpDown } from "lucide-react";

const CATEGORIES = ["Flour", "Yeast", "Sugar", "Salt", "Fat/Oil", "Eggs", "Flavoring", "Packaging", "Other"];
const UNITS = ["kg", "g", "liters", "ml", "pcs", "bags", "boxes"];

function formatCurrency(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type InventoryItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  currentQuantity: number;
  minimumQuantity: number;
  costPerUnit: number;
  branchId: number;
  branchName: string;
  isLowStock: boolean;
};

export default function InventoryPage() {
  const user = getStoredUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const defaultBranchId = user?.branchId?.toString() ?? "";

  const [form, setForm] = useState({
    name: "",
    category: "",
    unit: "",
    currentQuantity: "",
    minimumQuantity: "",
    costPerUnit: "",
    branchId: defaultBranchId,
  });

  const { data: items, isLoading } = useListInventory({});
  const { data: branches } = useListBranches();
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const adjustInv = useAdjustInventory();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getGetLowStockItemsQueryKey({}) });
  };

  const handleCreate = () => {
    if (!form.name || !form.category || !form.unit || !form.branchId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createItem.mutate(
      { data: {
        name: form.name,
        category: form.category,
        unit: form.unit,
        currentQuantity: parseFloat(form.currentQuantity || "0"),
        minimumQuantity: parseFloat(form.minimumQuantity || "0"),
        costPerUnit: parseFloat(form.costPerUnit || "0"),
        branchId: parseInt(form.branchId),
      }},
      {
        onSuccess: () => {
          toast({ title: "Inventory item added" });
          invalidate();
          setShowNew(false);
          setForm({ name: "", category: "", unit: "", currentQuantity: "", minimumQuantity: "", costPerUnit: "", branchId: defaultBranchId });
        },
        onError: () => toast({ title: "Failed to add item", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!editItem) return;
    updateItem.mutate(
      { id: editItem.id, data: {
        name: form.name || null,
        category: form.category || null,
        unit: form.unit || null,
        currentQuantity: form.currentQuantity ? parseFloat(form.currentQuantity) : null,
        minimumQuantity: form.minimumQuantity ? parseFloat(form.minimumQuantity) : null,
        costPerUnit: form.costPerUnit ? parseFloat(form.costPerUnit) : null,
      }},
      {
        onSuccess: () => {
          toast({ title: "Inventory item updated" });
          invalidate();
          setEditItem(null);
        },
        onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteItem.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Item removed" });
        invalidate();
      },
      onError: () => toast({ title: "Failed to remove item", variant: "destructive" }),
    });
  };

  const handleAdjust = () => {
    if (!adjustItem || !adjustmentValue || !adjustmentReason) {
      toast({ title: "Please fill in adjustment amount and reason", variant: "destructive" });
      return;
    }
    adjustInv.mutate(
      { id: adjustItem.id, data: { adjustment: parseFloat(adjustmentValue), reason: adjustmentReason } },
      {
        onSuccess: () => {
          toast({ title: "Inventory adjusted" });
          invalidate();
          setAdjustItem(null);
          setAdjustmentValue("");
          setAdjustmentReason("");
        },
        onError: () => toast({ title: "Failed to adjust inventory", variant: "destructive" }),
      }
    );
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentQuantity: item.currentQuantity.toString(),
      minimumQuantity: item.minimumQuantity.toString(),
      costPerUnit: item.costPerUnit.toString(),
      branchId: item.branchId.toString(),
    });
  };

  const lowCount = (items ?? []).filter(i => i.isLowStock).length;

  return (
    <div className="space-y-6" data-testid="page-inventory">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage raw materials and stock levels</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="button-add-item">
          <Plus size={16} className="mr-2" />
          Add Item
        </Button>
      </div>

      {lowCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
          <AlertTriangle size={16} />
          <strong>{lowCount} item{lowCount > 1 ? "s are" : " is"} low on stock</strong> — review and restock soon.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stock Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !(items?.length) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package size={36} className="mx-auto mb-2 opacity-40" />
              <p>No inventory items yet. Add your first item.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Minimum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost/Unit</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items ?? []).map((item) => (
                    <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell>{item.currentQuantity} {item.unit}</TableCell>
                      <TableCell className="text-muted-foreground">{item.minimumQuantity} {item.unit}</TableCell>
                      <TableCell>
                        <Badge variant={item.isLowStock ? "destructive" : "secondary"}>
                          {item.isLowStock ? "Low Stock" : "In Stock"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(item.costPerUnit)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.branchName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdjustItem(item as InventoryItem)} data-testid={`button-adjust-${item.id}`}>
                            <ArrowUpDown size={13} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item as InventoryItem)} data-testid={`button-edit-${item.id}`}>
                            <Pencil size={13} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)} data-testid={`button-delete-${item.id}`}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Item Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Item Name</Label>
                <Input placeholder="e.g. All-Purpose Flour" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} data-testid="input-item-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({...form, unit: v})}>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Current Quantity</Label>
                <Input type="number" min="0" placeholder="0" value={form.currentQuantity} onChange={(e) => setForm({...form, currentQuantity: e.target.value})} data-testid="input-current-qty" />
              </div>
              <div className="space-y-1.5">
                <Label>Minimum Quantity</Label>
                <Input type="number" min="0" placeholder="0" value={form.minimumQuantity} onChange={(e) => setForm({...form, minimumQuantity: e.target.value})} data-testid="input-min-qty" />
              </div>
              <div className="space-y-1.5">
                <Label>Cost per Unit (₦)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.costPerUnit} onChange={(e) => setForm({...form, costPerUnit: e.target.value})} data-testid="input-cost-per-unit" />
              </div>
              {branches && branches.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select value={form.branchId} onValueChange={(v) => setForm({...form, branchId: v})}>
                    <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createItem.isPending} data-testid="button-confirm-add">
              {createItem.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit {editItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Item Name</Label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Quantity</Label>
                <Input type="number" min="0" value={form.currentQuantity} onChange={(e) => setForm({...form, currentQuantity: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Minimum Quantity</Label>
                <Input type="number" min="0" value={form.minimumQuantity} onChange={(e) => setForm({...form, minimumQuantity: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost per Unit (₦)</Label>
                <Input type="number" min="0" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({...form, costPerUnit: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateItem.isPending}>{updateItem.isPending ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={!!adjustItem} onOpenChange={() => setAdjustItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust Stock: {adjustItem?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm">
              Current stock: <span className="font-bold">{adjustItem?.currentQuantity} {adjustItem?.unit}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Adjustment (+/-)</Label>
              <Input
                type="number"
                placeholder="e.g. -5 to remove, +10 to add"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                data-testid="input-adjustment"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                placeholder="e.g. Restock, Damaged, Used in production"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                data-testid="input-reason"
              />
            </div>
            {adjustmentValue && adjustItem && (
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                New stock: <span className="font-bold">{Math.max(0, adjustItem.currentQuantity + parseFloat(adjustmentValue)).toFixed(2)} {adjustItem.unit}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustItem(null)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjustInv.isPending} data-testid="button-confirm-adjust">
              {adjustInv.isPending ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
