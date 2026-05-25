"use client";

import { useEffect, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { fetchUserEvents } from "@/app/actions/admin-actions";
import { Activity, Loader2 } from "lucide-react";

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

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      if (cancelled) {
        return;
      }

      try {
        const data = await fetchUserEvents<EmailEvent>(user.id);
        setEvents(data ?? []);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load events");
      }

      setLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) void loadEvents();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [user]);

  const sentCount = events.filter((event) => event.event_type.toLowerCase() === "sent").length;
  const replyCount = events.filter((event) => event.event_type.toLowerCase() === "replied").length;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight">Email events</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Sends, opens, replies, bounces — streamed from your GitHub Actions runner.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Events</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{events.length}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sent</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{sentCount}</div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Replies</div>
            <div className="mt-2 text-2xl font-bold tracking-tight">{replyCount}</div>
          </div>
        </div>

        <section className="rounded-md border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[14px] font-semibold">Latest events</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading events...
            </div>
          ) : error ? (
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
