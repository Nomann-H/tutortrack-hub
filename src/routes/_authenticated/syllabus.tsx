import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/syllabus")({
  component: SyllabusPage,
});

function SyllabusPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", title: "", description: "" });

  const canEdit = !!me?.isAdmin || !!me?.isTeacher;

  const { data: batches } = useQuery({
    queryKey: ["batches-for-syllabus", me?.userId],
    enabled: !!me,
    queryFn: async () => (await supabase.from("batches").select("id,name,subject").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: topics } = useQuery({
    queryKey: ["syllabus", batchId],
    enabled: !!batchId,
    queryFn: async () =>
      (await supabase.from("syllabus_topics").select("*").eq("batch_id", batchId).order("sort_order").order("created_at")).data ?? [],
  });

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) return;
    const nextOrder = (topics ?? []).length;
    const { error } = await supabase.from("syllabus_topics").insert({
      batch_id: batchId,
      subject: form.subject.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      sort_order: nextOrder,
      created_by: me?.userId ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Topic added");
    setForm({ subject: "", title: "", description: "" });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["syllabus", batchId] });
  }

  async function toggleDone(id: string, done: boolean) {
    const { error } = await supabase
      .from("syllabus_topics")
      .update({
        is_completed: done,
        completed_at: done ? new Date().toISOString() : null,
        completed_by: done ? me?.userId ?? null : null,
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["syllabus", batchId] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this topic?")) return;
    const { error } = await supabase.from("syllabus_topics").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["syllabus", batchId] });
  }

  const total = topics?.length ?? 0;
  const done = topics?.filter((t) => t.is_completed).length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <AppShell
      title="Syllabus"
      actions={
        canEdit && batchId ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add topic</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add syllabus topic</DialogTitle></DialogHeader>
              <form onSubmit={addTopic} className="space-y-4">
                <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Physics" /></div>
                <div className="space-y-1.5"><Label>Topic title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Newton's Laws of Motion" /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button type="submit" className="w-full">Add topic</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select a batch" /></SelectTrigger>
              <SelectContent>
                {(batches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}{b.subject ? ` · ${b.subject}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {batchId && (
            <div className="min-w-56 flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{done} / {total} · {percent}%</span>
              </div>
              <Progress value={percent} />
            </div>
          )}
        </div>

        {!batchId && <p className="py-10 text-center text-sm text-muted-foreground">Select a batch to view its syllabus.</p>}

        {batchId && (
          <div className="space-y-2">
            {(topics ?? []).map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <button
                  className="mt-0.5"
                  disabled={!canEdit}
                  onClick={() => toggleDone(t.id, !t.is_completed)}
                  aria-label={t.is_completed ? "Mark as pending" : "Mark as completed"}
                >
                  {t.is_completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="flex-1">
                  <p className={`font-medium ${t.is_completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  {t.subject && <p className="text-xs text-muted-foreground">{t.subject}</p>}
                  {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                  {t.is_completed && t.completed_at && (
                    <p className="mt-1 text-xs text-success">Completed on {format(new Date(t.completed_at), "dd MMM yyyy")}</p>
                  )}
                </div>
                {canEdit && (
                  <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {total === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No topics added yet.</p>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
