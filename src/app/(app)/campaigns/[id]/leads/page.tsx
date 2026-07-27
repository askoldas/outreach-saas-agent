import type { ReviewState } from "@/types/domain";
import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { CampaignLeadReview } from "@/features/leads/CampaignLeadReview";
import { listCampaignLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { CampaignControls } from "@/features/campaigns/CampaignControls";
import { CampaignClarification } from "@/features/campaigns/CampaignClarification";
import { getOpenCampaignQuestion } from "@/server/campaign-questions/repository";
import { CampaignLearnings } from "@/features/campaigns/CampaignLearnings";
import { listCampaignMemories } from "@/server/campaign-memories/repository";
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
  const [leads, openQuestion, memories] = currentWorkspace
    ? await Promise.all([
        listCampaignLeads(currentWorkspace.id, id),
        getOpenCampaignQuestion({ campaignId: id, workspaceId: currentWorkspace.id }),
        listCampaignMemories({ campaignId: id, workspaceId: currentWorkspace.id }),
      ])
    : [[], null, []];
  return (
    <CampaignShell campaign={campaign} active="companies">
      <CampaignControls
        campaignId={campaign.id}
        desiredLeadCount={campaign.desiredLeadCount}
        initialLeadCount={leads.length}
        status={campaign.status}
      />
      {openQuestion ? (
        <CampaignClarification campaignId={campaign.id} question={openQuestion} />
      ) : null}
      <CampaignLearnings campaignId={campaign.id} memories={memories} />
      <CampaignLeadReview initialLeads={leads} campaignId={id} initialView={query.view} />
    </CampaignShell>
  );
}
