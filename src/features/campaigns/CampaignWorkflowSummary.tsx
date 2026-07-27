import type { CampaignWorkflowSummary as Summary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";

export function CampaignWorkflowSummary({
  summary,
  view = "all",
}: {
  summary: Summary;
  view?: "all" | "overview" | "market" | "discovery";
}) {
  const showMarket = view === "all" || view === "overview" || view === "market";
  const showDiscovery = view === "all" || view === "discovery";
  const showProgress = view === "all" || view === "overview" || view === "discovery";
  if (
    !summary.marketAnalysis &&
    !summary.discoveryPaths.length &&
    !summary.iterations.length
  )
    return null;
  return (
    <section className={shared.stack}>
      {showMarket && summary.marketAnalysis ? (
        <details open>
          <summary>
            <strong>Market Analysis</strong>
          </summary>
          <p>{summary.marketAnalysis.summary}</p>
          <p>
            <strong>Market breadth:</strong>{" "}
            {summary.marketAnalysis.marketBreadth.replaceAll("_", " ")}
          </p>
          <p>
            <strong>Local terminology:</strong>{" "}
            {summary.marketAnalysis.localTerminology.join(", ") ||
              "No special local terms"}
          </p>
          <p>
            <strong>Approach:</strong>{" "}
            {summary.marketAnalysis.recommendedDiscoveryApproach}
          </p>
        </details>
      ) : null}
      {showDiscovery && summary.discoveryPaths.length ? (
        <details>
          <summary>
            <strong>Discovery paths ({summary.discoveryPaths.length})</strong>
          </summary>
          {summary.discoveryPaths.map((path) => (
            <div key={path.id}>
              <p>
                <strong>{path.type.replaceAll("_", " ")}</strong> — {path.rationale}
              </p>
              <p>{path.queries.join(" · ")}</p>
            </div>
          ))}
        </details>
      ) : null}
      {showProgress && Object.keys(summary.classificationCounts).length ? (
        <p>
          <strong>Candidate classification:</strong>{" "}
          {Object.entries(summary.classificationCounts)
            .map(([status, count]) => `${status.replaceAll("_", " ")} ${count}`)
            .join(" · ")}
        </p>
      ) : null}
      {showProgress && summary.iterations.length ? (
        <details>
          <summary>
            <strong>Discovery iterations ({summary.iterations.length})</strong>
          </summary>
          {summary.iterations.map((iteration) => (
            <p key={iteration.iterationNumber}>
              <strong>Iteration {iteration.iterationNumber}:</strong>{" "}
              {iteration.decision?.replaceAll("_", " ") ?? "running"}
              {iteration.decisionReason ? ` — ${iteration.decisionReason}` : ""}
            </p>
          ))}
        </details>
      ) : null}
      {showDiscovery && summary.excludedCandidates.length ? (
        <details>
          <summary>
            <strong>
              Excluded and filtered candidates ({summary.excludedCandidates.length})
            </strong>
          </summary>
          {summary.excludedCandidates.map((candidate) => (
            <p key={candidate.id}>
              <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                {candidate.companyName}
              </a>{" "}
              — {candidate.status.replaceAll("_", " ")}: {candidate.reason}
            </p>
          ))}
        </details>
      ) : null}
    </section>
  );
}
