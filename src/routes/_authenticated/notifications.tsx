import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", me?.userId],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", me!.userId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", me!.userId).eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["unread-count"] });
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["unread-count"] });
  }

  return (
    <AppShell
      title="Notifications"
      actions={
        <Button size="sm" variant="outline" onClick={markAllRead}>
          <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-2">
        {(notifications ?? []).length === 0 && (
          <div className="py-16 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </div>
        )}
        {(notifications ?? []).map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className={cn(
              "block w-full rounded-xl border px-4 py-3 text-left transition-colors",
              n.is_read ? "border-border bg-card opacity-70" : "border-primary/30 bg-card",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={cn("text-sm", !n.is_read && "font-semibold")}>{n.title}</p>
              {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </div>
            {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
            </p>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
