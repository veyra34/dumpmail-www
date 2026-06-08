"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRight, ShieldCheck, CheckCircle, Info } from "lucide-react";

function InstallInstructionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const repoName = searchParams.get("repo") || "your-forked-repo";
  const githubAppName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || "dumpmail-app";
  
  const installUrl = `https://github.com/apps/${githubAppName}/installations/new?state=${user?.id}`;

  const [timeLeft, setTimeLeft] = useState(10);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // After 8 seconds, show spinner
    const spinnerTimeout = setTimeout(() => {
      setShowSpinner(true);
    }, 8000);

    // At 10 seconds, redirect
    const redirectTimeout = setTimeout(() => {
      window.location.assign(installUrl);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(spinnerTimeout);
      clearTimeout(redirectTimeout);
    };
  }, [user, installUrl]);

  return (
    <Card className="max-w-md w-full border border-border/80 bg-card/40 backdrop-blur-md shadow-2xl">
      <CardHeader className="space-y-1 text-center border-b border-border/40 pb-6">
        <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">GitHub App Permission</CardTitle>
        <CardDescription className="text-[13px]">
          Authorize the GitHub App to monitor your workflow.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground/90">Follow these steps on the next screen:</h4>
          
          <div className="space-y-3">
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold text-muted-foreground border border-border mt-0.5">
                1
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Select <span className="font-semibold text-foreground">"Only select repositories"</span>.
              </p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold text-muted-foreground border border-border mt-0.5">
                2
              </div>
              <div className="space-y-1">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Search and choose the repository:
                </p>
                <div className="px-2.5 py-1 rounded bg-secondary/80 border border-border font-mono text-[11px] text-foreground inline-block">
                  {repoName}
                </div>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold text-muted-foreground border border-border mt-0.5">
                3
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Click on <span className="font-semibold text-emerald-500">"Install & Authorize"</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 flex gap-2.5 items-start">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-500/90 leading-relaxed font-medium">
            Important: Selecting "All repositories" is not recommended. Only select the forked repository displayed above.
          </p>
        </div>

        <div className="pt-2 border-t border-border/40 flex flex-col items-center space-y-3">
          <Button
            asChild
            className="w-full h-10 text-[13px] font-semibold transition-all duration-300 shadow-md hover:shadow-emerald-950/20"
            style={{ backgroundColor: "#238636", color: "#ffffff" }}
          >
            <a href={installUrl}>
              {showSpinner ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  Install App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </a>
          </Button>
          
          <p className="text-[11px] text-muted-foreground">
            Redirecting automatically in <span className="font-mono font-bold text-foreground">{timeLeft}s</span>...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GitHubInstallPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-foreground p-6">
      <Suspense fallback={
        <div className="flex flex-col items-center space-y-4 text-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Loading installation guide...</p>
        </div>
      }>
        <InstallInstructionsContent />
      </Suspense>
    </div>
  );
}
