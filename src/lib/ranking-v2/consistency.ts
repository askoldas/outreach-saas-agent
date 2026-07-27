import type { ComparativeAnomaly, RankableCandidate } from "./contracts.ts";

export function detectConsistencyAnomalies(
  candidates: RankableCandidate[],
  minimumRecommendedConfidence: number,
): ComparativeAnomaly[] {
  const anomalies: ComparativeAnomaly[] = [];
  for (const candidate of candidates) {
    const add = (
      type: ComparativeAnomaly["type"],
      explanation: string,
      action: ComparativeAnomaly["recommendedAction"],
    ) =>
      anomalies.push({
        type,
        candidateIds: [candidate.campaignCandidateId],
        factorKeys: [],
        explanation,
        severity: "high",
        recommendedAction: action,
        blocksFinalization: true,
      });
    if (
      candidate.lane === "recommended" &&
      (candidate.eligibility !== "eligible" ||
        candidate.fitScore === null ||
        candidate.confidence < minimumRecommendedConfidence)
    )
      add(
        "high_fit_low_evidence",
        "Recommended lane conflicts with eligibility, fit, or confidence.",
        "re_evaluate_factor",
      );
    if (candidate.lane === "recommended" && candidate.hardExclusionTriggered)
      add("hard_exclusion_ignored", "A hard exclusion was ignored.", "verify_exclusion");
    if (
      candidate.lane === "recommended" &&
      candidate.factorEvaluations.some(
        (factor) => factor.criticalGateState === "unresolved",
      )
    )
      add(
        "critical_gate_ignored",
        "An unresolved critical gate was ignored.",
        "re_evaluate_factor",
      );
    if (
      candidate.factorEvaluations.some(
        (factor) => factor.state === "unknown" && factor.signedValue !== undefined,
      )
    )
      add(
        "unknown_treated_as_negative",
        "An unknown factor entered scoring.",
        "re_evaluate_factor",
      );
    if (
      candidate.lane === "recommended" &&
      ["competitor", "supplier"].includes(candidate.relationship)
    )
      add(
        "competitor_ranked_as_buyer",
        "An incompatible relationship entered the buyer lane.",
        "verify_relationship",
      );
    if (candidate.merged && !["duplicate", "invalid"].includes(candidate.lane))
      add(
        "parent_subsidiary_double_count",
        "A merged organization retains an active commercial rank.",
        "verify_identity",
      );
  }
  const active = candidates.filter((candidate) =>
    ["recommended", "conditional", "requires_research"].includes(candidate.lane),
  );
  const seenBuyingOrganizations = new Map<string, string>();
  for (const candidate of active) {
    const buyingId = candidate.buyingOrganizationId ?? candidate.organizationId;
    const existing = seenBuyingOrganizations.get(buyingId);
    if (existing) {
      anomalies.push({
        type: "parent_subsidiary_double_count",
        candidateIds: [existing, candidate.campaignCandidateId].sort(),
        factorKeys: [],
        explanation: "Two active candidates resolve to the same buying organization.",
        severity: "high",
        recommendedAction: "merge_review",
        blocksFinalization: true,
      });
    } else seenBuyingOrganizations.set(buyingId, candidate.campaignCandidateId);
  }
  return anomalies.sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.candidateIds.join(":").localeCompare(right.candidateIds.join(":")),
  );
}
