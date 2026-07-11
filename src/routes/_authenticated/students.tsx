import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { auditLog } from "@/lib/notify";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

type Student = Tables<"students">;

const EMPTY = {
  full_name: "", email: "", phone: "", guardian_name: "", guardian_phone: "",
  guardian_whatsapp: "", address: "", branch_id: "", batch_id: "",
};

function StudentsPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [transferFor, setTransferFor] = useState<Student | null>(null);
  const [transferBranch, setTransferBranch] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("*, branches(name, code), batches(name)")
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await supabase.from("branches").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: batches } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await supabase.from("batches").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      full_name: s.full_name, email: s.email ?? "", phone: s.phone ?? "",
      guardian_name: s.guardian_name ?? "", guardian_phone: s.guardian_phone ?? "",
      guardian_whatsapp: s.guardian_whatsapp ?? "", address: s.address ?? "",
      branch_id: s.branch_id ?? "", batch_id: s.batch_id ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    let userId: string | null = editing?.user_id ?? null;
    if (form.email.trim()) {
      const { data: prof } = await supabase.from("profiles").select("id").eq("email", form.email.trim()).maybeSingle();
      if (prof) userId = prof.id;
    }
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      guardian_whatsapp: form.guardian_whatsapp.trim() || null,
      address: form.address.trim() || null,
      branch_id: form.branch_id || null,
      batch_id: form.batch_id || null,
      user_id: userId,
    };
    const res = editing
      ? await supabase.from("students").update(payload).eq("id", editing.id)
      : await supabase.from("students").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    if (userId) {
      await supabase.from("user_roles").insert({ user_id: userId, role: "student" }).then(() => undefined, () => undefined);
    }
    toast.success(editing ? "Student updated" : "Student added");
    auditLog(editing ? "student.update" : "student.create", "students", editing?.id);
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["students"] });
  }

  async function remove(s: Student) {
    if (!confirm(`Delete student ${s.full_name}?`)) return;
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Student deleted");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    }
  }

  async function doTransfer() {
    if (!transferFor || !transferBranch) return;
    const { error } = await supabase.from("students").update({ branch_id: transferBranch, batch_id: null }).eq("id", transferFor.id);
    if (error) { toast.error(error.message); return; }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("student_transfers").insert({
      student_id: transferFor.id,
      from_branch_id: transferFor.branch_id,
      to_branch_id: transferBranch,
      reason: transferReason || null,
      transferred_by: u.user?.id ?? null,
    });
    toast.success("Student transferred — history preserved");
    auditLog("student.transfer", "students", transferFor.id, { to: transferBranch });
    setTransferFor(null);
    setTransferBranch("");
    setTransferReason("");
    queryClient.invalidateQueries({ queryKey: ["students"] });
  }

  const canEdit = me?.isAdmin ?? false;

  return (
    <AppShell
      title="Students"
      actions={
        canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add student</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Email (links their login)</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Guardian name</Label>
                    <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Guardian phone</Label>
                    <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Guardian WhatsApp</Label>
                  <Input placeholder="+91…" value={form.guardian_whatsapp} onChange={(e) => setForm({ ...form, guardian_whatsapp: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Branch</Label>
                    <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v, batch_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Batch</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(batches ?? []).filter((b) => !form.branch_id || b.branch_id === form.branch_id).map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Add student"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="hidden md:table-cell">Guardian</TableHead>
              <TableHead>Branch / Batch</TableHead>
              {canEdit && <TableHead className="w-32" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(students ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.email || s.phone || "—"}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {s.guardian_name || "—"}
                  {s.guardian_phone && <span className="block text-xs text-muted-foreground">{s.guardian_phone}</span>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{s.branches?.code ?? "—"}</Badge>{" "}
                  <span className="text-sm">{s.batches?.name ?? ""}</span>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setTransferFor(s)} aria-label="Transfer"><ArrowRightLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(students ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No students yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!transferFor} onOpenChange={(o) => !o && setTransferFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer {transferFor?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New branch</Label>
              <Select value={transferBranch} onValueChange={setTransferBranch}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {(branches ?? []).filter((b) => b.id !== transferFor?.branch_id).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
            </div>
            <Button className="w-full" onClick={doTransfer} disabled={!transferBranch}>Transfer student</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
