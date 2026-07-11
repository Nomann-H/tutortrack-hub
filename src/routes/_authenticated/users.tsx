import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldPlus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel, type AppRole } from "@/hooks/use-me";
import { auditLog, sendNotification } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

const ASSIGNABLE: AppRole[] = ["super_admin", "branch_admin", "teacher", "student", "parent"];

function UsersPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [assignFor, setAssignFor] = useState<{ id: string; name: string } | null>(null);
  const [role, setRole] = useState<AppRole>("teacher");
  const [branchId, setBranchId] = useState<string>("");

  const { data: users } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles.data ?? []).map((p) => ({
        ...p,
        roles: (roles.data ?? []).filter((r) => r.user_id === p.id),
      }));
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await supabase.from("branches").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  async function assignRole() {
    if (!assignFor) return;
    if (role === "branch_admin" && !branchId) {
      toast.error("Select a branch for the Branch Admin role");
      return;
    }
    const { error } = await supabase.from("user_roles").insert({
      user_id: assignFor.id,
      role,
      branch_id: role === "branch_admin" && branchId ? branchId : null,
    });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "User already has this role" : error.message);
      return;
    }
    toast.success(`${roleLabel[role]} role assigned`);
    auditLog("role.assign", "user_roles", undefined, { user: assignFor.id, role });
    sendNotification({ userId: assignFor.id, title: "Role assigned", body: `You are now a ${roleLabel[role]} in TutorTrack.`, type: "role" });
    setAssignFor(null);
    setBranchId("");
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
  }

  async function removeRole(roleId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast.error(error.message.includes("last Super Admin") ? "Cannot remove the last Super Admin" : error.message);
      return;
    }
    toast.success("Role removed");
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
  }

  if (me && !me.isSuperAdmin) {
    return (
      <AppShell title="Users & Roles">
        <p className="py-10 text-center text-sm text-muted-foreground">Only the Super Admin can manage user roles.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Users & Roles">
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-medium">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground">No role</span>}
                    {u.roles.map((r) => (
                      <Badge key={r.id} variant={r.role === "super_admin" ? "default" : "secondary"} className="gap-1">
                        {roleLabel[r.role as AppRole]}
                        {r.branch_id && branches && (
                          <span className="opacity-70">· {branches.find((b) => b.id === r.branch_id)?.code}</span>
                        )}
                        <button onClick={() => removeRole(r.id)} aria-label="Remove role" className="ml-0.5 opacity-60 hover:opacity-100">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setAssignFor({ id: u.id, name: u.full_name })}>
                    <ShieldPlus className="mr-1 h-4 w-4" /> Assign
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign role to {assignFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === "branch_admin" && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" onClick={assignRole}>Assign role</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
