import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Campaigns from "@/screens/Campaigns";
import {
  fetchCampaigns,
  fetchTemplates,
  fetchLeads,
  fetchSenders,
} from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;
type Template = Tables<"email_templates">;
type Lead = Tables<"leads">;
type Sender = Tables<"sender_accounts">;

export default async function Page() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const [campaignsRes, templatesRes, leadsRes, sendersRes] = await Promise.all([
    fetchCampaigns<Campaign>(userId, 1, 10),
    fetchTemplates<Template>(userId),
    fetchLeads<Lead>(null, userId),
    fetchSenders<Sender>(userId),
  ]);

  return (
    <Campaigns
      initialCampaigns={campaignsRes?.data ?? []}
      initialCampaignsCount={campaignsRes?.count ?? 0}
      initialTemplates={templatesRes?.data ?? []}
      initialLeads={leadsRes?.data ?? []}
      initialSenders={sendersRes?.data ?? []}
    />
  );
}