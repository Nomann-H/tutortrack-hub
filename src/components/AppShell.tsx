import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  NotebookPen,
  School,
  Users,
  UserSquare2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useMe, roleLabel } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  show: (m: NonNullable<ReturnType<typeof useMe>["data"]>) => boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { to: "/branches", label: "Branches", icon: Building2, show: (m) => m.isSuperAdmin },
  { to: "/users", label: "Users & Roles", icon: Users, show: (m) => m.isSuperAdmin },
  { to: "/teachers", label: "Teachers", icon: UserSquare2, show: (m) => m.isAdmin },
  { to: "/students", label: "Students", icon: GraduationCap, show: (m) => m.isAdmin || m.isTeacher },
  { to: "/batches", label: "Batches", icon: School, show: (m) => m.isAdmin || m.isTeacher },
  { to: "/timetable", label: "Timetable", icon: CalendarDays, show: () => true },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck, show: (m) => m.isAdmin || m.isTeacher },
  { to: "/leaves", label: "Leaves", icon: NotebookPen, show: (m) => m.isAdmin || m.isTeacher },
  { to: "/announcements", label: "Announcements", icon: Megaphone, show: () => true },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.filter((n) => n.show(me)).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          inactiveProps={{ className: "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground" }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-6 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg">
        T
      </div>
      <div>
        <p className="font-display text-lg font-semibold leading-tight text-sidebar-foreground" style={{ fontFamily: "var(--font-display)" }}>
          TutorTrack
        </p>
        <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Tuition ERP</p>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: unread } = useQuery({
    queryKey: ["unread-count", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", me!.userId)
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, queryClient]);

  return (
    <Link to="/notifications" className="relative inline-flex">
      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="h-5 w-5" />
      </Button>
      {!!unread && unread > 0 && (
        <Badge className="absolute -right-0.5 -top-0.5 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
          {unread > 99 ? "99+" : unread}
        </Badge>
      )}
    </Link>
  );
}

export function AppShell({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto py-2">
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border p-3">
          {me && (
            <div className="mb-2 px-3">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{me.profile?.full_name || me.email}</p>
              <p className="text-xs text-sidebar-foreground/60">
                {me.primaryRole ? roleLabel[me.primaryRole] : "No role assigned"}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen w-full flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-0">
              <SidebarBrand />
              <div className="py-2">
                <NavLinks onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="border-t border-sidebar-border p-3">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="page-title flex-1 truncate text-lg md:text-xl">{title}</h1>
          {actions}
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 md:p-6">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
