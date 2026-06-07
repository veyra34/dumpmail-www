"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchProfile } from "@/app/actions/admin-actions";
import { loginWithGitHub } from "@/app/actions/authActions";

type Profile = Tables<"users">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const fallbackAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGitHub: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
};

const AuthContext = createContext<AuthContextType>(fallbackAuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const revalidateSession = useCallback(async () => {
    // Race the network call against a 5-second timeout so a slow or hung
    // getUser() request can never permanently freeze the loading spinner.
    const timeout = new Promise<null>((resolve) =>
      window.setTimeout(() => resolve(null), 5_000)
    );

    const result = await Promise.race([
      supabase.auth.getUser().then(({ data, error }) => (error || !data.user ? null : data.user)),
      timeout,
    ]);

    if (!result) {
      clearAuthState();
      // Only sign out if we actually had a session token that was rejected (not a timeout).
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) void supabase.auth.signOut();
      });
      return null;
    }

    setUser(result);
    return result;
  }, [clearAuthState]);

  const fetchProfileData = useCallback(async (userId: string) => {
    try {
      const data = await fetchProfile<Profile>(userId);
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // User was deleted or session was revoked server-side — kick them out.
        if (event === "SIGNED_OUT") {
          clearAuthState();
          setLoading(false);
          document.cookie = "dumpmail_user_id=; path=/; max-age=0; SameSite=Lax; Secure";
          window.location.replace("/");
          return;
        }

        // Update local state immediately from the session payload (no network call).
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          document.cookie = `dumpmail_user_id=${session.user.id}; path=/; max-age=31536000; SameSite=Lax; Secure`;
          // Revalidate in the background — don't block loading on this.
          const userId = session.user.id;
          void revalidateSession().then((verifiedUser) => {
            if (verifiedUser) void fetchProfileData(userId);
          });
        } else {
          setProfile(null);
          document.cookie = "dumpmail_user_id=; path=/; max-age=0; SameSite=Lax; Secure";
        }

        setLoading(false);
      }
    );

    // getSession() reads from local storage — always fast. Use it to resolve
    // the initial loading state immediately without waiting for any network call.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        document.cookie = `dumpmail_user_id=${session.user.id}; path=/; max-age=31536000; SameSite=Lax; Secure`;
        // Revalidate + fetch profile in the background.
        const userId = session.user.id;
        void revalidateSession().then((verifiedUser) => {
          if (verifiedUser) void fetchProfileData(userId);
        });
      } else {
        document.cookie = "dumpmail_user_id=; path=/; max-age=0; SameSite=Lax; Secure";
      }
      setLoading(false);
    }).catch(() => {
      // If getSession() rejects (bad env vars, network error, etc.),
      // we must still clear the loading state or the spinner hangs forever.
      clearAuthState();
      document.cookie = "dumpmail_user_id=; path=/; max-age=0; SameSite=Lax; Secure";
      setLoading(false);
    });

    const interval = window.setInterval(() => {
      void revalidateSession();
    }, 60_000);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(interval);
    };
  }, [clearAuthState, fetchProfileData, revalidateSession]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGitHub = async () => {
    const url = await loginWithGitHub();
    if (url) {
      window.location.assign(url);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    document.cookie = "dumpmail_user_id=; path=/; max-age=0; SameSite=Lax; Secure";
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfileData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signUp, signIn, signInWithGitHub, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
