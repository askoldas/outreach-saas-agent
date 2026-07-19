import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { OutreachWorkspace } from "@/features/outreach/OutreachWorkspace";
import { listCampaignLeads } from "@/server/leads/repository";
import { listCampaignDrafts } from "@/server/drafts/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import {
  buildRecommendedRecipients,
  companyNameByLeadId,
} from "@/server/outreach/read-model";
import { listCampaignExports } from "@/server/outreach/repository";
import { getCampaignResearchProgress } from "@/server/research/repository";
export default async function OutreachPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: "contacts" | "drafts" | "exports" }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const campaign = await loadCampaignPage(id);
  const { currentWorkspace } = await getWorkspaceContext();
  const [leads, drafts, exports, runProgress] = currentWorkspace
    ? await Promise.all([
        listCampaignLeads(currentWorkspace.id, id),
        listCampaignDrafts(currentWorkspace.id, id),
        listCampaignExports(currentWorkspace.id, id),
        getCampaignResearchProgress({ campaignId: id, workspaceId: currentWorkspace.id }),
      ])
    : [[], [], [], null];
  return (
    <CampaignShell campaign={campaign} active="outreach">
      <OutreachWorkspace
        recipients={buildRecommendedRecipients(leads)}
        drafts={drafts}
        companyByLeadId={companyNameByLeadId(leads)}
        leads={leads}
        campaignId={id}
        exportHistory={exports}
        initialView={query.view}
        initialRunProgress={runProgress}
      />
    </CampaignShell>
  );
}
