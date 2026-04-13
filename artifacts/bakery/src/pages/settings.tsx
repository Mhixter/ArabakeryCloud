import { useState } from "react";
import {
  useListBranches,
  useCreateBranch,
  useUpdateBranch,
  getListBranchesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [editBranch, setEditBranch] = useState<{ id: number; name: string; address: string | null; phone: string | null } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  const [editForm, setEditForm] = useState({ name: "", address: "", phone: "" });

  const { data: branches, isLoading } = useListBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListBranchesQueryKey() });

  const handleCreate = () => {
    if (!form.name) {
      toast({ title: "Branch name is required", variant: "destructive" });
      return;
    }
    createBranch.mutate(
      { data: { name: form.name, address: form.address || null, phone: form.phone || null } },
      {
        onSuccess: () => {
          toast({ title: "Branch created" });
          invalidate();
          setShowNew(false);
          setForm({ name: "", address: "", phone: "" });
        },
        onError: () => toast({ title: "Failed to create branch", variant: "destructive" }),
      }
    );
  };

  const handleEdit = () => {
    if (!editBranch) return;
    updateBranch.mutate(
      { id: editBranch.id, data: { name: editForm.name || null, address: editForm.address || null, phone: editForm.phone || null } },
      {
        onSuccess: () => {
          toast({ title: "Branch updated" });
          invalidate();
          setEditBranch(null);
        },
        onError: () => toast({ title: "Failed to update branch", variant: "destructive" }),
      }
    );
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem("nmb_token");
      const res = await fetch(`/api/branches/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Branch removed" });
      invalidate();
      setDeleteConfirm(null);
    } catch {
      toast({ title: "Failed to remove branch", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage branches and system configuration</p>
      </div>

      {/* Branches Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Branches</CardTitle>
              <CardDescription className="mt-0.5">Manage your bakery locations</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowNew(true)} data-testid="button-add-branch">
              <Plus size={14} className="mr-1.5" />
              Add Branch
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !(branches?.length) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 size={36} className="mx-auto mb-2 opacity-40" />
              <p>No branches yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(branches ?? []).map((branch) => (
                    <TableRow key={branch.id} data-testid={`row-branch-${branch.id}`}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell className="text-muted-foreground">{branch.address ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{branch.phone ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            data-testid={`button-edit-branch-${branch.id}`}
                            onClick={() => {
                              setEditBranch({ id: branch.id, name: branch.name, address: branch.address ?? null, phone: branch.phone ?? null });
                              setEditForm({ name: branch.name, address: branch.address ?? "", phone: branch.phone ?? "" });
                            }}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            data-testid={`button-delete-branch-${branch.id}`}
                            onClick={() => setDeleteConfirm(branch.id)}
                          >
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

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Application</dt>
              <dd className="font-medium">Ara Bakery Cloud v1.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Build</dt>
              <dd className="font-medium font-mono text-xs">Production</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* New Branch Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New Branch</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Branch Name</Label>
              <Input placeholder="e.g. Lagos Mainland" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} data-testid="input-branch-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Address (optional)</Label>
              <Input placeholder="e.g. 12 Broad Street, Lagos" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone (optional)</Label>
              <Input placeholder="e.g. 08012345678" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBranch.isPending} data-testid="button-confirm-branch">
              {createBranch.isPending ? "Creating..." : "Create Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={!!editBranch} onOpenChange={() => setEditBranch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit {editBranch?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Branch Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBranch(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateBranch.isPending}>
              {updateBranch.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Branch</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure you want to remove this branch? This may affect users assigned to it.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)} disabled={deletingId !== null}>
              {deletingId !== null ? "Removing..." : "Remove Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
