import type {
  CandidateEligibility,
  CandidateRelationship,
  CandidateReviewLane,
  FactorEvaluation,
} from "../qualification-v2/contracts.ts";

export type ComparativeAnomalyType =
  | "direct_evidence_ranked_below_surface_match"
  | "competitor_ranked_as_buyer"
  | "supplier_or_partner_relationship_mismatch"
  | "high_fit_low_evidence"
  | "same_evidence_different_factor_state"
  | "factor_weight_application_mismatch"
  | "critical_gate_ignored"
  | "hard_exclusion_ignored"
  | "unknown_treated_as_negative"
  | "unknown_treated_as_positive"
  | "parent_subsidiary_double_count"
  | "localized_storefront_double_count"
  | "procurement_organization_mismatch"
  | "stale_evidence_dominates"
  | "archetype_evidence_bias"
  | "geographic_evidence_bias"
  | "potential_confused_with_fit"
  | "contactability_confused_with_fit"
  | "relationship_confidence_too_low"
  | "explanation_not_supported"
  | "other";

export type RankableCandidate = {
  campaignCandidateId: string;
  evaluationVersionId: string;
  organizationId: string;
  buyingOrganizationId?: string;
  lane: CandidateReviewLane;
  eligibility: CandidateEligibility;
  relationship: CandidateRelationship;
  fitScore: number | null;
  potentialScore: number | null;
  confidence: number;
  strongestEvidenceDirectness: number;
  freshness: number;
  evidenceCoverage: number;
  factorEvaluations: FactorEvaluation[];
  hardExclusionTriggered: boolean;
  merged: boolean;
};

export type ComparativeAnomaly = {
  type: ComparativeAnomalyType;
  candidateIds: string[];
  factorKeys: string[];
  explanation: string;
  severity: "low" | "medium" | "high";
  recommendedAction:
    | "none"
    | "re_evaluate_factor"
    | "verify_relationship"
    | "verify_exclusion"
    | "verify_identity"
    | "merge_review"
    | "additional_research";
  blocksFinalization: boolean;
};

export type ComparativeBatchAssessment = {
  campaignId: string;
  batchId: string;
  preferredOrder: string[];
  anomalies: ComparativeAnomaly[];
  pairwiseRationales: Array<{
    higherCandidateId: string;
    lowerCandidateId: string;
    rationale: string;
    evidenceIds: string[];
  }>;
};
