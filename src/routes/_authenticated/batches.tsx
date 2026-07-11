import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/batches")({
  component: BatchesPage,
});

type Batch = Tables<"batches">;

const EMPTY = { name: "", subject: "", classroom: "", start_time: "", end_time: "", capacity: "30", branch_id: "" };

function BatchesPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const { data: batches } = useQuery({
    queryKey: ["batches-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("batches")
        .select("*, branches(name, code), students(id)")
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
    setOpen(true);
  }

  function openEdit(b: Batch) {
    setEditing(b);
    setForm({
      name: b.name, subject: b.subject ?? "", classroom: b.classroom ?? "",
      start_time: b.start_time ?? "", end_time: b.end_time ?? "",
      capacity: b.capacity != null ? String(b.capacity) : "30", branch_id: b.branch_id,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.branch_id) { toast.error("Select a branch"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim() || null,
      classroom: form.classroom.trim() || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      branch_id: form.branch_id,
    };
    const res = editing
      ? await supabase.from("batches").update(payload).eq("id", editing.id)
      : await supabase.from("batches").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Batch updated" : "Batch created");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["batches-full"] });
    queryClient.invalidateQueries({ queryKey: ["batches"] });
  }

  async function remove(b: Batch) {
    if (!confirm(`Delete batch ${b.name}?`)) return;
    const { error } = await supabase.from("batches").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Batch deleted");
      queryClient.invalidateQueries({ queryKey: ["batches-full"] });
    }
  }

  const canEdit = me?.isAdmin ?? false;

  return (
    <AppShell
      title="Batches"
      actions={
        canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> New batch</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit batch" : "Create batch"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input required placeholder="e.g. Class 10 A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Branch</Label>
                    <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Classroom</Label>
                    <Input value={form.classroom} onChange={(e) => setForm({ ...form, classroom: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Starts</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ends</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Capacity</Label>
                    <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Create batch"}
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
              <TableHead>Batch</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="hidden md:table-cell">Timing</TableHead>
              <TableHead className="hidden md:table-cell">Students</TableHead>
              {canEdit && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(batches ?? []).map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.subject || ""}{b.classroom ? ` · Room ${b.classroom}` : ""}</p>
                </TableCell>
                <TableCell><Badge variant="secondary">{b.branches?.code}</Badge></TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {b.start_time && b.end_time ? `${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}` : "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {(b.students ?? []).length}{b.capacity ? ` / ${b.capacity}` : ""}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(b)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {(batches ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No batches yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
