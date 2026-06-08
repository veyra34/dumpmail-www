"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { persistUserFromAccessToken } from "@/app/actions/authActions";
import { forkRepoStep, injectSecretsStep } from "@/app/actions/githubActions";
import { SetupView, type StepState } from "@/screens/SetupView";

export default function AuthCallback({
  sourceOwner,
  sourceRepo,
}: {
  sourceOwner: string;
  sourceRepo: string;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<StepState>({
    connecting: "active",
    forking: "idle",
    secrets: "idle",
  });
  const [forkLogin, setForkLogin] = useState<string | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);
  const [hardError, setHardError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const mark = (id: keyof StepState, status: StepState[keyof StepState]) => {
    if (!mountedRef.current) return;
    setSteps((prev) => ({ ...prev, [id]: status }));
  };

  useEffect(() => {
    mountedRef.current = true;

    const run = async () => {
      try {
        // Step 1 — connect
        mark("connecting", "active");
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session)
            throw new Error("No active session found. Please try signing in again.");
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const accessToken = session?.access_token ?? null;

        if (!accessToken) throw new Error("No access token found. Please try again.");
        mark("connecting", "done");
 
        // Silent — persist user, capture their ID
        const user = await persistUserFromAccessToken(accessToken);
        if (!user) throw new Error("something went wrong.. when accessing user. Please raise the issue on https://github.com/Anas-github-acc/dumpmail-www/issues")

        document.cookie = `dumpmail_user_id=${user.id}; path=/; max-age=31536000; SameSite=Lax; Secure`;

        setUserId(user.id);
        const providerToken = session?.provider_token ?? null;

        if (!providerToken) {
          setForkError("GitHub provider token unavailable. Please sign out and sign in again.");
          mark("forking", "error");
          mark("secrets", "error");
          return;
        }

        // Set short-lived secure cookie with GitHub OAuth provider token (useful for backend validation)
        document.cookie = `github_oauth_token=${providerToken}; path=/; max-age=600; SameSite=Lax; Secure`;

        // Step 2 — fork
        mark("forking", "active");

        const forkResult = await forkRepoStep(providerToken);

        if (!forkResult.ok) {
          setForkError(forkResult.error);
          mark("forking", "error");
          mark("secrets", "error");
          return;
        }

        setForkLogin(forkResult.login);
        mark("forking", "done");

        // Step 3 — inject secrets
        mark("secrets", "active");
        const secretsResult = await injectSecretsStep(providerToken, forkResult.login, user.id);

        if (!secretsResult.ok) {
          setForkError(secretsResult.error);
          mark("secrets", "error");
          return;
        }

        mark("secrets", "done");

        if (mountedRef.current) {
          setIsDone(true);
          await new Promise((r) => setTimeout(r, 1500));
          
          const hasInstallation = session?.user?.user_metadata?.github_installation_id;
          if (hasInstallation) {
            router.replace("/dashboard");
          } else {
            const repoFullName = `${forkResult.login}/${sourceRepo}`;
            router.replace(`/github/install?repo=${encodeURIComponent(repoFullName)}`);
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          const msg = err instanceof Error ? err.message : "Authentication failed";
          setHardError(msg);
          setSteps((prev) => {
            const next = { ...prev };
            (Object.keys(next) as (keyof StepState)[]).forEach((k) => {
              if (next[k] === "active") next[k] = "error";
            });
            return next;
          });
        }
      }
    };

    run();
    return () => {
      mountedRef.current = false;
    };
  }, [router]);

  return (
    <div className="acb-page">
      <SetupView
        steps={steps}
        forkLogin={forkLogin}
        forkError={forkError}
        hardError={hardError}
        isDone={isDone}
        sourceOwner={sourceOwner}
        sourceRepo={sourceRepo}
        userId={userId}
        onRetry={() => { window.location.href = "/"; }}
        onContinue={() => router.replace("/dashboard")}
      />
      <style>{`
        .acb-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: hsl(240 6% 4%);
          padding: 48px 24px;
          font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          font-size: 14px;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>
    </div>
  );
}
