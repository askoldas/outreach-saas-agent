import { Card } from "@/components/ui/Card";
import type { CampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";
import { companyResearchOutcomeCopy } from "@/lib/company-research/outcome-copy";
import { companyResearchCompletionReasonSchema } from "@/lib/company-research/outcome";

export function CampaignRunOverview({
  run,
}: {
  run: CampaignWorkflowSummary["latestRun"];
}) {
  if (!run) return null;
  const nextAction = getNextAction(run.status, run.phase);
  const completionReason = companyResearchCompletionReasonSchema
    .nullable()
    .catch(null)
    .parse(run.completionReason);
  const outcomeCopy = companyResearchOutcomeCopy({
    completionReason,
    deliveredCompanyCount: run.deliveredCompanyCount,
    requestedCompanyCount: run.requestedCompanyCount,
  });
  return (
    <section className={shared.stack} aria-label="Latest campaign run">
      <Card className={shared.cardBody}>
        <strong>{outcomeCopy.title}</strong>
        <p>{outcomeCopy.description}</p>
        {outcomeCopy.suggestion ? <p>{outcomeCopy.suggestion}</p> : null}
      </Card>
      <div className={shared.metricGrid}>
        <Card className={shared.metric}>
          <p>Confirmed companies</p>
          <h2>
            {run.deliveredCompanyCount} / {run.requestedCompanyCount}
          </h2>
          <span>{stageLabel(run.phase)}</span>
        </Card>
        <Card className={shared.metric}>
          <p>Progress</p>
          <h2>{run.progress}%</h2>
          <span>Strong matches appear progressively</span>
        </Card>
        <Card className={shared.metric}>
          <p>Quoted price</p>
          <h2>{formatCredits(run.quotedResearchCredits)}</h2>
          <span>Maximum authorization for the requested outcome</span>
        </Card>
        <Card className={shared.metric}>
          <p>Next action</p>
          <h2>{nextAction.title}</h2>
          <span>{nextAction.detail}</span>
        </Card>
      </div>
      {run.errorMessage ? (
        <Card className={shared.cardBody}>
          <strong>Run blocker</strong>
          <p>{run.errorMessage}</p>
          {run.errorCode ? (
            <span className={shared.secondaryText}>Code: {run.errorCode}</span>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}

function stageLabel(phase: string) {
  const labels: Record<string, string> = {
    discovery_queued: "Queued",
    initializing: "Starting company research",
    market_analysis: "Updating market overview",
    discovery_planning: "Discovery planning",
    discovering: "Company research",
    evaluating: "Company research",
    qualifying: "Company research",
    paused: "Paused",
    ready_for_review: "Ready for review",
    waiting_for_input: "Needs input",
    waiting_for_enrichment_approval: "Enrichment review",
    enriching: "Contact enrichment",
    preparing_outreach: "Outreach preparation",
    completed: "Completed",
    cancelled: "Stopped",
    failed: "Failed",
  };
  return labels[phase] ?? phase.replaceAll("_", " ");
}

function getNextAction(status: string, phase: string) {
  if (status === "failed" || phase === "failed")
    return {
      title: "Inspect blocker",
      detail: "Correct the reported issue before starting another run.",
    };
  if (status === "cancelled" || phase === "cancelled")
    return {
      title: "Review results",
      detail: "Completed results were preserved; start another run if needed.",
    };
  if (phase === "waiting_for_input")
    return {
      title: "Answer question",
      detail: "Provide the focused targeting clarification below.",
    };
  if (phase === "paused")
    return {
      title: "Continue",
      detail: "Resume this run when you are ready.",
    };
  if (phase === "ready_for_review" || phase === "waiting_for_enrichment_approval")
    return {
      title: "Review companies",
      detail: "Approve relevant companies before optional contact enrichment.",
    };
  if (status === "completed" || phase === "completed")
    return {
      title: "Review results",
      detail: "Review qualified companies or start another discovery run.",
    };
  return {
    title: "No action needed",
    detail: "The campaign is processing in the background.",
  };
}

function formatCredits(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)} credits`;
}
