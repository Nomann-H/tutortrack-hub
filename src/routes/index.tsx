import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarDays, ClipboardCheck, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TutorTrack — Multi-Branch Tuition Management ERP" },
      {
        name: "description",
        content:
          "Run your coaching institute with TutorTrack: branches, batches, timetables, attendance, leave management, announcements and WhatsApp notifications.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Building2, title: "Multi-branch", desc: "Unlimited branches with secure data isolation and branch-wise dashboards." },
  { icon: CalendarDays, title: "Smart timetables", desc: "Conflict-free lecture scheduling with instant teacher notifications." },
  { icon: ClipboardCheck, title: "Attendance", desc: "Teacher and student attendance with automatic percentages and reports." },
  { icon: Users, title: "Every role covered", desc: "Portals for owners, branch admins, teachers, students and parents." },
  { icon: MessageCircle, title: "WhatsApp ready", desc: "One-tap WhatsApp updates for schedules, leaves and announcements." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-lg text-primary-foreground">T</div>
          <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>TutorTrack</span>
        </div>
        <Link to="/auth">
          <Button>Sign in</Button>
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center md:pt-20">
        <p className="mb-4 inline-block rounded-full border border-border bg-secondary px-4 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
          Tuition Management ERP
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Run every branch of your institute from one place
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          Branches, batches, timetables, attendance, leave approvals and announcements — with instant
          in-app and WhatsApp notifications for your teachers.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Get started</Button>
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">The first account created becomes the institute owner.</p>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="stat-card text-left">
            <f.icon className="mb-3 h-6 w-6 text-primary" />
            <h3 className="text-base font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        TutorTrack — built for coaching institutes of every size.
      </footer>
    </div>
  );
}
