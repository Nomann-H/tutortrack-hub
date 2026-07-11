import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { auditLog } from "@/lib/notify";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/teachers")({
  component: TeachersPage,
});

type Teacher = Tables<"teachers">;

const EMPTY = {
  full_name: "", email: "", phone: "", whatsapp_number: "", qualifications: "",
  subjects: "", monthly_salary: "", joining_date: "",
};

function TeachersPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teachers")
        .select("*, teacher_branches(branch_id, branches(name, code))")
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await supabase.from("branches").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY });
    setSelectedBranches([]);
    setOpen(true);
  }

  function openEdit(t: Teacher & { teacher_branches?: { branch_id: string }[] }) {
    setEditing(t);
    setForm({
      full_name: t.full_name, email: t.email ?? "", phone: t.phone ?? "",
      whatsapp_number: t.whatsapp_number ?? "", qualifications: t.qualifications ?? "",
      subjects: (t.subjects ?? []).join(", "),
      monthly_salary: t.monthly_salary != null ? String(t.monthly_salary) : "",
      joining_date: t.joining_date ?? "",
    });
    setSelectedBranches((t.teacher_branches ?? []).map((tb) => tb.branch_id));
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    // Auto-link a user account by email if one exists
    let userId: string | null = editing?.user_id ?? null;
    if (form.email.trim()) {
      const { data: prof } = await supabase.from("profiles").select("id").eq("email", form.email.trim()).maybeSingle();
      if (prof) userId = prof.id;
    }
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsapp_number.trim() || null,
      qualifications: form.qualifications.trim() || null,
      subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      monthly_salary: form.monthly_salary ? Number(form.monthly_salary) : null,
      joining_date: form.joining_date || null,
      user_id: userId,
    };
    let teacherId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("teachers").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("teachers").insert(payload).select("id").single();
      if (error) { setSaving(false); toast.error(error.message); return; }
      teacherId = data.id;
    }
    // Sync branch assignments
    if (teacherId) {
      await supabase.from("teacher_branches").delete().eq("teacher_id", teacherId);
      if (selectedBranches.length) {
        await supabase.from("teacher_branches").insert(selectedBranches.map((b) => ({ teacher_id: teacherId!, branch_id: b })));
      }
      // Give the linked account a teacher role
      if (userId) {
        await supabase.from("user_roles").insert({ user_id: userId, role: "teacher" }).then(() => undefined, () => undefined);
      }
    }
    setSaving(false);
    toast.success(editing ? "Teacher updated" : "Teacher added");
    auditLog(editing ? "teacher.update" : "teacher.create", "teachers", teacherId);
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["teachers"] });
  }

  async function remove(t: Teacher) {
    if (!confirm(`Delete teacher ${t.full_name}?`)) return;
    const { error } = await supabase.from("teachers").delete().eq("id", t.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Teacher deleted");
      auditLog("teacher.delete", "teachers", t.id);
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    }
  }

  if (me && !me.isAdmin) {
    return (
      <AppShell title="Teachers">
        <p className="py-10 text-center text-sm text-muted-foreground">Only admins can manage teachers.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Teachers"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add teacher</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit teacher" : "Add teacher"}</DialogTitle>
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
                  <Label>WhatsApp number</Label>
                  <Input placeholder="+91…" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Joining date</Label>
                  <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Qualifications</Label>
                <Input value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Subjects (comma-separated)</Label>
                  <Input placeholder="Maths, Physics" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly salary</Label>
                  <Input type="number" min="0" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Branches</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                  {(branches ?? []).map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedBranches.includes(b.id)}
                        onCheckedChange={(c) =>
                          setSelectedBranches((prev) => (c ? [...prev, b.id] : prev.filter((x) => x !== b.id)))
                        }
                      />
                      {b.name}
                    </label>
                  ))}
                  {(branches ?? []).length === 0 && <p className="col-span-2 text-xs text-muted-foreground">Create a branch first.</p>}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add teacher"}
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
              <TableHead>Teacher</TableHead>
              <TableHead className="hidden md:table-cell">Subjects</TableHead>
              <TableHead className="hidden md:table-cell">Branches</TableHead>
              <TableHead className="hidden lg:table-cell">Linked</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(teachers ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <p className="font-medium">{t.full_name}</p>
                  <p className="text-xs text-muted-foreground">{t.email || t.phone || "—"}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(t.subjects ?? []).map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {(t.teacher_branches ?? []).map((tb) => tb.branches?.code).filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant={t.user_id ? "default" : "secondary"}>{t.user_id ? "Account linked" : "Not linked"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(teachers ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No teachers yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
