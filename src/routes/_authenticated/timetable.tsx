import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Plus, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { auditLog, sendNotification, whatsappLink } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/timetable")({
  component: TimetablePage,
});

interface LectureRow {
  id: string;
  branch_id: string;
  batch_id: string;
  teacher_id: string;
  subject: string;
  classroom: string | null;
  lecture_date: string;
  start_time: string;
  end_time: string;
  topic: string | null;
  status: string;
  acknowledged_at: string | null;
  teachers: { full_name: string; user_id: string | null; whatsapp_number: string | null } | null;
  batches: { name: string } | null;
  branches: { name: string; code: string } | null;
}

const EMPTY = {
  branch_id: "", batch_id: "", teacher_id: "", subject: "", classroom: "",
  lecture_date: format(new Date(), "yyyy-MM-dd"), start_time: "", end_time: "", topic: "",
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function TimetablePage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const fromDate = format(weekStart, "yyyy-MM-dd");
  const toDate = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: lectures } = useQuery({
    queryKey: ["lectures-week", fromDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("lectures")
        .select("*, teachers(full_name, user_id, whatsapp_number), batches(name), branches(name, code)")
        .gte("lecture_date", fromDate)
        .lte("lecture_date", toDate)
        .order("start_time");
      return (data ?? []) as unknown as LectureRow[];
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
  const { data: teachers } = useQuery({
    queryKey: ["teachers-list"],
    queryFn: async () => (await supabase.from("teachers").select("*").eq("is_active", true).order("full_name")).data ?? [],
  });

  const canEdit = me?.isAdmin ?? false;
  const visibleLectures = useMemo(() => {
    if (!lectures || !me) return [];
    if (me.isAdmin) return lectures;
    if (me.isTeacher && me.teacherId) return lectures.filter((l) => l.teacher_id === me.teacherId);
    return lectures; // students/parents see all scheduled lectures (their batch filter via dashboard)
  }, [lectures, me]);

  function openCreate(date?: Date) {
    setEditingId(null);
    setForm({ ...EMPTY, lecture_date: format(date ?? new Date(), "yyyy-MM-dd") });
    setOpen(true);
  }

  function openEdit(l: LectureRow) {
    setEditingId(l.id);
    setForm({
      branch_id: l.branch_id, batch_id: l.batch_id, teacher_id: l.teacher_id,
      subject: l.subject, classroom: l.classroom ?? "", lecture_date: l.lecture_date,
      start_time: l.start_time.slice(0, 5), end_time: l.end_time.slice(0, 5), topic: l.topic ?? "",
    });
    setOpen(true);
  }

  async function checkConflicts(): Promise<string | null> {
    const { data } = await supabase
      .from("lectures")
      .select("id, teacher_id, batch_id, classroom, start_time, end_time, teachers(full_name), batches(name)")
      .eq("lecture_date", form.lecture_date)
      .neq("status", "cancelled");
    for (const l of data ?? []) {
      if (editingId && l.id === editingId) continue;
      if (!overlaps(form.start_time, form.end_time, l.start_time.slice(0, 5), l.end_time.slice(0, 5))) continue;
      if (l.teacher_id === form.teacher_id) return `Teacher conflict: ${(l as { teachers?: { full_name?: string } }).teachers?.full_name ?? "teacher"} already has a lecture ${l.start_time.slice(0, 5)}–${l.end_time.slice(0, 5)}`;
      if (l.batch_id === form.batch_id) return `Batch conflict: ${(l as { batches?: { name?: string } }).batches?.name ?? "batch"} already has a lecture at that time`;
      if (form.classroom && l.classroom && l.classroom.toLowerCase() === form.classroom.toLowerCase())
        return `Classroom conflict: Room ${form.classroom} is occupied ${l.start_time.slice(0, 5)}–${l.end_time.slice(0, 5)}`;
    }
    return null;
  }

  async function notifyTeacher(teacherId: string, action: string) {
    const t = (teachers ?? []).find((x) => x.id === teacherId);
    if (!t) return;
    const msg = `${action}: ${form.subject}${form.topic ? ` (${form.topic})` : ""} on ${format(new Date(form.lecture_date), "EEE, d MMM")} ${form.start_time}–${form.end_time}${form.classroom ? `, Room ${form.classroom}` : ""}.`;
    await sendNotification({ userId: t.user_id, title: `Lecture ${action.toLowerCase()}`, body: msg, type: "lecture", link: "/timetable" });
    const wa = whatsappLink(t.whatsapp_number, `TutorTrack — ${msg}`);
    if (wa) {
      toast.success(`Teacher notified in-app`, {
        action: { label: "Send WhatsApp", onClick: () => window.open(wa, "_blank") },
        duration: 8000,
      });
    } else {
      toast.success("Teacher notified in-app");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.branch_id || !form.batch_id || !form.teacher_id) {
      toast.error("Branch, batch and teacher are required");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("End time must be after start time");
      return;
    }
    setSaving(true);
    const conflict = await checkConflicts();
    if (conflict) {
      setSaving(false);
      toast.error(conflict);
      return;
    }
    const payload = {
      branch_id: form.branch_id, batch_id: form.batch_id, teacher_id: form.teacher_id,
      subject: form.subject.trim(), classroom: form.classroom.trim() || null,
      lecture_date: form.lecture_date, start_time: form.start_time, end_time: form.end_time,
      topic: form.topic.trim() || null,
      ...(editingId ? { status: "rescheduled" as const, acknowledged_at: null } : {}),
    };
    const res = editingId
      ? await supabase.from("lectures").update(payload).eq("id", editingId)
      : await supabase.from("lectures").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    auditLog(editingId ? "lecture.update" : "lecture.create", "lectures", editingId ?? undefined);
    await notifyTeacher(form.teacher_id, editingId ? "Lecture updated" : "Lecture assigned");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["lectures-week"] });
  }

  async function cancelLecture(l: LectureRow) {
    if (!confirm("Cancel this lecture?")) return;
    const { error } = await supabase.from("lectures").update({ status: "cancelled" }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    await sendNotification({
      userId: l.teachers?.user_id,
      title: "Lecture cancelled",
      body: `${l.subject} on ${format(new Date(l.lecture_date), "EEE, d MMM")} ${l.start_time.slice(0, 5)} was cancelled.`,
      type: "lecture",
    });
    const wa = whatsappLink(l.teachers?.whatsapp_number, `TutorTrack — Lecture cancelled: ${l.subject} on ${format(new Date(l.lecture_date), "EEE, d MMM")} ${l.start_time.slice(0, 5)}.`);
    if (wa) {
      toast.success("Lecture cancelled — teacher notified", {
        action: { label: "Send WhatsApp", onClick: () => window.open(wa, "_blank") },
        duration: 8000,
      });
    } else toast.success("Lecture cancelled");
    queryClient.invalidateQueries({ queryKey: ["lectures-week"] });
  }

  return (
    <AppShell
      title="Timetable"
      actions={canEdit ? <Button size="sm" onClick={() => openCreate()}><Plus className="mr-1 h-4 w-4" /> Assign lecture</Button> : undefined}
    >
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <p className="text-sm font-medium">
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
        </p>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayLectures = visibleLectures.filter((l) => l.lecture_date === key);
          const isToday = key === format(new Date(), "yyyy-MM-dd");
          return (
            <div key={key} className={`rounded-xl border ${isToday ? "border-primary" : "border-border"} bg-card p-3`}>
              <div className="mb-2 flex items-center justify-between">
                <p className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>{format(d, "EEE d MMM")}</p>
                {canEdit && (
                  <button onClick={() => openCreate(d)} className="text-muted-foreground hover:text-foreground" aria-label="Add lecture">
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {dayLectures.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">—</p>}
                {dayLectures.map((l) => (
                  <div key={l.id} className={`rounded-lg border p-2 text-xs ${l.status === "cancelled" ? "border-border opacity-50" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold">{l.start_time.slice(0, 5)}–{l.end_time.slice(0, 5)}</p>
                      <div className="flex gap-1">
                        {l.status === "cancelled" && <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>}
                        {l.status === "rescheduled" && <Badge variant="secondary" className="text-[10px]">Updated</Badge>}
                        {l.acknowledged_at && <Badge variant="secondary" className="text-[10px]">✓ Ack</Badge>}
                      </div>
                    </div>
                    <p className="mt-0.5 font-medium">{l.subject}{l.topic ? ` — ${l.topic}` : ""}</p>
                    <p className="text-muted-foreground">
                      {l.batches?.name} · {l.teachers?.full_name}
                      {l.classroom ? ` · Rm ${l.classroom}` : ""} · {l.branches?.code}
                    </p>
                    {canEdit && l.status !== "cancelled" && (
                      <div className="mt-1.5 flex gap-1">
                        <button onClick={() => openEdit(l)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => cancelLecture(l)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Cancel">
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                        {l.teachers?.whatsapp_number && (
                          <a
                            href={whatsappLink(l.teachers.whatsapp_number, `TutorTrack — Reminder: ${l.subject} on ${format(new Date(l.lecture_date), "EEE, d MMM")} ${l.start_time.slice(0, 5)}–${l.end_time.slice(0, 5)}${l.classroom ? `, Room ${l.classroom}` : ""}.`) ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-success"
                            aria-label="WhatsApp teacher"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit lecture" : "Assign lecture"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
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
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {(teachers ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Topic (optional)</Label>
                <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" required value={form.lecture_date} onChange={(e) => setForm({ ...form, lecture_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Classroom</Label>
                <Input value={form.classroom} onChange={(e) => setForm({ ...form, classroom: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Checking conflicts…" : editingId ? "Save & notify teacher" : "Assign & notify teacher"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
