import type {
  CandidateEligibility,
  CandidateRelationship,
  CandidateReviewLane,
  ExclusionAssessment,
  FactorEvaluation,
} from "./contracts.ts";

export function decideEligibility(input: {
  validEntity: boolean;
  merged: boolean;
  relationship: CandidateRelationship;
  relationshipConfidence: number;
  desiredRelationships: CandidateRelationship[];
  exclusions: ExclusionAssessment[];
  factorEvaluations: FactorEvaluation[];
  evidenceCoverage: number;
  minimumEvidenceCoverage: number;
  fitScore: number | null;
  rejectBelowFit: number;
  limitingCondition: boolean;
}): CandidateEligibility {
  if (!input.validEntity) return "invalid_entity";
  if (input.merged) return "duplicate_or_merged";
  if (
    input.exclusions.some(
      (item) =>
        item.strength === "hard" &&
        item.state === "triggered" &&
        item.effect === "exclude",
    )
  )
    return "excluded";
  if (
    input.relationshipConfidence >= 0.7 &&
    !input.desiredRelationships.includes(input.relationship)
  )
    return "excluded";
  if (
    input.relationship === "unknown" ||
    input.relationshipConfidence < 0.6 ||
    input.exclusions.some(
      (item) => item.strength === "hard" && ["suspected", "unknown"].includes(item.state),
    ) ||
    input.factorEvaluations.some(
      (item) => item.criticalGateState === "unresolved" || item.state === "conflicting",
    ) ||
    input.evidenceCoverage < input.minimumEvidenceCoverage
  )
    return "requires_research";
  if (input.factorEvaluations.some((item) => item.criticalGateState === "failed"))
    return "excluded";
  if (input.fitScore !== null && input.fitScore < input.rejectBelowFit) return "rejected";
  if (input.limitingCondition) return "conditional";
  return "eligible";
}

export function assignReviewLane(input: {
  eligibility: CandidateEligibility;
  fitScore: number | null;
  confidence: number;
  minimumFitForRecommended: number;
  minimumFitForConditional: number;
  minimumConfidenceForRecommended: number;
}): CandidateReviewLane {
  const direct: Partial<Record<CandidateEligibility, CandidateReviewLane>> = {
    requires_research: "requires_research",
    excluded: "excluded",
    rejected: "rejected",
    invalid_entity: "invalid",
    duplicate_or_merged: "duplicate",
  };
  const directLane = direct[input.eligibility];
  if (directLane) return directLane;
  if (
    input.eligibility === "eligible" &&
    input.fitScore !== null &&
    input.fitScore >= input.minimumFitForRecommended &&
    input.confidence >= input.minimumConfidenceForRecommended
  )
    return "recommended";
  if (input.fitScore !== null && input.fitScore >= input.minimumFitForConditional)
    return "conditional";
  return input.fitScore === null ? "requires_research" : "rejected";
}
