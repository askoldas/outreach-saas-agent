import { CampaignControls } from "@/features/campaigns/CampaignControls";
import { CampaignClarification } from "@/features/campaigns/CampaignClarification";
import { CampaignRunOverview } from "@/features/campaigns/CampaignRunOverview";
import { CampaignRunHistory } from "@/features/campaigns/CampaignRunHistory";
import { CampaignRunTimeline } from "@/features/campaigns/CampaignRunTimeline";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { CampaignWorkflowSummary } from "@/features/campaigns/CampaignWorkflowSummary";
import shared from "@/features/shared/Feature.module.css";
import { getCampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import { loadCampaignPage } from "@/server/campaigns/page-data";
import { listCampaignLeads } from "@/server/leads/repository";
import { getCampaignResearchProgress } from "@/server/research/repository";
import { getOpenCampaignQuestion } from "@/server/campaign-questions/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await loadCampaignPage(id);
  const { currentWorkspace } = await getWorkspaceContext();
  const [workflow, progress, leads, openQuestion] = currentWorkspace
    ? await Promise.all([
        getCampaignWorkflowSummary(currentWorkspace.id, id),
        getCampaignResearchProgress({
          campaignId: id,
          workspaceId: currentWorkspace.id,
        }),
        listCampaignLeads(currentWorkspace.id, id),
        getOpenCampaignQuestion({
          campaignId: id,
          workspaceId: currentWorkspace.id,
        }),
      ])
    : [emptyWorkflow(), null, [], null];

  return (
    <CampaignShell campaign={campaign} active="overview">
      <CampaignControls
        campaignId={campaign.id}
        initialLeadCount={leads.length}
        status={campaign.status}
      />
      <CampaignRunOverview run={workflow.latestRun} />
      {openQuestion ? (
        <CampaignClarification campaignId={campaign.id} question={openQuestion} />
      ) : null}
      <section className={shared.stack}>
        <h3>Current stage</h3>
        <p>{progress?.currentStep ?? "Campaign brief ready"}</p>
        <p>
          {progress?.candidatesDiscovered ?? 0} source records ·{" "}
          {progress?.candidatesUnique ?? 0} unique organizations ·{" "}
          {progress?.candidatesClassified ?? 0} plausible candidates ·{" "}
          {progress?.companiesEvaluated ?? 0} deeply researched ·{" "}
          {progress?.companiesQualified ?? 0} review-ready
        </p>
        {progress?.currentIteration ? (
          <p>Discovery cycle {progress.currentIteration}</p>
        ) : null}
      </section>
      <CampaignWorkflowSummary summary={workflow} view="overview" />
      <CampaignRunTimeline events={workflow.runEvents} />
      <CampaignRunHistory campaignId={campaign.id} runs={workflow.runHistory} />
    </CampaignShell>
  );
}

function emptyWorkflow() {
  return {
    selectedRunId: null,
    selectedRunIsLatest: true,
    runEvents: [],
    runHistory: [],
    candidateAudit: [],
    progressiveCompanies: [],
    latestRun: null,
    marketAnalysis: null,
    marketOverview: null,
    v2Strategy: null,
    v2Discovery: null,
    discoveryPaths: [],
    classificationCounts: {},
    excludedCandidates: [],
    iterations: [],
  };
}
