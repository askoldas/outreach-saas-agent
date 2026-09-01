import Link from "next/link";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { CampaignWorkflowSummary } from "@/features/campaigns/CampaignWorkflowSummary";
import { ProgressiveCompanyResults } from "@/features/campaigns/ProgressiveCompanyResults";
import { CampaignRunTimeline } from "@/features/campaigns/CampaignRunTimeline";
import { InternalResearchUsage } from "@/features/campaigns/InternalResearchUsage";
import { ResearchBudgetSummary } from "@/features/campaigns/ResearchBudgetSummary";
import { ResearchLiveRefresh } from "@/features/campaigns/ResearchLiveRefresh";
import { getCampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import { loadCampaignPage } from "@/server/campaigns/page-data";
import { getInternalResearchUsage } from "@/server/credits/usage-summary";
import { getResearchBudgetState } from "@/server/credits/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export default async function CompanyResearchPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const { run } = await searchParams;
  const campaign = await loadCampaignPage(id);
  const { currentWorkspace } = await getWorkspaceContext();
  const workflow = currentWorkspace ? await getCampaignWorkflowSummary(currentWorkspace.id, id, run) : null;
  const usage = currentWorkspace && workflow?.latestRun?.id ? await getInternalResearchUsage({ workspaceId: currentWorkspace.id, campaignRunId: workflow.latestRun.id }) : null;
  const budget = currentWorkspace && workflow?.latestRun?.id ? await getResearchBudgetState({ workspaceId: currentWorkspace.id, campaignRunId: workflow.latestRun.id }) : null;
  return <CampaignShell campaign={campaign} active="research">
    <h3>Company Research</h3>
    <p>Market understanding, source exploration, company resolution, and fit evaluation evolve together while research is active.</p>
    <Link href={`/campaigns/${campaign.id}/strategy?mode=revise`}>Adjust targeting</Link>
    {workflow ? <>
      <ResearchLiveRefresh status={workflow.latestRun?.status ?? null} />
      <ResearchBudgetSummary budget={budget} />
      <CampaignWorkflowSummary summary={workflow} view="all" />
      <CampaignRunTimeline events={workflow.runEvents} />
      <ProgressiveCompanyResults companies={workflow.progressiveCompanies} />
      <InternalResearchUsage usage={usage} />
    </> : <p>Company Research will appear here after the campaign starts.</p>}
  </CampaignShell>;
}
