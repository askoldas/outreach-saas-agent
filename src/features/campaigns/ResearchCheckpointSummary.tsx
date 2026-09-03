import { Card } from "@/components/ui/Card";
import type { CompanyResearchCheckpoint } from "@/server/company-research/checkpoint";
import shared from "@/features/shared/Feature.module.css";

export function ResearchCheckpointSummary({
  checkpoint,
}: {
  checkpoint: CompanyResearchCheckpoint;
}) {
  const copy = statusCopy(checkpoint);
  return (
    <section className={shared.stack} aria-label="Company Research checkpoint">
      <div>
        <h3>{copy.title}</h3>
        <p>{copy.description}</p>
      </div>
      <div className={shared.metricGrid}>
        <Metric label="Potential companies" value={checkpoint.counts.discovered} />
        <Metric label="Resolved / validated" value={checkpoint.counts.resolved} />
        <Metric label="Reviewed" value={checkpoint.counts.reviewed} />
        <Metric
          label="Confirmed"
          value={`${checkpoint.counts.qualified} / ${checkpoint.requestedCompanyCount}`}
        />
        <Metric label="Rejected" value={checkpoint.counts.rejected} />
        <Metric label="Under research" value={checkpoint.counts.researching} />
        <Metric label="Waiting for review" value={checkpoint.counts.pending} />
      </div>
      {checkpoint.counts.pending + checkpoint.counts.researching > 0 ? (
        <div>
          <h4>Finish the current candidate pool</h4>
          {checkpoint.pendingEstimate ? (
            <p>
              {checkpoint.counts.researching} companies are being checked and qualified
              matches will appear immediately.
            </p>
          ) : (
            <p>Companies are being checked against the frozen campaign criteria.</p>
          )}
        </div>
      ) : (
        <div>
          <h4>Current candidate pool complete</h4>
          <p>
            All currently resolved companies have been reviewed. Further exploration is
            optional.
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className={shared.metric}>
      <p>{label}</p>
      <h2>{value}</h2>
    </Card>
  );
}

function statusCopy(checkpoint: CompanyResearchCheckpoint) {
  const { status } = checkpoint;
  if (status === "partial_complete" && checkpoint.completionReason === "market_exhausted")
    return {
      title: "Best matches in the current market found",
      description:
        "We could not confidently identify the full requested quantity without weakening the campaign criteria. Keep these results, broaden the target, or expand the geography.",
    };
  if (status === "partial_complete" && checkpoint.completionReason === "provider_failure")
    return {
      title: "Available matches preserved",
      description:
        "A research source remained unavailable after retries. Every confirmed company found before the interruption is ready to use.",
    };
  if (status === "partial_complete")
    return {
      title: "Strong matches found so far",
      description:
        "Research stopped at an internal safety limit. All confirmed companies remain available.",
    };
  if (status === "failed")
    return {
      title: "Research needs attention",
      description:
        "Confirmed companies found before the technical problem were preserved.",
    };
  if (status === "paused_workspace_balance")
    return {
      title: "Research paused — insufficient workspace balance",
      description:
        "All completed company research remains available. Add workspace credits before continuing paid research.",
    };
  if (status === "paused")
    return {
      title: "Research paused",
      description:
        "Completed work is preserved. Continue when you are ready to resume the same research run.",
    };
  if (status === "internal_guard")
    return {
      title: "Research stopped safely",
      description:
        "Strong matches already found remain available. An internal safety guard prevented abnormal additional spend.",
    };
  if (status === "current_pool_complete")
    return {
      title: "Market search complete",
      description:
        "No additional strong matches were found within the current scope. Keep these results or broaden the target.",
    };
  if (status === "complete")
    return {
      title: "Research complete",
      description:
        "The completed company results and supporting evidence remain available.",
    };
  if (status === "stopped")
    return {
      title: "Research stopped",
      description: "All work completed before the stop has been preserved.",
    };
  return {
    title: "Researching",
    description: "Companies become visible as soon as their identities are resolved.",
  };
}
