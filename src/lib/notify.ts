import { supabase } from "@/integrations/supabase/client";

/** Insert an in-app notification for a user (no-op if userId is null). */
export async function sendNotification(opts: {
  userId: string | null | undefined;
  title: string;
  body?: string;
  type?: string;
  link?: string;
}) {
  if (!opts.userId) return;
  await supabase.from("notifications").insert({
    user_id: opts.userId,
    title: opts.title,
    body: opts.body ?? null,
    type: opts.type ?? "general",
    link: opts.link ?? null,
  });
}

/** Build a pre-filled WhatsApp link. Phone should include country code. */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Record an audit log entry (best-effort). */
export async function auditLog(action: string, entity?: string, entityId?: string, details?: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({
    user_id: data.user.id,
    action,
    entity: entity ?? null,
    entity_id: entityId ?? null,
    details: details ? JSON.parse(JSON.stringify(details)) : null,
  });
}
