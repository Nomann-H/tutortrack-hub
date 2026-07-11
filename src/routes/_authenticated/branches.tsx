import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { auditLog } from "@/lib/notify";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/branches")({
  component: BranchesPage,
});

type Branch = Tables<"branches">;

const EMPTY = { name: "", code: "", address: "", city: "", phone: "", email: "", manager_name: "", working_hours: "8:00 AM - 8:00 PM" };

function BranchesPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("*").order("created_at");
      return data ?? [];
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name: b.name, code: b.code, address: b.address ?? "", city: b.city ?? "",
      phone: b.phone ?? "", email: b.email ?? "", manager_name: b.manager_name ?? "",
      working_hours: b.working_hours ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, name: form.name.trim(), code: form.code.trim().toUpperCase() };
    const res = editing
      ? await supabase.from("branches").update(payload).eq("id", editing.id)
      : await supabase.from("branches").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(editing ? "Branch updated" : "Branch created");
    auditLog(editing ? "branch.update" : "branch.create", "branches", editing?.id, { name: payload.name });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["branches"] });
  }

  async function toggleActive(b: Branch) {
    const { error } = await supabase.from("branches").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["branches"] });
  }

  if (me && !me.isSuperAdmin) {
    return (
      <AppShell title="Branches">
        <p className="py-10 text-center text-sm text-muted-foreground">Only the Super Admin can manage branches.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Branches"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> New branch</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit branch" : "Create branch"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input required placeholder="e.g. BR01" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Manager name</Label>
                  <Input value={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Working hours</Label>
                <Input value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create branch"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead className="hidden md:table-cell">Manager</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(branches ?? []).map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <p className="font-medium">{b.name} <span className="text-xs text-muted-foreground">({b.code})</span></p>
                  <p className="text-xs text-muted-foreground">{[b.address, b.city].filter(Boolean).join(", ")}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">{b.manager_name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{b.phone || b.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} aria-label="Toggle active" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(branches ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No branches yet. Create your first branch to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
