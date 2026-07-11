import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/announcements")({
  component: AnnouncementsPage,
});

const AUDIENCES = [
  { value: "all", label: "Entire institute" },
  { value: "teachers", label: "Teachers" },
  { value: "students", label: "Students" },
  { value: "parents", label: "Parents" },
] as const;

function AnnouncementsPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all", branch_id: "" });
  const [saving, setSaving] = useState(false);

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*, branches(name, code)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await supabase.from("branches").select("*").eq("is_active", true).order("name")).data ?? [],
  });

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("announcements").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      branch_id: form.branch_id || null,
      created_by: u.user?.id ?? null,
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Fan out in-app notifications to the audience
    let roleFilter: string[] = [];
    if (form.audience === "teachers") roleFilter = ["teacher"];
    else if (form.audience === "students") roleFilter = ["student"];
    else if (form.audience === "parents") roleFilter = ["parent"];
    const rolesQuery = supabase.from("user_roles").select("user_id");
    const { data: targets } = roleFilter.length ? await rolesQuery.in("role", roleFilter as ("teacher" | "student" | "parent")[]) : await rolesQuery;
    const unique = [...new Set((targets ?? []).map((t) => t.user_id))].slice(0, 500);
    await Promise.all(
      unique.map((uid) =>
        sendNotification({ userId: uid, title: `📢 ${form.title.trim()}`, body: form.body.trim().slice(0, 200), type: "announcement", link: "/announcements" }),
      ),
    );
    setSaving(false);
    toast.success("Announcement published & notifications sent");
    setOpen(false);
    setForm({ title: "", body: "", audience: "all", branch_id: "" });
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <AppShell
      title="Announcements"
      actions={
        me?.isAdmin ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New announcement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Broadcast announcement</DialogTitle>
              </DialogHeader>
              <form onSubmit={publish} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Message</Label>
                  <Textarea required rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Audience</Label>
                    <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Branch (optional)</Label>
                    <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                      <SelectContent>
                        {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Publishing…" : "Publish & notify"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {(announcements ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No announcements yet.</p>
        )}
        {(announcements ?? []).map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="capitalize">{a.audience === "all" ? "Everyone" : a.audience}</Badge>
                    {a.branches && <Badge variant="secondary">{a.branches.name}</Badge>}
                    <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
              {me?.isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
