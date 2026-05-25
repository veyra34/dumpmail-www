"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { persistUserFromAccessToken } from "@/app/actions/authActions";

export default function AuthCallback() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const finalizeOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error("No active session");
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token ?? null;
        if (!accessToken) {
          throw new Error("No access token found after authentication");
        }

        await persistUserFromAccessToken(accessToken);

        if (mounted) {
          router.replace("/dashboard");
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : "Authentication failed");
        }
      }
    };

    finalizeOAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">{errorMessage}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
