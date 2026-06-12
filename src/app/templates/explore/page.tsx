import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { fetchGlobalTemplates } from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";
import ExploreTemplatesClient from "@/screens/ExploreTemplates";
import { AppLayout } from "@/components/AppLayout";

export const metadata: Metadata = {
  title: "Explore Templates — Dumpmail",
  description: "Browse and add community email templates to your personal library.",
};

type GlobalTemplate = Tables<"global_email_templates">;

export default async function ExploreTemplatesPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) redirect("/");

  let templates: GlobalTemplate[] = [];
  try {
    const res = await fetchGlobalTemplates<GlobalTemplate>(1, 100);
    templates = res.data;
  } catch {
    // If the table doesn't exist yet, show empty state gracefully
    templates = [];
  }

  return (
    <AppLayout>
      <ExploreTemplatesClient templates={templates} userId={userId} />
    </AppLayout>
  );
}
