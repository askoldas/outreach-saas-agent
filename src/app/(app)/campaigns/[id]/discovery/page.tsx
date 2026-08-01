import Link from "next/link";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { CampaignWorkflowSummary } from "@/features/campaigns/CampaignWorkflowSummary";
import { CampaignCandidateAudit } from "@/features/campaigns/CampaignCandidateAudit";
import { CampaignRunTimeline } from "@/features/campaigns/CampaignRunTimeline";
import { getCampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import { loadCampaignPage } from "@/server/campaigns/page-data";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export default async function DiscoveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { id } = await params;
  const { run } = await searchParams;
  const campaign = await loadCampaignPage(id);
  const { currentWorkspace } = await getWorkspaceContext();
  const workflow = currentWorkspace
    ? await getCampaignWorkflowSummary(currentWorkspace.id, id, run)
    : {
        selectedRunId: null,
        selectedRunIsLatest: true,
        runEvents: [],
        runHistory: [],
        candidateAudit: [],
        latestRun: null,
        marketAnalysis: null,
        v2Strategy: null,
        v2Discovery: null,
        discoveryPaths: [],
        classificationCounts: {},
        excludedCandidates: [],
        iterations: [],
      };
  const hasDiscovery =
    workflow.discoveryPaths.length ||
    workflow.v2Discovery ||
    workflow.iterations.length ||
    workflow.candidateAudit.length ||
    Object.keys(workflow.classificationCounts).length;
  return (
    <CampaignShell campaign={campaign} active="discovery">
      {!workflow.selectedRunIsLatest && workflow.selectedRunId ? (
        <p>
          Viewing historical Campaign Run {workflow.selectedRunId.slice(0, 8)}.{" "}
          <Link href={`/campaigns/${campaign.id}/discovery`}>View latest run</Link>
        </p>
      ) : null}
      {hasDiscovery ? (
        <>
          <CampaignWorkflowSummary summary={workflow} view="discovery" />
          <CampaignRunTimeline events={workflow.runEvents} />
          <CampaignCandidateAudit candidates={workflow.candidateAudit} />
        </>
      ) : (
        <p>Discovery paths and candidate decisions will appear here after planning.</p>
      )}
    </CampaignShell>
  );
}
