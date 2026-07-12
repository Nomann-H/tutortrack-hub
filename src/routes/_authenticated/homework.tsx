import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { format, isPast } from "date-fns";
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

export const Route = createFileRoute("/_authenticated/homework")({
  component: HomeworkPage,
});

const EMPTY = { batch_id: "", title: "", subject: "", description: "", due_date: "", attachment_url: "" };

function HomeworkPage() {
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
    queryKey: ["homework", filterBatch],
    queryFn: async () => {
      let q = supabase.from("homework").select("*, batches(name)").order("due_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      if (filterBatch !== "all") q = q.eq("batch_id", filterBatch);
      return (await q).data ?? [];
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.batch_id) return toast.error("Select a batch");
    const { error } = await supabase.from("homework").insert({
      batch_id: form.batch_id,
      title: form.title.trim(),
      subject: form.subject.trim() || null,
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      attachment_url: form.attachment_url.trim() || null,
      created_by: me?.userId ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Homework posted");
    setForm({ ...EMPTY });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["homework"] });

    // notify students in this batch (in-app)
    const { data: students } = await supabase.from("students").select("user_id").eq("batch_id", form.batch_id).eq("is_active", true);
    const userIds = (students ?? []).map((s) => s.user_id).filter((u): u is string => !!u);
    if (userIds.length) {
      await supabase.from("notifications").insert(userIds.map((uid) => ({
        user_id: uid,
        title: "New homework",
        body: form.title.trim(),
        type: "homework",
        link: "/homework",
      })));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this homework?")) return;
    const { error } = await supabase.from("homework").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["homework"] });
  }

  return (
    <AppShell
      title="Homework"
      actions={
        canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Post homework</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Post homework</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Batch</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(batches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Attachment URL (optional)</Label><Input type="url" placeholder="https://…" value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} /></div>
                <Button type="submit" className="w-full">Post</Button>
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
      <div className="space-y-3">
        {(items ?? []).map((h) => (
          <div key={h.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{h.title}</h3>
                  <Badge variant="secondary">{h.batches?.name}</Badge>
                  {h.subject && <Badge variant="outline">{h.subject}</Badge>}
                </div>
                {h.description && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{h.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {h.due_date && (
                    <span className={isPast(new Date(h.due_date)) ? "text-destructive font-medium" : ""}>
                      Due {format(new Date(h.due_date), "dd MMM yyyy")}
                    </span>
                  )}
                  {h.attachment_url && (
                    <a href={h.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> Attachment
                    </a>
                  )}
                </div>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => remove(h.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {(items ?? []).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No homework posted.</p>}
      </div>
    </AppShell>
  );
}
