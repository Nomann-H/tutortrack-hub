import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/parents")({
  component: ParentsPage,
});

function ParentsPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", email: "", relationship: "Parent" });

  const { data: students } = useQuery({
    queryKey: ["students-with-parents"],
    queryFn: async () => {
      const { data: sData } = await supabase
        .from("students")
        .select("id, full_name, guardian_name, batches(name), branches(name), student_parents(id, user_id, relationship)")
        .eq("is_active", true)
        .order("full_name");
      const students = sData ?? [];
      const parentIds = Array.from(new Set(students.flatMap((s) => (s.student_parents ?? []).map((p: { user_id: string }) => p.user_id))));
      let profileMap: Record<string, { full_name: string | null; email: string }> = {};
      if (parentIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", parentIds);
        profileMap = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
      }
      return students.map((s) => ({
        ...s,
        parent_links: (s.student_parents ?? []).map((p: { id: string; user_id: string; relationship: string | null }) => ({
          id: p.id,
          relationship: p.relationship,
          profile: profileMap[p.user_id] ?? null,
        })),
      }));
    },
  });

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student_id || !form.email) return;

    // find profile by email
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", form.email.trim().toLowerCase()).maybeSingle();
    if (!profile) return toast.error("No user found with that email. Ask them to sign up first.");

    // ensure they have the parent role
    const { data: existingRole } = await supabase.from("user_roles").select("id").eq("user_id", profile.id).eq("role", "parent").maybeSingle();
    if (!existingRole) {
      const { error: rErr } = await supabase.from("user_roles").insert({ user_id: profile.id, role: "parent" });
      if (rErr) return toast.error(rErr.message);
    }

    const { error } = await supabase.from("student_parents").insert({
      student_id: form.student_id,
      user_id: profile.id,
      relationship: form.relationship || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Parent linked");

    await supabase.from("notifications").insert({
      user_id: profile.id,
      title: "You have been linked as a parent",
      body: "You can now view your child's progress in TutorTrack.",
      type: "general",
      link: "/dashboard",
    });

    setForm({ student_id: "", email: "", relationship: "Parent" });
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["students-with-parents"] });
  }

  async function removeLink(id: string) {
    if (!confirm("Unlink this parent?")) return;
    const { error } = await supabase.from("student_parents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["students-with-parents"] });
  }

  if (me && !me.isAdmin) {
    return <AppShell title="Parents"><p className="py-10 text-center text-sm text-muted-foreground">Admins only.</p></AppShell>;
  }

  return (
    <AppShell
      title="Parents"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Link parent</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Link a parent to a student</DialogTitle></DialogHeader>
            <form onSubmit={addLink} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Student</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {(students ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Parent's account email</Label>
                <Input type="email" required placeholder="parent@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <p className="text-xs text-muted-foreground">The parent must already have signed up in TutorTrack.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Relationship</Label>
                <Input placeholder="Father / Mother / Guardian" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Link parent</Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-3">
        {(students ?? []).map((s) => {
          const links = s.parent_links ?? [];
          return (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.batches?.name || "No batch"} · {s.branches?.name || ""}
                    {s.guardian_name ? ` · Guardian on file: ${s.guardian_name}` : ""}
                  </p>
                </div>
                <Badge variant="secondary"><Users className="mr-1 h-3 w-3" /> {links.length} linked</Badge>
              </div>
              {links.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {links.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{l.profile?.full_name || l.profile?.email}</p>
                        <p className="text-xs text-muted-foreground">{l.profile?.email}{l.relationship ? ` · ${l.relationship}` : ""}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeLink(l.id)} aria-label="Unlink">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {(students ?? []).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No students yet.</p>}
      </div>
    </AppShell>
  );
}
