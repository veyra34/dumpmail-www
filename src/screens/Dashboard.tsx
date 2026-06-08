import { AppLayout } from "@/components/AppLayout";
import { Send, Users, FileText, Mailbox, Activity, AlertCircle } from "lucide-react";
import Link from "next/link";
import { fetchDashboardStats } from "@/app/actions/admin-actions";
import { cookies } from "next/headers";
import WorkflowManager from "@/components/WorkflowManager";
import { redirect } from "next/navigation";
import createServerSupabase from "@/integrations/supabase/server";

type Stats = { campaigns: number; leads: number; templates: number; senders: number; events: number };

const cards = [
  { key: "campaigns" as const, label: "Campaigns", icon: Send, path: "/campaigns" },
  { key: "leads" as const, label: "Leads", icon: Users, path: "/leads" },
  { key: "templates" as const, label: "Templates", icon: FileText, path: "/templates" },
  { key: "senders" as const, label: "Senders", icon: Mailbox, path: "/senders" },
  { key: "events" as const, label: "Events", icon: Activity, path: "/events" },
];

export default async function Dashboard() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const supabase = createServerSupabase();
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userMetadata = userData?.user?.user_metadata;
  const repoPermissionError = userMetadata?.github_repo_permission_error === true;
  const installationId = userMetadata?.github_installation_id ?? null;

  const stats = await fetchDashboardStats(userId);

  // Dynamically resolve repository name for the permission alert message
  let forkedRepoName = "your forked repository";
  if (repoPermissionError) {
    const { getRepoInfo } = await import("@/app/actions/githubActions");
    const repoInfoRes = await getRepoInfo(userId);
    if (repoInfoRes.ok) {
      forkedRepoName = `${repoInfoRes.owner}/${repoInfoRes.repo}`;
    }
  }

  return (
    <AppLayout>
      <div className="max-w-[100rem] mx-auto p-6 md:p-8 space-y-6">
        {repoPermissionError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <h5 className="font-semibold text-destructive text-sm">Action Required</h5>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  GitHub App requires <span className="font-semibold text-foreground">"{forkedRepoName}"</span> permission.
                </p>
              </div>
            </div>
            <a 
              href={`https://github.com/settings/installations/${userMetadata?.github_installation_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-semibold text-destructive hover:underline flex-shrink-0"
            >
              Configure App Permissions &rarr;
            </a>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Overview of your outreach.</p>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <WorkflowManager 
              userId={userId} 
              installationId={installationId} 
              repoPermissionError={repoPermissionError} 
            />
          </div>
          <div className="space-y-6">
            {stats.campaigns === 0 && stats.leads === 0 && stats.templates === 0 && stats.senders === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center bg-card h-full flex flex-col items-center justify-center min-h-[200px]">
                <p className="text-[13px] text-muted-foreground">
                  Empty workspace — start by adding a sender account, then create a template and a campaign.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border p-6 bg-card">
                <h3 className="text-sm font-semibold mb-2">Outreach Tips</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Make sure your email sender is fully connected. Build structured template sequences and add high-quality leads to launch campaigns.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
