import Link from "next/link";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { CampaignWorkflowSummary } from "@/features/campaigns/CampaignWorkflowSummary";
import { getCampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import { loadCampaignPage } from "@/server/campaigns/page-data";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import shared from "@/features/shared/Feature.module.css";

export default async function MarketAnalysisPage({
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
  return (
    <CampaignShell campaign={campaign} active="market">
      {!workflow.selectedRunIsLatest && workflow.selectedRunId ? (
        <p>
          Viewing historical Campaign Run {workflow.selectedRunId.slice(0, 8)}.{" "}
          <Link href={`/campaigns/${campaign.id}/market-analysis`}>View latest run</Link>
        </p>
      ) : null}
      <section className={shared.stack}>
        <strong>Adjust this market</strong>
        <p>
          Revise geography, company types, industries, signals, or exclusions as a new
          immutable Campaign Strategy version. Pause an active run before editing.
        </p>
        <Link href={`/campaigns/${campaign.id}/strategy?mode=revise`}>
          Adjust market and targeting
        </Link>
      </section>
      {workflow.marketAnalysis || workflow.v2Strategy ? (
        <CampaignWorkflowSummary summary={workflow} view="market" />
      ) : (
        <p>Market analysis will appear here after the campaign starts.</p>
      )}
    </CampaignShell>
  );
}
