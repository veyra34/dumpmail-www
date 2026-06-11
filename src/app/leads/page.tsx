import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Leads from "@/screens/Leads";
import { fetchLeads, fetchCampaigns } from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type Campaign = Tables<"campaigns">;

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  // 1. Fetch campaigns first to find the default campaign (oldest created)
  const campaignsRes = await fetchCampaigns<Campaign>(userId);
  const campaigns = campaignsRes?.data ?? [];

  // Determine campaign ID
  let selectedCampaignId = searchParams.campaign || "";
  if (campaigns.length > 0) {
    const exists = campaigns.some((c) => c.id === selectedCampaignId);
    if (!exists) {
      const oldest = [...campaigns].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      })[0];
      selectedCampaignId = oldest?.id || "";
    }
  }

  // 2. Fetch leads with the selected campaign status
  const leadsRes = await fetchLeads<Lead>(selectedCampaignId || null, userId, 1, 10);

  return (
    <Leads
      initialLeads={leadsRes?.data ?? []}
      initialLeadsCount={leadsRes?.count ?? 0}
      initialCampaigns={campaigns}
      campaignIdFromUrl={selectedCampaignId}
    />
  );
}