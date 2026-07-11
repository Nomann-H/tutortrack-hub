import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays, addDays } from "date-fns";
import { Building2, GraduationCap, School, UserSquare2, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <DashboardBody />
    </AppShell>
  );
}

function DashboardBody() {
  const { data: me } = useMe();
  if (!me) return null;
  if (!me.primaryRole) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-medium">Your account is awaiting a role assignment.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask your institute owner or branch admin to assign you a role.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (me.isAdmin) return <AdminDashboard />;
  if (me.isTeacher) return <TeacherDashboard teacherId={me.teacherId} />;
  return <StudentDashboard studentId={me.studentId} />;
}

function StatCard({ icon: Icon, label, value, to }: { icon: typeof Building2; label: string; value: number | string; to?: string }) {
  const body = (
    <div className="stat-card flex items-center gap-4 transition-shadow hover:shadow-md">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [branches, teachers, students, batches] = await Promise.all([
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("batches").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        branches: branches.count ?? 0,
        teachers: teachers.count ?? 0,
        students: students.count ?? 0,
        batches: batches.count ?? 0,
      };
    },
  });

  const { data: attendanceTrend } = useQuery({
    queryKey: ["attendance-trend"],
    queryFn: async () => {
      const from = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data } = await supabase
        .from("student_attendance")
        .select("attendance_date,status")
        .gte("attendance_date", from);
      const days: { day: string; percent: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        const rows = (data ?? []).filter((r) => r.attendance_date === d);
        const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
        days.push({ day: format(subDays(new Date(), i), "EEE"), percent: rows.length ? Math.round((present / rows.length) * 100) : 0 });
      }
      return days;
    },
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: todayLectures } = useQuery({
    queryKey: ["today-lectures"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lectures")
        .select("*, teachers(full_name), batches(name), branches(name)")
        .eq("lecture_date", today)
        .neq("status", "cancelled")
        .order("start_time");
      return data ?? [];
    },
  });

  const { data: pendingLeaves } = useQuery({
    queryKey: ["pending-leaves-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Branches" value={stats?.branches ?? "—"} to="/branches" />
        <StatCard icon={UserSquare2} label="Teachers" value={stats?.teachers ?? "—"} to="/teachers" />
        <StatCard icon={GraduationCap} label="Students" value={stats?.students ?? "—"} to="/students" />
        <StatCard icon={School} label="Batches" value={stats?.batches ?? "—"} to="/batches" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student attendance — last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceTrend ?? []}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis unit="%" tickLine={false} axisLine={false} fontSize={12} width={40} />
                <Tooltip formatter={(v) => [`${v}%`, "Present"]} />
                <Bar dataKey="percent" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Today's lectures</CardTitle>
            {!!pendingLeaves && pendingLeaves > 0 && (
              <Link to="/leaves">
                <Badge variant="destructive">{pendingLeaves} pending leave{pendingLeaves > 1 ? "s" : ""}</Badge>
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {(todayLectures ?? []).length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No lectures scheduled today.</p>
            )}
            {(todayLectures ?? []).slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{l.subject}{l.topic ? ` — ${l.topic}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.batches?.name} · {l.teachers?.full_name} · {l.branches?.name}
                  </p>
                </div>
                <span className="text-xs font-medium">{l.start_time.slice(0, 5)}–{l.end_time.slice(0, 5)}</span>
              </div>
            ))}
            <Link to="/timetable" className="block pt-1 text-center text-sm text-primary underline-offset-4 hover:underline">
              Open timetable →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TeacherDashboard({ teacherId }: { teacherId: string | null }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const { data: lectures } = useQuery({
    queryKey: ["teacher-lectures", teacherId],
    enabled: !!teacherId,
    queryFn: async () => {
      const { data } = await supabase
        .from("lectures")
        .select("*, batches(name), branches(name)")
        .eq("teacher_id", teacherId!)
        .in("lecture_date", [today, tomorrow])
        .neq("status", "cancelled")
        .order("lecture_date")
        .order("start_time");
      return data ?? [];
    },
  });

  async function acknowledge(id: string) {
    const { error } = await supabase.from("lectures").update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule acknowledged");
      queryClient.invalidateQueries({ queryKey: ["teacher-lectures"] });
    }
  }

  if (!teacherId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Your teacher profile isn't linked yet. Ask your branch admin to link your account email on your teacher record.
        </CardContent>
      </Card>
    );
  }

  const todays = (lectures ?? []).filter((l) => l.lecture_date === today);
  const tomorrows = (lectures ?? []).filter((l) => l.lecture_date === tomorrow);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[{ label: "Today", rows: todays }, { label: "Tomorrow", rows: tomorrows }].map((sec) => (
        <Card key={sec.label}>
          <CardHeader>
            <CardTitle className="text-base">{sec.label}'s lectures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sec.rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p>}
            {sec.rows.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{l.subject}{l.topic ? ` — ${l.topic}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.batches?.name} · {l.branches?.name}{l.classroom ? ` · Room ${l.classroom}` : ""} · {l.start_time.slice(0, 5)}–{l.end_time.slice(0, 5)}
                  </p>
                </div>
                {l.acknowledged_at ? (
                  <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-4 w-4" /> Ack'd</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => acknowledge(l.id)}>Acknowledge</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StudentDashboard({ studentId }: { studentId: string | null }) {
  const { data } = useQuery({
    queryKey: ["student-dashboard", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const [student, attendance] = await Promise.all([
        supabase.from("students").select("*, batches(name), branches(name)").eq("id", studentId!).maybeSingle(),
        supabase.from("student_attendance").select("status").eq("student_id", studentId!),
      ]);
      const rows = attendance.data ?? [];
      const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
      return {
        student: student.data,
        total: rows.length,
        percent: rows.length ? Math.round((present / rows.length) * 100) : null,
      };
    },
  });

  if (!studentId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Your student profile isn't linked yet. Ask your branch admin to link your account email on your student record.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={School} label="My batch" value={data?.student?.batches?.name ?? "—"} />
        <StatCard icon={Building2} label="Branch" value={data?.student?.branches?.name ?? "—"} />
        <StatCard icon={CheckCircle2} label="Attendance" value={data?.percent != null ? `${data.percent}%` : "—"} />
      </div>
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          View your class schedule on the <Link to="/timetable" className="text-primary underline-offset-4 hover:underline">Timetable</Link> page
          and institute updates under <Link to="/announcements" className="text-primary underline-offset-4 hover:underline">Announcements</Link>.
        </CardContent>
      </Card>
    </div>
  );
}
