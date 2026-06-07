"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { loginWithGitHub } from "@/app/actions/authActions";
import { Button } from "@/components/ui/button";
import { Github, Loader2 } from "lucide-react";
import { StackedLogo } from "@/components/StackedLogo";
import { useToast } from "@/hooks/use-toast";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function Auth() {
  const { loading } = useAuth();
  const { toast } = useToast();
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleGitHubSignIn = async () => {
    setIsGitHubLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const url = await loginWithGitHub(origin);

      if (url) window.location.assign(url);
    } catch (error: unknown) {
      toast({ title: "GitHub sign-in failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsGitHubLoading(false);
    }
  };



  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] border border-border rounded-md p-8 space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-start gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <StackedLogo size={16} />
            <span className="text-[14px] font-bold text-foreground tracking-[0.08em] uppercase">Dumpmail</span>
          </Link>
          <p className="text-[13px] text-muted-foreground">Sign in to manage campaigns, leads, and sender health</p>
        </div>

        {/* GitHub */}
        <Button
          variant="outline"
          className="w-full h-9 gap-2 text-[13px]"
          onClick={handleGitHubSignIn}
          disabled={isGitHubLoading}
        >
          {isGitHubLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Github className="h-3.5 w-3.5" />
          )}
          Continue with GitHub
        </Button>



        <p className="text-left text-[11px] text-muted-foreground pt-2">
          © {new Date().getFullYear()} Dumpmail
        </p>
      </div>
    </div>
  );
}
