import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Templates from "@/screens/Templates";
import { fetchTemplates, fetchGlobalTemplates } from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";

export const metadata: Metadata = {
  title: "Templates — Dumpmail",
  description: "Manage and browse your email templates.",
};

type Template = Tables<"email_templates">;
type GlobalTemplate = Tables<"global_email_templates">;

export default async function Page() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const [templatesRes, globalTemplatesRes] = await Promise.all([
    fetchTemplates<Template>(userId, 1, 10),
    fetchGlobalTemplates<GlobalTemplate>(1, 8).catch(() => ({ data: [], count: 0 })),
  ]);

  return (
    <Templates
      initialTemplates={templatesRes?.data ?? []}
      initialTemplatesCount={templatesRes?.count ?? 0}
      globalTemplates={globalTemplatesRes.data}
      userId={userId}
    />
  );
}