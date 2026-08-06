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
    !summary.v2Strategy &&
    !summary.v2Discovery &&
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
      {showMarket && summary.v2Strategy ? (
        <details open>
          <summary>
            <strong>Confirmed campaign strategy</strong>
          </summary>
          <p>{summary.v2Strategy.summary}</p>
          <p>
            <strong>Objective:</strong> {summary.v2Strategy.objective}
          </p>
          <p>{summary.v2Strategy.objectiveDescription}</p>
          <p>
            <strong>Target market:</strong> {summary.v2Strategy.geography} (
            {summary.v2Strategy.countryCodes.join(", ")})
          </p>
          <p>
            <strong>Discovery languages:</strong>{" "}
            {summary.v2Strategy.workingLanguages.join(", ")}
          </p>
          {summary.v2Strategy.archetypes.map((archetype) => (
            <div key={archetype.id}>
              <p>
                <strong>{archetype.label}</strong> —{" "}
                {archetype.relationshipType.replaceAll("_", " ")}
              </p>
              <p>{archetype.rationale}</p>
            </div>
          ))}
        </details>
      ) : null}
      {showDiscovery && summary.v2Discovery ? (
        <details open>
          <summary>
            <strong>Semantic discovery execution</strong>
          </summary>
          <p>
            <strong>Status:</strong>{" "}
            {(summary.v2Discovery.runStatus ?? summary.v2Discovery.planStatus).replaceAll(
              "_",
              " ",
            )}
            {summary.v2Discovery.stoppingReason
              ? ` — ${summary.v2Discovery.stoppingReason.replaceAll("_", " ")}`
              : ""}
          </p>
          <p>
            <strong>Execution totals:</strong> {summary.v2Discovery.providerCalls} search
            queries · {summary.v2Discovery.providerRecords} provider records ·{" "}
            {summary.v2Discovery.normalizedCandidates} normalized ·{" "}
            {summary.v2Discovery.uniqueCandidates} unique
          </p>
          {summary.v2Discovery.segments.map((segment) => (
            <div key={segment.id}>
              <p>
                <strong>{segment.label}</strong> — {segment.geography} ·{" "}
                {segment.status.replaceAll("_", " ")}
              </p>
              <p>
                {segment.passCount} passes · {segment.providerRecords} source records ·{" "}
                {segment.normalizedCandidates} normalized · {segment.uniqueCandidates}{" "}
                unique · target {segment.targetCandidateCount}
              </p>
            </div>
          ))}
        </details>
      ) : null}
      {showDiscovery && summary.v2Discovery?.queries.length ? (
        <details>
          <summary>
            <strong>Executed search plan ({summary.v2Discovery.queries.length})</strong>
          </summary>
          {summary.v2Discovery.queries.map((query) => (
            <div key={query.id}>
              <p>
                <strong>{query.query}</strong>
              </p>
              <p>
                {query.family.replaceAll("_", " ")} · {query.language}
                {query.country ? ` · ${query.country}` : ""} — {query.purpose}
              </p>
            </div>
          ))}
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
