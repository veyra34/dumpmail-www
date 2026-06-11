import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Leads from "@/screens/Leads";
import { fetchLeads, fetchCampaigns } from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type Campaign = Tables<"campaigns">;

export default async function Page() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const [leadsRes, campaignsRes] = await Promise.all([
    fetchLeads<Lead>(userId, 1, 10),
    fetchCampaigns<Campaign>(userId),
  ]);

  return (
    <Leads
      initialLeads={leadsRes?.data ?? []}
      initialLeadsCount={leadsRes?.count ?? 0}
      initialCampaigns={campaignsRes?.data ?? []}
    />
  );
}