import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useListBranches,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";

const ROLES = [
  { value: "managing_director", label: "Managing Director" },
  { value: "manager", label: "Manager" },
  { value: "receptionist", label: "Receptionist" },
  { value: "production_staff", label: "Production Staff" },
];

const ROLE_COLORS: Record<string, string> = {
  managing_director: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  receptionist: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  production_staff: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [editUser, setEditUser] = useState<{ id: number; fullName: string; role: string; branchId: number | null } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "" as string,
    branchId: "" as string,
  });

  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "",
    branchId: "",
    password: "",
  });

  const { data: users, isLoading } = useListUsers();
  const { data: branches } = useListBranches();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.fullName || !form.role) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createUser.mutate(
      {
        data: {
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          role: form.role as "managing_director" | "manager" | "receptionist" | "production_staff",
          branchId: form.branchId ? parseInt(form.branchId) : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "User created successfully" });
          invalidate();
          setShowNew(false);
          setForm({ username: "", password: "", fullName: "", role: "", branchId: "" });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to create user";
          toast({ title: "Error", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleEdit = () => {
    if (!editUser) return;
    updateUser.mutate(
      {
        id: editUser.id,
        data: {
          fullName: editForm.fullName || null,
          role: (editForm.role as "managing_director" | "manager" | "receptionist" | "production_staff") || null,
          branchId: editForm.branchId ? parseInt(editForm.branchId) : null,
          password: editForm.password || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "User updated" });
          invalidate();
          setEditUser(null);
        },
        onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "User removed" });
        invalidate();
        setDeleteConfirm(null);
      },
      onError: () => toast({ title: "Failed to remove user", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="page-users">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage staff accounts and permissions</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="button-new-user">
          <Plus size={16} className="mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff Accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !(users?.length) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users size={36} className="mx-auto mb-2 opacity-40" />
              <p>No users found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">{user.username}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? ""}`}>
                          {ROLES.find(r => r.value === user.role)?.label ?? user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.branchName ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            data-testid={`button-edit-user-${user.id}`}
                            onClick={() => {
                              setEditUser({ id: user.id, fullName: user.fullName, role: user.role, branchId: user.branchId ?? null });
                              setEditForm({ fullName: user.fullName, role: user.role, branchId: user.branchId?.toString() ?? "", password: "" });
                            }}
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            data-testid={`button-delete-user-${user.id}`}
                            onClick={() => setDeleteConfirm(user.id)}
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

      {/* New User Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="e.g. Amaka Johnson" value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} data-testid="input-full-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input placeholder="e.g. amaka.j" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} data-testid="input-new-username" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} data-testid="input-new-password" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({...form, role: v})}>
                  <SelectTrigger data-testid="select-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch (optional)</Label>
                <Select value={form.branchId || "none"} onValueChange={(v) => setForm({...form, branchId: v === "none" ? "" : v})}>
                  <SelectTrigger><SelectValue placeholder="Any branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No branch</SelectItem>
                    {(branches ?? []).map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending} data-testid="button-confirm-user">
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit {editUser?.fullName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name</Label>
                <Input value={editForm.fullName} onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={editForm.branchId || "none"} onValueChange={(v) => setEditForm({...editForm, branchId: v === "none" ? "" : v})}>
                  <SelectTrigger><SelectValue placeholder="No branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No branch</SelectItem>
                    {(branches ?? []).map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>New Password (leave blank to keep current)</Label>
                <Input type="password" placeholder="••••••••" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure you want to remove this user? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "Removing..." : "Remove User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
