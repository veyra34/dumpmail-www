import { fetchDashboardStats } from "@/app/actions/admin-actions";

export default async function WorkspaceStatus({ userId }: { userId: string }) {
    const stats = await fetchDashboardStats(userId);
    return(
        <>
        {stats.campaigns === 0 && stats.leads === 0 && stats.templates === 0 && stats.senders === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center bg-card h-full flex flex-col items-center justify-center min-h-[200px]">
                <p className="text-[13px] text-muted-foreground">
                  Empty workspace — start by adding a sender account, then create a template and a campaign.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border p-6 bg-card">
                <h3 className="text-sm font-semibold mb-2">Outreach Tips</h3>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Make sure your email sender is fully connected. Build structured template sequences and add high-quality leads to launch campaigns.
                </p>
              </div>
            )}
        </>
    );
}