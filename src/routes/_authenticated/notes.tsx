import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

const EMPTY = { batch_id: "", title: "", subject: "", description: "", file_url: "" };

function NotesPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [filterBatch, setFilterBatch] = useState<string>("all");

  const canEdit = !!me?.isAdmin || !!me?.isTeacher;

  const { data: batches } = useQuery({
    queryKey: ["batches-select"],
    queryFn: async () => (await supabase.from("batches").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: items } = useQuery({
    queryKey: ["notes", filterBatch],
    queryFn: async () => {
      let q = supabase.from("notes").select("*, batches(name)").order("created_at", { ascending: false });
      if (filterBatch !== "all") q = q.eq("batch_id", filterBatch);
      return (await q).data ?? [];
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.batch_id) return toast.error("Select a batch");
    const { error } = await supabase.from("notes").insert({
      batch_id: form.batch_id,
      title: form.title.trim(),
      subject: form.subject.trim() || null,
      description: form.description.trim() || null,
      file_url: form.file_url.trim() || null,
      uploaded_by: me?.userId ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Note added");
    setForm({ ...EMPTY });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["notes"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this note?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["notes"] });
  }

  return (
    <AppShell
      title="Notes Library"
      actions={
        canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add note</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add study note</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Batch</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(batches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>File URL</Label><Input type="url" placeholder="https://…" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></div>
                <Button type="submit" className="w-full">Add note</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <div className="mb-4 flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Batch filter</Label>
          <Select value={filterBatch} onValueChange={setFilterBatch}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {(batches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((n) => (
          <div key={n.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <FileText className="h-5 w-5" />
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            <h3 className="mt-2 font-medium">{n.title}</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">{n.batches?.name}</Badge>
              {n.subject && <Badge variant="outline" className="text-xs">{n.subject}</Badge>}
            </div>
            {n.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{n.description}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM yyyy")}</p>
            {n.file_url && (
              <a href={n.file_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Open file
              </a>
            )}
          </div>
        ))}
        {(items ?? []).length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No notes uploaded.</p>}
      </div>
    </AppShell>
  );
}
