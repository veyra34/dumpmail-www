"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Send, Users, FileText, Mailbox, Activity, Github, Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { fetchDashboardStats } from "@/app/actions/admin-actions";

type Stats = { campaigns: number; leads: number; templates: number; senders: number; events: number };

const cards = [
  { key: "campaigns" as const, label: "Campaigns", icon: Send, path: "/campaigns" },
  { key: "leads" as const, label: "Leads", icon: Users, path: "/leads" },
  { key: "templates" as const, label: "Templates", icon: FileText, path: "/templates" },
  { key: "senders" as const, label: "Senders", icon: Mailbox, path: "/senders" },
  { key: "events" as const, label: "Events", icon: Activity, path: "/events" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ campaigns: 0, leads: 0, templates: 0, senders: 0, events: 0 });
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyValue = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const data = await fetchDashboardStats(user.id);
      setStats(data);
    })();
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Overview of your outreach.</p>
        </div>

        <Alert className="border-primary/20 bg-secondary/30">
          <Github className="h-4 w-4" />
          <AlertTitle>Connect your GitHub fork</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-4 text-[13px] text-muted-foreground">
              <p>Fork and connect <span className="font-medium text-foreground">git@github.com:Anas-github-acc/Dumpmail.git</span> to your GitHub account, then add these repository secrets in Actions.</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">USER_ID</div>
                  <div className="mt-1 break-all font-mono text-[12px] text-foreground">{user?.id || "Waiting for authentication"}</div>
                  <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-[12px]" onClick={() => user?.id && copyValue(user.id, "user-id")} disabled={!user?.id}>
                    {copiedField === "user-id" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedField === "user-id" ? "Copied" : "Copy user ID"}
                  </Button>
                </div>

                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Secrets to add</div>
                  <div className="mt-1 space-y-1 font-mono text-[12px] text-foreground">
                    <div>SUPABASE_URL</div>
                    <div>SUPABASE_SERVICE_KEY</div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-[12px]" asChild>
                    <a href="https://github.com/settings/secrets/actions" target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open Actions secrets
                    </a>
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Add this exact value</div>
                <div className="mt-2 space-y-2 font-mono text-[12px] text-foreground break-all">
                  <div>SUPABASE_URL=https://bfvcudsjdbnpyvrrpzdq.supabase.co</div>
                  <div>SUPABASE_SERVICE_KEY=sb_publishable_24ocC5_oI9gqE3xdqyp4WA_z5FbLdoJ</div>
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((c) => (
            <Link
              key={c.key}
              href={c.path}
              className="border border-border rounded-md p-4 bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold tracking-tight">{stats[c.key]}</div>
              <div className="text-[12px] text-muted-foreground mt-0.5">{c.label}</div>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-[13px] text-muted-foreground">
            Empty workspace — start by adding a sender account, then create a template and a campaign.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
