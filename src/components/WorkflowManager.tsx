"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWorkflowStatus,
  toggleWorkflow,
  listWorkflowRuns,
  getWorkflowRunDetails,
  getWorkflowUsageStats,
} from "@/app/actions/githubActions";
import {
  Play,
  Square,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Calendar,
  ChevronRight,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Info,
  GitCommit,
  GitBranch,
  HelpCircle,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function WorkflowManager() {
  const { session } = useAuth();
  const token = session?.provider_token ?? null;

  // Workflow State
  const [workflowState, setWorkflowState] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Runs List Pagination State
  const [runs, setRuns] = useState<any[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const perPage = 5;

  // Run Details State
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runDetails, setRunDetails] = useState<{ run: any; jobs: any[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Usage Stats State
  const [usageStats, setUsageStats] = useState<any | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [showUsage, setShowUsage] = useState(false);

  // Initial Fetch Function
  const fetchStatus = useCallback(async () => {
    if (!token) return;
    setLoadingStatus(true);
    const res = await getWorkflowStatus(token);
    if (res.ok) {
      setWorkflowState(res.state);
    } else {
      console.error(res.error);
    }
    setLoadingStatus(false);
  }, [token]);

  const fetchRuns = useCallback(async (page: number) => {
    if (!token) return;
    setLoadingRuns(true);
    const res = await listWorkflowRuns(token, page, perPage);
    if (res.ok) {
      setRuns(res.runs);
      setTotalRuns(res.totalCount);
    } else {
      toast.error(`Failed to load workflow runs: ${res.error}`);
    }
    setLoadingRuns(false);
  }, [token]);

  useEffect(() => {
    if (token) {
      void fetchStatus();
      void fetchRuns(currentPage);
    }
  }, [token, currentPage, fetchStatus, fetchRuns]);

  // Actions
  const handleToggle = async () => {
    if (!token || !workflowState) return;
    setIsToggling(true);
    const enable = workflowState !== "active";
    const res = await toggleWorkflow(token, enable);
    if (res.ok) {
      setWorkflowState(enable ? "active" : "disabled_manually");
      toast.success(`Workflow has been ${enable ? "enabled" : "disabled"} successfully.`);
      // Refresh status and runs list
      void fetchStatus();
      void fetchRuns(currentPage);
    } else {
      toast.error(`Failed to update workflow: ${res.error}`);
    }
    setIsToggling(false);
  };

  const handleFetchDetails = async (runId: number) => {
    if (!token) return;
    setSelectedRunId(runId);
    setLoadingDetails(true);
    setIsDetailsOpen(true);
    const res = await getWorkflowRunDetails(token, runId);
    if (res.ok) {
      setRunDetails({ run: res.run, jobs: res.jobs });
    } else {
      toast.error(`Failed to load run details: ${res.error}`);
      setIsDetailsOpen(false);
    }
    setLoadingDetails(false);
  };

  const handleFetchUsage = async () => {
    if (!token) return;
    setLoadingUsage(true);
    const res = await getWorkflowUsageStats(token);
    if (res.ok) {
      setUsageStats(res.usage);
      setShowUsage(true);
    } else {
      toast.error(`Failed to load usage stats: ${res.error}`);
    }
    setLoadingUsage(false);
  };

  const handleRefreshAll = () => {
    void fetchStatus();
    void fetchRuns(currentPage);
    if (showUsage) void handleFetchUsage();
    toast.success("Workflow information updated.");
  };

  if (!token) {
    return (
      <Card className="border border-border/60 bg-muted/20">
        <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-amber-500" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">GitHub Integration Needed</h3>
            <p className="text-[12px] text-muted-foreground max-w-sm">
              Please sign out and sign in using your GitHub account to access workflow automation metrics and controls.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return "0s";
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
  };

  const getStatusIcon = (status: string, conclusion: string) => {
    if (status === "in_progress") {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    }
    if (status === "queued") {
      return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />;
    }
    if (conclusion === "success") {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (conclusion === "failure" || conclusion === "timed_out") {
      return <XCircle className="h-4 w-4 text-rose-500" />;
    }
    return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusColorClass = (status: string, conclusion: string) => {
    if (status === "in_progress") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (status === "queued") return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    if (conclusion === "success") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    if (conclusion === "failure") return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    return "bg-secondary text-secondary-foreground";
  };

  const totalPages = Math.ceil(totalRuns / perPage);

  return (
    <div className="space-y-6">
      {/* Workflow Controls Card */}
      <Card className="overflow-hidden border border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-base font-semibold">Scheduler Automation</CardTitle>
                {workflowState && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 capitalize ${
                      workflowState === "active"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {workflowState === "active" ? "Enabled" : "Disabled"}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-[12px] font-mono text-muted-foreground">
                schedule-send-mails.yml
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                className="h-8 px-2.5 text-muted-foreground hover:text-foreground border-border/60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchUsage}
                disabled={loadingUsage}
                className="h-8 gap-1.5 text-[12px] border-border/60 hover:bg-secondary/40"
              >
                {loadingUsage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BarChart3 className="h-3.5 w-3.5" />
                )}
                Workflow Usage
              </Button>

              <Button
                size="sm"
                onClick={handleToggle}
                disabled={isToggling || loadingStatus || !workflowState}
                style={{
                  backgroundColor: "#238636",
                }}
                className="h-8 gap-1.5 text-[12px] text-white hover:bg-[#29903b] active:bg-[#207c32] font-medium transition-colors duration-200 border-0 shadow-sm"
              >
                {isToggling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : workflowState === "active" ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Disable Workflow
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Enable Workflow
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Billable Usage Drawer / Card Section */}
        {showUsage && usageStats && (
          <div className="border-b border-border/50 bg-emerald-500/[0.02] p-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start justify-between">
              <div className="space-y-3 w-full">
                <h4 className="text-[12px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-emerald-600" />
                  Billable Execution Usage (GitHub Actions)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-md border border-border/60 bg-background/50 p-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider block">Ubuntu</span>
                    <span className="text-lg font-bold tracking-tight text-foreground mt-0.5 block">
                      {formatDuration(usageStats.billable?.UBUNTU?.total_ms)}
                    </span>
                  </div>
                  {usageStats.billable?.MACOS && (
                    <div className="rounded-md border border-border/60 bg-background/50 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider block">macOS</span>
                      <span className="text-lg font-bold tracking-tight text-foreground mt-0.5 block">
                        {formatDuration(usageStats.billable?.MACOS?.total_ms)}
                      </span>
                    </div>
                  )}
                  {usageStats.billable?.WINDOWS && (
                    <div className="rounded-md border border-border/60 bg-background/50 p-3">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider block">Windows</span>
                      <span className="text-lg font-bold tracking-tight text-foreground mt-0.5 block">
                        {formatDuration(usageStats.billable?.WINDOWS?.total_ms)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setShowUsage(false)}
              >
                &times;
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {/* Running and Completed Runs Section */}
          <div className="divide-y divide-border/40">
            {loadingRuns ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mr-2" />
                <span className="text-sm">Fetching runs history...</span>
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Activity className="h-8 w-8 text-muted-foreground/45 mb-2" />
                <p className="text-[13px] font-medium text-foreground">No workflow runs found</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                  Runs will show up here once the scheduled pipeline has run or a run is manually triggered.
                </p>
              </div>
            ) : (
              runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => handleFetchDetails(run.id)}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">
                      {getStatusIcon(run.status, run.conclusion)}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground group-hover:underline">
                          {run.display_title || `Run #${run.run_number}`}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0.2 border capitalize ${getStatusColorClass(
                            run.status,
                            run.conclusion
                          )}`}
                        >
                          {run.status === "completed" ? run.conclusion : run.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          {run.head_branch}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {run.run_started_at ? new Date(run.run_started_at).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-4">
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5 duration-200" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="border-t border-border/50 px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Showing runs {Math.min(totalRuns, (currentPage - 1) * perPage + 1)}–
                {Math.min(totalRuns, currentPage * perPage)} of {totalRuns}
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1 || loadingRuns}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-[11px] border-border/60"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Previous
                </Button>

                <span className="text-[11px] font-medium px-2">
                  Page {currentPage} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages || loadingRuns}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 text-[11px] border-border/60"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Details Modal / Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-xl md:max-w-2xl bg-card border border-border shadow-lg">
          <DialogHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-2.5">
              {runDetails?.run && getStatusIcon(runDetails.run.status, runDetails.run.conclusion)}
              <div>
                <DialogTitle className="text-base font-semibold">
                  {runDetails?.run ? runDetails.run.display_title || `Run #${runDetails.run.run_number}` : "Workflow Run Details"}
                </DialogTitle>
                <DialogDescription className="text-[11px] flex items-center gap-1.5 mt-1">
                  <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                  Commit:{" "}
                  <span className="font-mono text-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">
                    {runDetails?.run?.head_sha?.slice(0, 7) || ""}
                  </span>{" "}
                  on branch <span className="font-semibold">{runDetails?.run?.head_branch}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
              <span className="text-sm">Retrieving jobs & steps...</span>
            </div>
          ) : (
            <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-1">
              {/* Job Execution list */}
              {runDetails?.jobs && runDetails.jobs.length > 0 ? (
                runDetails.jobs.map((job) => (
                  <div key={job.id} className="rounded-md border border-border/80 overflow-hidden bg-background">
                    {/* Job Header */}
                    <div className="bg-muted/10 border-b border-border/60 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status, job.conclusion)}
                        <span className="text-sm font-semibold">{job.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Duration: {formatDuration(new Date(job.completed_at || Date.now()).getTime() - new Date(job.started_at).getTime())}
                        </span>
                      </div>
                    </div>

                    {/* Step Details */}
                    <div className="divide-y divide-border/40">
                      {job.steps && job.steps.length > 0 ? (
                        job.steps.map((step: any) => (
                          <div key={step.number} className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/10">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {getStatusIcon(step.status, step.conclusion)}
                              <span className="text-[12px] font-medium text-foreground truncate">{step.name}</span>
                            </div>

                            <span className="text-[11px] font-mono text-muted-foreground">
                              {step.started_at && step.completed_at
                                ? formatDuration(new Date(step.completed_at).getTime() - new Date(step.started_at).getTime())
                                : "—"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                          No steps executed for this job.
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
                  No jobs found for this run.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
