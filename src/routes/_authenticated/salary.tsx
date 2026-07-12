import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/salary")({
  component: SalaryPage,
});

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function SalaryPage() {
  const { data: me } = useMe();
  if (!me) return null;
  if (me.isAdmin) return <AdminSalary />;
  if (me.isTeacher) return <TeacherSalary teacherId={me.teacherId} />;
  return <AppShell title="Salary"><p className="py-10 text-center text-sm text-muted-foreground">You don't have access.</p></AppShell>;
}

function AdminSalary() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dlgTeacher, setDlgTeacher] = useState<{ id: string; name: string; base: number } | null>(null);
  const [form, setForm] = useState({ base_salary: "0", bonus: "0", deductions: "0", is_paid: false, payment_method: "", notes: "" });

  const { data: teachers } = useQuery({
    queryKey: ["teachers-with-salary", year, month],
    queryFn: async () => {
      const [tRes, pRes] = await Promise.all([
        supabase.from("teachers").select("id, full_name, monthly_salary").eq("is_active", true).order("full_name"),
        supabase.from("salary_payments").select("*").eq("year", year).eq("month", month),
      ]);
      const payments = pRes.data ?? [];
      return (tRes.data ?? []).map((t) => ({ ...t, payment: payments.find((p) => p.teacher_id === t.id) }));
    },
  });

  const totals = useMemo(() => {
    const rows = teachers ?? [];
    const totalPayroll = rows.reduce((sum, t) => sum + Number(t.payment?.net_amount ?? t.monthly_salary ?? 0), 0);
    const paid = rows.filter((t) => t.payment?.is_paid).reduce((sum, t) => sum + Number(t.payment?.net_amount ?? 0), 0);
    return { totalPayroll, paid, pending: totalPayroll - paid, count: rows.length };
  }, [teachers]);

  function openDlg(t: { id: string; full_name: string; monthly_salary: number | null; payment?: any }) {
    const p = t.payment;
    setDlgTeacher({ id: t.id, name: t.full_name, base: Number(t.monthly_salary ?? 0) });
    setForm({
      base_salary: String(p?.base_salary ?? t.monthly_salary ?? 0),
      bonus: String(p?.bonus ?? 0),
      deductions: String(p?.deductions ?? 0),
      is_paid: !!p?.is_paid,
      payment_method: p?.payment_method ?? "",
      notes: p?.notes ?? "",
    });
  }

  const netPreview = Number(form.base_salary || 0) + Number(form.bonus || 0) - Number(form.deductions || 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dlgTeacher) return;
    const payload = {
      teacher_id: dlgTeacher.id,
      month,
      year,
      base_salary: Number(form.base_salary || 0),
      bonus: Number(form.bonus || 0),
      deductions: Number(form.deductions || 0),
      net_amount: netPreview,
      is_paid: form.is_paid,
      paid_at: form.is_paid ? new Date().toISOString() : null,
      payment_method: form.payment_method.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("salary_payments").upsert(payload, { onConflict: "teacher_id,month,year" });
    if (error) return toast.error(error.message);
    toast.success("Salary record saved");

    // notify teacher on payment
    if (form.is_paid) {
      const { data: t } = await supabase.from("teachers").select("user_id").eq("id", dlgTeacher.id).maybeSingle();
      if (t?.user_id) {
        await supabase.from("notifications").insert({
          user_id: t.user_id,
          title: "Salary paid",
          body: `Your salary for ${MONTHS[month - 1]} ${year} (₹${netPreview}) has been paid.`,
          type: "salary",
          link: "/salary",
        });
      }
    }
    setDlgTeacher(null);
    queryClient.invalidateQueries({ queryKey: ["teachers-with-salary"] });
  }

  const years = [year - 1, year, year + 1];

  return (
    <AppShell title="Salary">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5"><Label>Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Teachers</p><p className="text-2xl font-semibold">{totals.count}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Total payroll</p><p className="text-2xl font-semibold">₹{totals.totalPayroll.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-semibold text-success">₹{totals.paid.toLocaleString()}</p></CardContent></Card>
          <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-semibold text-destructive">₹{totals.pending.toLocaleString()}</p></CardContent></Card>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Base</TableHead>
                <TableHead className="hidden md:table-cell">Bonus</TableHead>
                <TableHead className="hidden md:table-cell">Deduct</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(teachers ?? []).map((t) => {
                const p = t.payment;
                const net = p?.net_amount ?? t.monthly_salary ?? 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell>₹{Number(p?.base_salary ?? t.monthly_salary ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell">₹{Number(p?.bonus ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell">₹{Number(p?.deductions ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">₹{Number(net).toLocaleString()}</TableCell>
                    <TableCell>
                      {p?.is_paid ? (
                        <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" /> Paid</Badge>
                      ) : p ? (
                        <Badge variant="secondary">Draft</Badge>
                      ) : (
                        <Badge variant="outline">Not created</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDlg(t)}>
                        {p?.is_paid ? "View" : "Manage"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(teachers ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No teachers.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!dlgTeacher} onOpenChange={(o) => !o && setDlgTeacher(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dlgTeacher?.name} — {MONTHS[month - 1]} {year}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Base</Label><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bonus</Label><Input type="number" step="0.01" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Deductions</Label><Input type="number" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-sm">
              <span className="text-muted-foreground">Net payable:</span> <span className="font-semibold">₹{netPreview.toLocaleString()}</span>
            </div>
            <div className="space-y-1.5"><Label>Payment method</Label><Input placeholder="Bank / UPI / Cash" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} />
              Mark as paid
            </label>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TeacherSalary({ teacherId }: { teacherId: string | null }) {
  const { data } = useQuery({
    queryKey: ["my-salary", teacherId],
    enabled: !!teacherId,
    queryFn: async () =>
      (await supabase.from("salary_payments").select("*").eq("teacher_id", teacherId!).order("year", { ascending: false }).order("month", { ascending: false })).data ?? [],
  });

  if (!teacherId) {
    return <AppShell title="Salary"><p className="py-10 text-center text-sm text-muted-foreground">Your teacher profile isn't linked yet.</p></AppShell>;
  }

  const totalPaid = (data ?? []).filter((p) => p.is_paid).reduce((s, p) => s + Number(p.net_amount ?? 0), 0);

  return (
    <AppShell title="My Salary">
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary"><Wallet className="h-6 w-6" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total received</p>
              <p className="text-2xl font-semibold">₹{totalPaid.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Deduct</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Paid on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{MONTHS[p.month - 1]} {p.year}</TableCell>
                  <TableCell>₹{Number(p.base_salary).toLocaleString()}</TableCell>
                  <TableCell>₹{Number(p.bonus).toLocaleString()}</TableCell>
                  <TableCell>₹{Number(p.deductions).toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">₹{Number(p.net_amount).toLocaleString()}</TableCell>
                  <TableCell>{p.is_paid ? <Badge className="bg-success text-success-foreground">Paid</Badge> : <Badge variant="secondary">Pending</Badge>}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "dd MMM yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No salary records yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
