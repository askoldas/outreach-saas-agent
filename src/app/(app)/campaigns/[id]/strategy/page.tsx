import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { StrategyWorkspace } from "@/features/campaigns/StrategyWorkspace";
import { getCurrentCampaignStrategy } from "@/server/campaign-strategy/repository";
export default async function StrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await loadCampaignPage(id);
  const strategy = await getCurrentCampaignStrategyFromPage(campaign.id);
  if (!strategy) {
    throw new Error("Campaign Strategy is missing for this campaign.");
  }
  return (
    <CampaignShell campaign={campaign} active="discover">
      <StrategyWorkspace campaign={campaign} initialStrategy={strategy} />
    </CampaignShell>
  );
}

async function getCurrentCampaignStrategyFromPage(campaignId: string) {
  const { getWorkspaceContext } = await import("@/server/workspaces/repository");
  const { currentWorkspace } = await getWorkspaceContext();
  return currentWorkspace
    ? getCurrentCampaignStrategy(currentWorkspace.id, campaignId)
    : null;
}
