import { Badge } from "@/components/ui/Badge";
import type { CampaignWorkflowSummary } from "@/server/campaigns/workflow-repository";
import shared from "@/features/shared/Feature.module.css";

export function CampaignCandidateAudit({
  candidates,
}: {
  candidates: CampaignWorkflowSummary["candidateAudit"];
}) {
  if (!candidates.length) return null;
  return (
    <details>
      <summary>
        <strong>Raw candidate audit ({candidates.length} most recent)</strong>
      </summary>
      <div className={shared.tableWrap}>
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Source provenance</th>
              <th>Classification</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td>
                  <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                    <strong>{candidate.companyName}</strong>
                  </a>
                  <span className={shared.secondaryText}>
                    {candidate.normalizedDomain ?? "No normalized domain"}
                    {candidate.countryRegion ? ` · ${candidate.countryRegion}` : ""}
                  </span>
                </td>
                <td>
                  <strong>{candidate.sourcePath.replaceAll("_", " ")}</strong>
                  <span className={shared.secondaryText}>
                    {candidate.sourceType} · {candidate.sourceQuery}
                  </span>
                </td>
                <td>
                  {candidate.classification ? (
                    <>
                      <Badge tone={classificationTone(candidate.classification.status)}>
                        {candidate.classification.status.replaceAll("_", " ")}
                      </Badge>
                      <span className={shared.secondaryText}>
                        {Math.round(candidate.classification.confidence * 100)}%
                        confidence
                        {candidate.classification.modelRole
                          ? ` · ${candidate.classification.modelRole}`
                          : " · deterministic"}
                      </span>
                    </>
                  ) : (
                    <Badge tone="neutral">Not classified</Badge>
                  )}
                </td>
                <td>
                  <strong>
                    {candidate.classification?.shouldEvaluate
                      ? "Deep evaluation"
                      : "Filtered"}
                  </strong>
                  <span className={shared.secondaryText}>
                    {candidate.classification?.reason ??
                      "Awaiting a classification decision."}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function classificationTone(
  status: string,
): "success" | "warning" | "danger" | "accent" | "neutral" {
  if (status === "promising") return "success";
  if (status === "possible" || status === "insufficient_data") return "warning";
  if (status === "excluded" || status === "duplicate") return "danger";
  if (status === "unlikely") return "neutral";
  return "accent";
}
