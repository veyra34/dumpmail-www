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

export async function loginWithGitHub() {
  const supabase = createServerSupabase();

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo,
    },
  });

  if (error) throw error;

  return data.url ?? null;
}

export async function persistUserFromAccessToken(accessToken: string) {
  const supabase = createServerSupabase();

  // Verify token with Supabase Auth and get canonical user
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError) throw userError;

  const user = userData?.user;
  if (!user) throw new Error("Unable to resolve user from access token");
  if (!user.email) throw new Error("Authenticated GitHub user did not provide an email address");

  const userRecord: PublicUserRecord = {
    id: user.id,
    email: user.email,
    name: getDisplayName(user),
  };

  // Upsert into public.users using the service-role server client.
  try {
    const { data, error } = await supabase.schema("public")
      .from("users")
      .upsert(userRecord, { onConflict: "id" })
      .select("id,name,email,created_at")
      .single();

    if (error) throw error;
    return data as PublicUserRecord;
  } catch (e: unknown) {
    // If email is unique and belongs to an old public user id, merge that row
    // into the Supabase auth id without rewriting a referenced primary key.
    if (typeof e === "object" && e !== null && "code" in e && e.code === "23505") {
      const { data: existing, error: fetchError } = await supabase.schema("public")
        .from("users")
        .select("id,name,email,created_at")
        .eq("email", user.email)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) throw e;

      const existingUser = existing as PublicUserRecord;
      if (existingUser.id === userRecord.id) {
        const { data: updated, error: updateError } = await supabase.schema("public")
          .from("users")
          .update({ name: userRecord.name })
          .select("id,name,email,created_at")
          .eq("id", userRecord.id)
          .single();

        if (updateError) throw updateError;
        return updated as PublicUserRecord;
      }

      const temporaryEmail = `${existingUser.email}#merged-${existingUser.id}`;
      const { error: releaseEmailError } = await supabase.schema("public")
        .from("users")
        .update({ email: temporaryEmail })
        .eq("id", existingUser.id);

      if (releaseEmailError) throw releaseEmailError;

      const { data: mergedUser, error: mergedUserError } = await supabase.schema("public")
        .from("users")
        .upsert(userRecord, { onConflict: "id" })
        .select("id,name,email,created_at")
        .single();

      if (mergedUserError) throw mergedUserError;

      const [campaigns, templates, senders] = await Promise.all([
        supabase.schema("public").from("campaigns").update({ user_id: userRecord.id }).eq("user_id", existingUser.id),
        supabase.schema("public").from("email_templates").update({ user_id: userRecord.id }).eq("user_id", existingUser.id),
        supabase.schema("public").from("sender_accounts").update({ user_id: userRecord.id }).eq("user_id", existingUser.id),
      ]);

      const referenceError = campaigns.error ?? templates.error ?? senders.error;
      if (referenceError) throw referenceError;

      const { error: deleteOldUserError } = await supabase.schema("public")
        .from("users")
        .delete()
        .eq("id", existingUser.id);

      if (deleteOldUserError) throw deleteOldUserError;
      return mergedUser as PublicUserRecord;
    }

    throw e;
  }
}
