import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Templates from "@/screens/Templates";
import { fetchTemplates } from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";

type Template = Tables<"email_templates">;

export default async function Page() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const templates = await fetchTemplates<Template>(userId);

  return <Templates initialTemplates={templates ?? []} />;
}