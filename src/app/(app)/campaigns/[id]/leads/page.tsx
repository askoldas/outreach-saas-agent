import type { ReviewState } from "@/types/domain";
import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { CampaignLeadReview } from "@/features/leads/CampaignLeadReview";
import { listCampaignLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: ReviewState }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const campaign = await loadCampaignPage(id);
  const { currentWorkspace } = await getWorkspaceContext();
  const leads = currentWorkspace ? await listCampaignLeads(currentWorkspace.id, id) : [];
  return (
    <CampaignShell campaign={campaign} active="leads">
      <CampaignLeadReview initialLeads={leads} campaignId={id} initialView={query.view} />
    </CampaignShell>
  );
}
