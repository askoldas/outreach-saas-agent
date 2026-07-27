import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { StrategyWorkspace } from "@/features/campaigns/StrategyWorkspace";
import { getCurrentCampaignStrategy } from "@/server/campaign-strategy/repository";
import { CampaignDocuments } from "@/features/campaigns/CampaignDocuments";
import { listCampaignDocuments } from "@/server/documents/repository";
export default async function StrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  const campaign = await loadCampaignPage(id);
  const strategy = await getCurrentCampaignStrategyFromPage(campaign.id);
  const documents = await getCampaignDocumentsFromPage(campaign.id);
  if (!strategy) {
    throw new Error("Campaign Strategy is missing for this campaign.");
  }
  return (
    <CampaignShell campaign={campaign} active="discovery">
      <StrategyWorkspace
        campaign={campaign}
        initialStrategy={strategy}
        startRevising={mode === "revise"}
      />
      <CampaignDocuments campaignId={campaign.id} documents={documents} />
    </CampaignShell>
  );
}

async function getCampaignDocumentsFromPage(campaignId: string) {
  const { getWorkspaceContext } = await import("@/server/workspaces/repository");
  const { currentWorkspace } = await getWorkspaceContext();
  return currentWorkspace
    ? listCampaignDocuments({
        campaignExternalId: campaignId,
        workspaceId: currentWorkspace.id,
      })
    : [];
}

async function getCurrentCampaignStrategyFromPage(campaignId: string) {
  const { getWorkspaceContext } = await import("@/server/workspaces/repository");
  const { currentWorkspace } = await getWorkspaceContext();
  return currentWorkspace
    ? getCurrentCampaignStrategy(currentWorkspace.id, campaignId)
    : null;
}
