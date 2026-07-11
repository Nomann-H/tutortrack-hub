import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { sendNotification } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/leaves")({
  component: LeavesPage,
});

const LEAVE_TYPES = [
  { value: "sick", label: "Sick Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "emergency", label: "Emergency Leave" },
  { value: "half_day", label: "Half Day" },
] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

function LeavesPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const { data: leaves } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, teachers(full_name, user_id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.teacherId) {
      toast.error("Your teacher profile isn't linked yet.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("leave_requests").insert({
      teacher_id: me.teacherId,
      leave_type: form.leave_type as "sick" | "casual" | "emergency" | "half_day",
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      reason: form.reason.trim(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    // Notify all admins
    const { data: admins } = await supabase.from("user_roles").select("user_id").in("role", ["super_admin", "branch_admin"]);
    const uniqueAdmins = [...new Set((admins ?? []).map((a) => a.user_id))];
    await Promise.all(
      uniqueAdmins.map((uid) =>
        sendNotification({
          userId: uid,
          title: "New leave request",
          body: `${me.profile?.full_name ?? "A teacher"} applied for ${form.leave_type.replace("_", " ")} leave (${form.start_date}${form.end_date && form.end_date !== form.start_date ? ` → ${form.end_date}` : ""}).`,
          type: "leave",
          link: "/leaves",
        }),
      ),
    );
    toast.success("Leave request submitted");
    setOpen(false);
    setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
    queryClient.invalidateQueries({ queryKey: ["leaves"] });
  }

  async function review(id: string, status: "approved" | "rejected", teacherUserId: string | null) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("leave_requests")
      .update({ status, remarks: remarks[id] || null, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    await sendNotification({
      userId: teacherUserId,
      title: `Leave ${status}`,
      body: remarks[id] ? `Remarks: ${remarks[id]}` : `Your leave request was ${status}.`,
      type: "leave",
      link: "/leaves",
    });
    toast.success(`Leave ${status}`);
    queryClient.invalidateQueries({ queryKey: ["leaves"] });
  }

  const isTeacherOnly = me?.isTeacher && !me?.isAdmin;

  return (
    <AppShell
      title="Leave Management"
      actions={
        me?.isTeacher ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Apply for leave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for leave</DialogTitle>
              </DialogHeader>
              <form onSubmit={apply} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Leave type</Label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>From</Label>
                    <Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>To (optional)</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Submitting…" : "Submit request"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {(leaves ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isTeacherOnly ? "You haven't applied for any leave yet." : "No leave requests yet."}
          </p>
        )}
        {(leaves ?? []).map((l) => (
          <div key={l.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {l.teachers?.full_name} · <span className="capitalize">{l.leave_type.replace("_", " ")}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(l.start_date), "d MMM")}{l.end_date !== l.start_date ? ` → ${format(new Date(l.end_date), "d MMM")}` : ""} · {l.reason}
                </p>
                {l.remarks && <p className="mt-1 text-xs text-muted-foreground">Remarks: {l.remarks}</p>}
              </div>
              <Badge variant={STATUS_VARIANT[l.status]} className="capitalize">{l.status}</Badge>
            </div>
            {me?.isAdmin && l.status === "pending" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Remarks (optional)"
                  className="max-w-xs"
                  value={remarks[l.id] ?? ""}
                  onChange={(e) => setRemarks({ ...remarks, [l.id]: e.target.value })}
                />
                <Button size="sm" onClick={() => review(l.id, "approved", l.teachers?.user_id ?? null)}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => review(l.id, "rejected", l.teachers?.user_id ?? null)}>Reject</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
