"use server";

import createServerSupabase from "@/integrations/supabase/server";
import type { User } from "@supabase/supabase-js";

type PublicUserRecord = {
  id: string;
  name: string | null;
  email: string;
  created_at?: string;
};

function getDisplayName(user: User) {
  const metadata = user.user_metadata;

  return (
    metadata.full_name ??
    metadata.name ??
    metadata.user_name ??
    metadata.preferred_username ??
    user.email?.split("@")[0] ??
    null
  );
}

export async function loginWithGitHub(origin?: string) {
  const supabase = createServerSupabase();

  const baseUrl = origin ?? process.env.NEXT_PUBLIC_NEXT_URL;

  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_NEXT_URL");
  }

  const redirectTo = new URL("/auth/callback", baseUrl).href;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo,
      // repo scope is required to: fork repositories + read/write Actions secrets
      scopes: "repo",
    },
  });

  if (error) throw error;

  return data.url ?? null;
}

export async function persistUserFromAccessToken(accessToken: string) {
  const supabase = createServerSupabase();

  // Use the admin API (service-role) to get the user from the JWT.
  // auth.getUser(jwt) on a service-role client verifies the JWT and returns the user.
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError) {
    console.error("[persistUserFromAccessToken] getUser error:", userError);
    throw userError;
  }

  const user = userData?.user;
  if (!user) throw new Error("Unable to resolve user from access token");
  if (!user.email) throw new Error("Authenticated GitHub user did not provide an email address");

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  const isNewUser = !existingUser;

  const userRecord: PublicUserRecord = {
    id: user.id,
    email: user.email,
    name: getDisplayName(user),
  };

  console.log("[persistUserFromAccessToken] Upserting user:", userRecord.id, userRecord.email, userRecord.name);

  // Upsert into public.users using the service-role server client.
  // Service role bypasses RLS, so this should always succeed.
  try {
    const { data, error } = await supabase
      .from("users")
      .upsert(userRecord, { onConflict: "id" })
      .select("id,name,email,created_at")
      .single();

    if (error) {
      console.error("[persistUserFromAccessToken] upsert error:", error);
      throw error;
    }
    console.log("[persistUserFromAccessToken] Upserted successfully:", data);
    return {
      user: data as PublicUserRecord,
      isNewUser,
    };
  } catch (e: unknown) {
    // If email is unique and belongs to an old public user id, merge that row
    // into the Supabase auth id without rewriting a referenced primary key.
    if (typeof e === "object" && e !== null && "code" in e && e.code === "23505") {
      console.log("[persistUserFromAccessToken] Email conflict, attempting merge...");
      const { data: existing, error: fetchError } = await supabase
        .from("users")
        .select("id,name,email,created_at")
        .eq("email", user.email)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) throw e;

      const existingUser = existing as PublicUserRecord;
      if (existingUser.id === userRecord.id) {
        const { data: updated, error: updateError } = await supabase
          .from("users")
          .update({ name: userRecord.name })
          .select("id,name,email,created_at")
          .eq("id", userRecord.id)
          .single();

        if (updateError) throw updateError;
        return {
          user: updated as PublicUserRecord,
          isNewUser,
        };
      }

      const temporaryEmail = `${existingUser.email}#merged-${existingUser.id}`;
      const { error: releaseEmailError } = await supabase
        .from("users")
        .update({ email: temporaryEmail })
        .eq("id", existingUser.id);

      if (releaseEmailError) throw releaseEmailError;

      const { data: mergedUser, error: mergedUserError } = await supabase
        .from("users")
        .upsert(userRecord, { onConflict: "id" })
        .select("id,name,email,created_at")
        .single();

      if (mergedUserError) throw mergedUserError;

      const [campaigns, templates, senders] = await Promise.all([
        supabase.from("campaigns").update({ user_id: userRecord.id }).eq("user_id", existingUser.id),
        supabase.from("email_templates").update({ user_id: userRecord.id }).eq("user_id", existingUser.id),
        supabase.from("sender_accounts").update({ user_id: userRecord.id }).eq("user_id", existingUser.id),
      ]);

      const referenceError = campaigns.error ?? templates.error ?? senders.error;
      if (referenceError) throw referenceError;

      const { error: deleteOldUserError } = await supabase
        .from("users")
        .delete()
        .eq("id", existingUser.id);

      if (deleteOldUserError) throw deleteOldUserError;
      return {
        user: mergedUser as PublicUserRecord,
        isNewUser,
      };
    }

    throw e;
  }
}
