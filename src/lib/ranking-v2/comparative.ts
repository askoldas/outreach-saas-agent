import type { ComparativeBatchAssessment, RankableCandidate } from "./contracts.ts";

export function validateComparativeAssessment(
  assessment: ComparativeBatchAssessment,
  candidates: RankableCandidate[],
): ComparativeBatchAssessment {
  const allowed = new Set(candidates.map((candidate) => candidate.campaignCandidateId));
  if (
    assessment.preferredOrder.length !== allowed.size ||
    new Set(assessment.preferredOrder).size !== allowed.size ||
    assessment.preferredOrder.some((id) => !allowed.has(id))
  )
    throw new Error("Comparative order must contain every batch candidate exactly once.");
  const laneByCandidate = new Map(
    candidates.map((candidate) => [candidate.campaignCandidateId, candidate.lane]),
  );
  for (let index = 1; index < assessment.preferredOrder.length; index += 1) {
    const previous = assessment.preferredOrder[index - 1];
    const current = assessment.preferredOrder[index];
    if (
      previous &&
      current &&
      laneByCandidate.get(previous) !== laneByCandidate.get(current)
    )
      throw new Error("Comparative assessment cannot reorder candidates across lanes.");
  }
  if (
    assessment.anomalies.some((anomaly) =>
      anomaly.candidateIds.some((candidateId) => !allowed.has(candidateId)),
    )
  )
    throw new Error("Comparative anomaly references a candidate outside the batch.");
  return assessment;
}
