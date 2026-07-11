import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

const STUDENT_STATUSES = ["present", "absent", "late"] as const;
const TEACHER_STATUSES = ["present", "absent", "late", "half_day", "leave"] as const;

function AttendancePage() {
  const { data: me } = useMe();
  if (me && !me.isAdmin && !me.isTeacher) {
    return (
      <AppShell title="Attendance">
        <p className="py-10 text-center text-sm text-muted-foreground">You don't have access to attendance marking.</p>
      </AppShell>
    );
  }
  return (
    <AppShell title="Attendance">
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          {me?.isAdmin && <TabsTrigger value="teachers">Teachers</TabsTrigger>}
        </TabsList>
        <TabsContent value="students"><StudentAttendance /></TabsContent>
        {me?.isAdmin && <TabsContent value="teachers"><TeacherAttendance /></TabsContent>}
      </Tabs>
    </AppShell>
  );
}

function StudentAttendance() {
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: batches } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => (await supabase.from("batches").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  const { data: students } = useQuery({
    queryKey: ["batch-students", batchId],
    enabled: !!batchId,
    queryFn: async () =>
      (await supabase.from("students").select("*").eq("batch_id", batchId).eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: records } = useQuery({
    queryKey: ["student-attendance", batchId, date],
    enabled: !!batchId,
    queryFn: async () =>
      (await supabase.from("student_attendance").select("*").eq("batch_id", batchId).eq("attendance_date", date)).data ?? [],
  });

  async function mark(studentId: string, status: (typeof STUDENT_STATUSES)[number]) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("student_attendance").upsert(
      { student_id: studentId, batch_id: batchId, attendance_date: date, status, marked_by: u.user?.id ?? null },
      { onConflict: "student_id,attendance_date" },
    );
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["student-attendance", batchId, date] });
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Batch</Label>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select batch" /></SelectTrigger>
            <SelectContent>
              {(batches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {!batchId && <p className="py-8 text-center text-sm text-muted-foreground">Select a batch to mark attendance.</p>}

      {batchId && (
        <div className="space-y-2">
          {(students ?? []).map((s) => {
            const rec = (records ?? []).find((r) => r.student_id === s.id);
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
                <p className="text-sm font-medium">{s.full_name}</p>
                <div className="flex gap-1.5">
                  {STUDENT_STATUSES.map((st) => (
                    <Button
                      key={st}
                      size="sm"
                      variant={rec?.status === st ? "default" : "outline"}
                      className={cn("capitalize", rec?.status === st && st === "absent" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                      onClick={() => mark(s.id, st)}
                    >
                      {st}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          {(students ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No students in this batch.</p>}
        </div>
      )}
    </div>
  );
}

function TeacherAttendance() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: teachers } = useQuery({
    queryKey: ["teachers-list"],
    queryFn: async () => (await supabase.from("teachers").select("*").eq("is_active", true).order("full_name")).data ?? [],
  });

  const { data: records } = useQuery({
    queryKey: ["teacher-attendance", date],
    queryFn: async () =>
      (await supabase.from("teacher_attendance").select("*").eq("attendance_date", date)).data ?? [],
  });

  async function mark(teacherId: string, status: (typeof TEACHER_STATUSES)[number]) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("teacher_attendance").upsert(
      { teacher_id: teacherId, attendance_date: date, status, marked_by: u.user?.id ?? null },
      { onConflict: "teacher_id,attendance_date" },
    );
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["teacher-attendance", date] });
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        {(teachers ?? []).map((t) => {
          const rec = (records ?? []).find((r) => r.teacher_id === t.id);
          return (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
              <p className="text-sm font-medium">{t.full_name}</p>
              <Select value={rec?.status ?? ""} onValueChange={(v) => mark(t.id, v as (typeof TEACHER_STATUSES)[number])}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Mark" /></SelectTrigger>
                <SelectContent>
                  {TEACHER_STATUSES.map((st) => (
                    <SelectItem key={st} value={st} className="capitalize">{st.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
        {(teachers ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No teachers yet.</p>}
      </div>
    </div>
  );
}
