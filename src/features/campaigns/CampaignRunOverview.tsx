import { Card } from "@/components/ui/Card";
import type { CampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";

export function CampaignRunOverview({
  run,
}: {
  run: CampaignWorkflowSummary["latestRun"];
}) {
  if (!run) return null;
  const nextAction = getNextAction(run.status, run.phase);
  return (
    <section className={shared.stack} aria-label="Latest campaign run">
      <div className={shared.metricGrid}>
        <Card className={shared.metric}>
          <p>Run stage</p>
          <h2>{stageLabel(run.phase)}</h2>
          <span>{run.progress}% complete</span>
        </Card>
        <Card className={shared.metric}>
          <p>Research cycle</p>
          <h2>{run.iteration || "—"}</h2>
          <span>Continues while productive work and research budget remain</span>
        </Card>
        <Card className={shared.metric}>
          <p>Run cost</p>
          <h2>{formatMoney(run.totalCost, run.currency)}</h2>
          <span>
            AI {formatMoney(run.llmCost, run.currency)} · Providers{" "}
            {formatMoney(run.providerCost, run.currency)}
          </span>
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

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 4,
  }).format(value);
}
