import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/tests")({
  component: TestsPage,
});

function TestsPage() {
  const { data: me } = useMe();
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  if (!me) return null;

  if (selectedTest) {
    return <TestMarksView testId={selectedTest} onBack={() => setSelectedTest(null)} />;
  }

  if (me.isStudent) return <StudentTestsView me={me} />;
  if (me.isParent && !me.isAdmin && !me.isTeacher) return <ParentTestsView me={me} />;
  return <TestsList me={me} onOpen={setSelectedTest} />;
}

function TestsList({ me, onOpen }: { me: NonNullable<ReturnType<typeof useMe>["data"]>; onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    batch_id: "",
    title: "",
    subject: "",
    test_date: format(new Date(), "yyyy-MM-dd"),
    max_marks: "100",
    description: "",
  });

  const canEdit = me.isAdmin || me.isTeacher;

  const { data: batches } = useQuery({
    queryKey: ["batches-select"],
    queryFn: async () => (await supabase.from("batches").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: tests } = useQuery({
    queryKey: ["tests-all"],
    queryFn: async () =>
      (await supabase.from("tests").select("*, batches(name)").order("test_date", { ascending: false })).data ?? [],
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.batch_id) return toast.error("Select a batch");
    const { error } = await supabase.from("tests").insert({
      batch_id: form.batch_id,
      title: form.title.trim(),
      subject: form.subject.trim() || null,
      test_date: form.test_date,
      max_marks: Number(form.max_marks) || 100,
      description: form.description.trim() || null,
      created_by: me.userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Test created");
    setOpen(false);
    setForm({ batch_id: "", title: "", subject: "", test_date: format(new Date(), "yyyy-MM-dd"), max_marks: "100", description: "" });
    queryClient.invalidateQueries({ queryKey: ["tests-all"] });
  }

  return (
    <AppShell
      title="Tests & Marks"
      actions={
        canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New test</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create test</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Batch</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(batches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Title</Label><Input required placeholder="e.g. Sunday Test #4" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Max marks</Label><Input type="number" min="1" required value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button type="submit" className="w-full">Create test</Button>
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
              <TableHead>Test</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden md:table-cell">Max</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tests ?? []).map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpen(t.id)}>
                <TableCell><p className="font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.subject || ""}</p></TableCell>
                <TableCell><Badge variant="secondary">{t.batches?.name}</Badge></TableCell>
                <TableCell className="hidden md:table-cell text-sm">{format(new Date(t.test_date), "dd MMM yyyy")}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{t.max_marks}</TableCell>
                <TableCell><Button variant="ghost" size="sm">Open →</Button></TableCell>
              </TableRow>
            ))}
            {(tests ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No tests yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

function TestMarksView({ testId, onBack }: { testId: string; onBack: () => void }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const { data: test } = useQuery({
    queryKey: ["test", testId],
    queryFn: async () => (await supabase.from("tests").select("*, batches(name)").eq("id", testId).maybeSingle()).data,
  });

  const { data: students } = useQuery({
    queryKey: ["batch-students-for-marks", test?.batch_id],
    enabled: !!test?.batch_id,
    queryFn: async () =>
      (await supabase.from("students").select("id,full_name").eq("batch_id", test!.batch_id).eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: marks } = useQuery({
    queryKey: ["test-marks", testId],
    queryFn: async () => (await supabase.from("test_marks").select("*").eq("test_id", testId)).data ?? [],
  });

  const [drafts, setDrafts] = useState<Record<string, { marks: string; absent: boolean; remarks: string }>>({});

  const stats = useMemo(() => {
    const scores = (marks ?? []).filter((m) => !m.is_absent && m.marks_obtained != null).map((m) => Number(m.marks_obtained));
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { avg, max: Math.max(...scores), min: Math.min(...scores), count: scores.length };
  }, [marks]);

  const chartData = useMemo(() => {
    if (!test || !marks || !students) return [];
    return students.map((s) => {
      const m = marks.find((x) => x.student_id === s.id);
      return {
        name: s.full_name.split(" ")[0],
        score: m?.is_absent ? 0 : m?.marks_obtained != null ? Number(m.marks_obtained) : 0,
      };
    });
  }, [students, marks, test]);

  async function saveRow(studentId: string) {
    const d = drafts[studentId];
    if (!d) return;
    const payload = {
      test_id: testId,
      student_id: studentId,
      marks_obtained: d.absent || d.marks === "" ? null : Number(d.marks),
      is_absent: d.absent,
      remarks: d.remarks || null,
      entered_by: me?.userId ?? null,
    };
    const { error } = await supabase.from("test_marks").upsert(payload, { onConflict: "test_id,student_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      setDrafts((prev) => { const n = { ...prev }; delete n[studentId]; return n; });
      queryClient.invalidateQueries({ queryKey: ["test-marks", testId] });
    }
  }

  const canEdit = me?.isAdmin || me?.isTeacher;

  return (
    <AppShell
      title={test?.title ?? "Test"}
      actions={<Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>}
    >
      <div className="space-y-6">
        {test && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            <p><span className="text-muted-foreground">Batch:</span> {test.batches?.name} · <span className="text-muted-foreground">Date:</span> {format(new Date(test.test_date), "dd MMM yyyy")} · <span className="text-muted-foreground">Max:</span> {test.max_marks}</p>
            {test.description && <p className="mt-1 text-muted-foreground">{test.description}</p>}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Average</p><p className="text-2xl font-semibold">{stats.avg.toFixed(1)}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Highest</p><p className="text-2xl font-semibold">{stats.max}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Lowest</p><p className="text-2xl font-semibold">{stats.min}</p></CardContent></Card>
            <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Scored</p><p className="text-2xl font-semibold">{stats.count}</p></CardContent></Card>
          </div>
        )}

        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Scores</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                  <Tooltip />
                  <Bar dataKey="score" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Marks / {test?.max_marks ?? 100}</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead className="hidden md:table-cell">Remarks</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map((s) => {
                const existing = marks?.find((m) => m.student_id === s.id);
                const d = drafts[s.id] ?? {
                  marks: existing?.marks_obtained != null ? String(existing.marks_obtained) : "",
                  absent: existing?.is_absent ?? false,
                  remarks: existing?.remarks ?? "",
                };
                const dirty = !!drafts[s.id];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={test?.max_marks ?? 100}
                        disabled={!canEdit || d.absent}
                        className="w-24"
                        value={d.marks}
                        onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, marks: e.target.value } })}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={d.absent}
                        onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, absent: e.target.checked } })}
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Input
                        disabled={!canEdit}
                        value={d.remarks}
                        onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, remarks: e.target.value } })}
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="sm" variant={dirty ? "default" : "outline"} onClick={() => saveRow(s.id)}>Save</Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {(students ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No students in this batch.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}

function StudentTestsView({ me }: { me: NonNullable<ReturnType<typeof useMe>["data"]> }) {
  const { data } = useQuery({
    queryKey: ["my-tests", me.studentId],
    enabled: !!me.studentId,
    queryFn: async () => {
      const { data: marks } = await supabase
        .from("test_marks")
        .select("*, tests(*, batches(name))")
        .eq("student_id", me.studentId!);
      return marks ?? [];
    },
  });

  return (
    <AppShell title="My Tests & Marks">
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="hidden md:table-cell">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).sort((a, b) => (b.tests?.test_date ?? "").localeCompare(a.tests?.test_date ?? "")).map((m) => (
              <TableRow key={m.id}>
                <TableCell><p className="font-medium">{m.tests?.title}</p><p className="text-xs text-muted-foreground">{m.tests?.subject || ""}</p></TableCell>
                <TableCell className="text-sm">{m.tests ? format(new Date(m.tests.test_date), "dd MMM yyyy") : ""}</TableCell>
                <TableCell>{m.is_absent ? <Badge variant="destructive">Absent</Badge> : <span className="font-semibold">{m.marks_obtained} / {m.tests?.max_marks}</span>}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.remarks || "—"}</TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No marks recorded yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}

function ParentTestsView({ me }: { me: NonNullable<ReturnType<typeof useMe>["data"]> }) {
  const { data: children } = useQuery({
    queryKey: ["my-children", me.userId],
    queryFn: async () => (await supabase.from("student_parents").select("student_id, students(id, full_name)").eq("user_id", me.userId)).data ?? [],
  });

  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected ?? children?.[0]?.student_id ?? null;

  const { data: marks } = useQuery({
    queryKey: ["child-marks", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await supabase.from("test_marks").select("*, tests(*)").eq("student_id", activeId!)).data ?? [],
  });

  return (
    <AppShell title="My Child's Tests">
      <div className="space-y-4">
        {(children?.length ?? 0) > 1 && (
          <Select value={activeId ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {children!.map((c) => <SelectItem key={c.student_id} value={c.student_id}>{c.students?.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Date</TableHead><TableHead>Score</TableHead></TableRow></TableHeader>
            <TableBody>
              {(marks ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell><p className="font-medium">{m.tests?.title}</p><p className="text-xs text-muted-foreground">{m.tests?.subject || ""}</p></TableCell>
                  <TableCell className="text-sm">{m.tests ? format(new Date(m.tests.test_date), "dd MMM yyyy") : ""}</TableCell>
                  <TableCell>{m.is_absent ? <Badge variant="destructive">Absent</Badge> : <span className="font-semibold">{m.marks_obtained} / {m.tests?.max_marks}</span>}</TableCell>
                </TableRow>
              ))}
              {(marks ?? []).length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">No marks yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
