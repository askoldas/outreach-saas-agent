import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { StrategyWorkspace } from "@/features/campaigns/StrategyWorkspace";
import { getCurrentCampaignStrategy } from "@/server/campaign-strategy/repository";
import { CampaignDocuments } from "@/features/campaigns/CampaignDocuments";
import { listCampaignDocuments } from "@/server/documents/repository";
import { CampaignStrategyV2Workspace } from "@/features/campaigns/CampaignStrategyV2Workspace";
import {
  getCurrentCampaignStrategyV2Draft,
  getCurrentConfirmedCampaignStrategyV2,
} from "@/server/campaign-strategy-v2/repository";
import { getCampaignWorkflowVersion } from "@/server/campaigns/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
export default async function StrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; message?: string }>;
}) {
  const { id } = await params;
  const { mode, message } = await searchParams;
  const campaign = await loadCampaignPage(id);
  const { currentWorkspace } = await getWorkspaceContext();
  const workflowVersion = currentWorkspace
    ? await getCampaignWorkflowVersion(currentWorkspace.id, campaign.id)
    : null;
  if (currentWorkspace && workflowVersion === "v2") {
    const [draft, confirmed] = await Promise.all([
      getCurrentCampaignStrategyV2Draft(currentWorkspace.id, campaign.id),
      getCurrentConfirmedCampaignStrategyV2(currentWorkspace.id, campaign.id),
    ]);
    const current = draft ?? confirmed;
    if (!current) throw new Error("Campaign Strategy V2 is missing for this campaign.");
    return (
      <CampaignShell campaign={campaign} active="discovery">
        <CampaignStrategyV2Workspace
          campaignId={campaign.id}
          draftId={draft?.id ?? null}
          strategy={current.strategy}
          message={message}
        />
      </CampaignShell>
    );
  }
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
