import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";
import { fetchUserEvents } from "@/app/actions/admin-actions";
import { Activity, Send, MessageSquare } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type EmailEvent = Tables<"email_events">;

function statusVariant(eventType: string) {
  switch (eventType.toLowerCase()) {
    case "sent":
    case "opened":
    case "replied":
      return "default";
    case "bounce":
    case "bounced":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function Events() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  let events: EmailEvent[] = [];
  let error: string | null = null;
  try {
    const data = await fetchUserEvents<EmailEvent>(userId);
    events = data ?? [];
  } catch (requestError) {
    error = requestError instanceof Error ? requestError.message : "Failed to load events";
  }

  const sentCount = events.filter((event) => event.event_type.toLowerCase() === "sent").length;
  const replyCount = events.filter((event) => event.event_type.toLowerCase() === "replied").length;

  return (
    <AppLayout>
      <div className="max-w-[100rem] mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Email events</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Sends, opens, replies, bounces — streamed from your GitHub Actions runner.</p>
        </div>

        <div className="flex items-center gap-3 text-[13px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{events.length}</span> event{events.length !== 1 ? "s" : ""}
          </span>
          {sentCount > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{sentCount}</span> sent
              </span>
            </>
          )}
          {replyCount > 0 && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{replyCount}</span> replie{replyCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>

        <section className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold">Latest events</h2>
          </div>

          {error ? (
            <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
          ) : events.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message ID</TableHead>
                  <TableHead>Provider response</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant={statusVariant(event.event_type)} className="capitalize">
                        {event.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.subject || "-"}</TableCell>
                    <TableCell className="font-mono text-[12px]">{event.message_id ? event.message_id.slice(0, 18) : "-"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{event.provider_response || "-"}</TableCell>
                    <TableCell>{formatDate(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-4 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No events yet. Once sending starts, opens and replies will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
