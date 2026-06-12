import { AppLayout } from "@/components/AppLayout";
import { Send, Users, FileText, Mailbox, Activity, AlertCircle } from "lucide-react";
import { cookies } from "next/headers";
import WorkflowManager from "@/components/WorkflowManager";
import { redirect } from "next/navigation";
import createServerSupabase from "@/integrations/supabase/server";
import { Suspense } from "react";
import DashboardStats from "@/components/DashboardStats";
import DashboardStatsSkeleton from "@/components/DashboardStatsSkeleton";
import WorkspaceStatus from "@/components/WorkspaceStatus";

type Stats = { campaigns: number; leads: number; templates: number; senders: number; events: number };


export default async function Dashboard() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const supabase = createServerSupabase();
  console.time("dashboard-data");
  const userResults =await supabase.auth.admin.getUserById(userId);
  console.timeEnd("dashboard-data");
  const userData = userResults.data;
  const userMetadata = userData?.user?.user_metadata;
  let repoPermissionError = userMetadata?.github_repo_permission_error === true;
  const installationId = userMetadata?.github_installation_id ?? null;
  const repositoryId = userMetadata?.github_repository_id ?? null;

  // Auto-verify repository selection on page load/refresh if:
  // 1. There is a repository permission error flagged, OR
  // 2. The app is installed (installationId exists) but no repository has been matched/saved yet (repositoryId is null)
  if (installationId && (repoPermissionError || !repositoryId)) {
    const { verifyAndSaveInstallation } = await import("@/app/actions/githubActions");
    const verifyRes = await verifyAndSaveInstallation(userId, installationId);
    if (verifyRes.ok && verifyRes.matched) {
      repoPermissionError = false;
    } else {
      repoPermissionError = true;
    }
  }

  // const stats = await fetchDashboardStats(userId);

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
              href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "dumpmail-app"}/installations/new`}
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

        <Suspense fallback={<DashboardStatsSkeleton />}>
          <DashboardStats userId={userId} />
        </Suspense>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <WorkflowManager
              userId={userId}
              installationId={installationId}
              repoPermissionError={repoPermissionError}
            />
          </div>
          <div className="space-y-6">
            <Suspense fallback={null}>
              <WorkspaceStatus userId={userId} />
            </Suspense>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
