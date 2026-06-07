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

  const [campaigns, templates, leads, senders] = await Promise.all([
    fetchCampaigns<Campaign>(userId),
    fetchTemplates<Template>(userId),
    fetchLeads<Lead>(userId),
    fetchSenders<Sender>(userId),
  ]);

  return (
    <Campaigns
      initialCampaigns={campaigns ?? []}
      initialTemplates={templates ?? []}
      initialLeads={leads ?? []}
      initialSenders={senders ?? []}
    />
  );
}