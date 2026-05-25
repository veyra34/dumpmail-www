import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types";

export type AppSupabaseClient = SupabaseClient<Database>;
export type PublicUserRecord = Database["public"]["Tables"]["users"]["Row"];

export function getDisplayName(user: User) {
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

export async function ensurePublicUserForClient(supabase: AppSupabaseClient, userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id,name,email,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as PublicUserRecord;

  const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);
  if (authUserError) throw authUserError;

  const authUser = authUserData.user;
  if (!authUser?.email) {
    throw new Error("Authenticated user must have an email before creating workspace records");
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .upsert(
      {
        id: authUser.id,
        email: authUser.email,
        name: getDisplayName(authUser),
      },
      { onConflict: "id" },
    )
    .select("id,name,email,created_at")
    .single();

  if (userError) {
    if (typeof userError === "object" && userError !== null && "code" in userError && userError.code === "23505") {
      const { data: existingEmailUser, error: existingEmailError } = await supabase
        .from("users")
        .select("id,name,email,created_at")
        .eq("email", authUser.email)
        .single();

      if (existingEmailError) throw existingEmailError;
      if (!existingEmailUser) throw userError;

      const oldUser = existingEmailUser as PublicUserRecord;
      const temporaryEmail = `${oldUser.email}#merged-${oldUser.id}`;
      const { error: releaseEmailError } = await supabase
        .from("users")
        .update({ email: temporaryEmail })
        .eq("id", oldUser.id);

      if (releaseEmailError) throw releaseEmailError;

      const { data: mergedUser, error: mergedUserError } = await supabase
        .from("users")
        .upsert(
          {
            id: authUser.id,
            email: authUser.email,
            name: getDisplayName(authUser),
          },
          { onConflict: "id" },
        )
        .select("id,name,email,created_at")
        .single();

      if (mergedUserError) throw mergedUserError;

      const [campaigns, templates, senders] = await Promise.all([
        supabase.from("campaigns").update({ user_id: authUser.id }).eq("user_id", oldUser.id),
        supabase.from("email_templates").update({ user_id: authUser.id }).eq("user_id", oldUser.id),
        supabase.from("sender_accounts").update({ user_id: authUser.id }).eq("user_id", oldUser.id),
      ]);

      const referenceError = campaigns.error ?? templates.error ?? senders.error;
      if (referenceError) throw referenceError;

      const { error: deleteOldUserError } = await supabase.from("users").delete().eq("id", oldUser.id);
      if (deleteOldUserError) throw deleteOldUserError;

      return mergedUser as PublicUserRecord;
    }

    throw userError;
  }

  return user as PublicUserRecord;
}
