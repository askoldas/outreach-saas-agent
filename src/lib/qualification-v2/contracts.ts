export type CandidateRelationship =
  | "probable_buyer"
  | "possible_buyer"
  | "end_user"
  | "reseller"
  | "distributor"
  | "channel_partner"
  | "integration_partner"
  | "referral_partner"
  | "supplier"
  | "competitor"
  | "strategic_partner"
  | "investor_or_acquirer"
  | "existing_customer"
  | "former_customer"
  | "irrelevant_adjacent"
  | "unknown";

export type CandidateEligibility =
  | "eligible"
  | "conditional"
  | "requires_research"
  | "excluded"
  | "rejected"
  | "invalid_entity"
  | "duplicate_or_merged";

export type CandidateReviewLane =
  | "recommended"
  | "conditional"
  | "requires_research"
  | "rejected"
  | "excluded"
  | "invalid"
  | "duplicate";

export type RelationshipAssessment = {
  primaryRelationship: CandidateRelationship;
  secondaryRelationships: CandidateRelationship[];
  confidence: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  unresolvedQuestions: string[];
  decisionBasis:
    | "direct_evidence"
    | "strong_inference"
    | "weak_inference"
    | "insufficient_evidence";
};

export type ExclusionAssessment = {
  ruleId: string;
  strength: "hard" | "soft" | "informational";
  state: "triggered" | "suspected" | "not_triggered" | "unknown" | "not_applicable";
  confidence: number;
  evidenceIds: string[];
  effect:
    | "exclude"
    | "route_to_other_relationship"
    | "reduce_fit"
    | "requires_research"
    | "informational"
    | "none";
};

export type FactorDefinition = {
  key: string;
  label: string;
  purposes: Array<
    "fit" | "commercial_potential" | "confidence" | "eligibility" | "relationship"
  >;
  weight: number;
  criticality: "required" | "important" | "supporting";
  unknownPolicy:
    | "reduce_confidence_only"
    | "requires_research_if_required"
    | "not_applicable_when_unresolved";
};

export type FactorEvaluation = {
  factorKey: string;
  applicability: "applicable" | "not_applicable";
  state: "positive" | "negative" | "unknown" | "conflicting" | "not_applicable";
  signedValue?: number;
  potentialValue?: number;
  confidence: number;
  evidenceQuality: number;
  evidenceIds: string[];
  counterEvidenceIds: string[];
  criticalGateState?: "passed" | "failed" | "unresolved" | "not_applicable";
};

export type ScoreCalculation = {
  score: number | null;
  rawWeightedMean: number | null;
  denominator: number;
  includedFactorKeys: string[];
  excludedFactorKeys: string[];
  trace: Array<{ factorKey: string; weight: number; value: number }>;
};

export type ConfidenceCalculation = {
  score: number;
  evidenceCoverage: number;
  evidenceQuality: number;
  evidenceConsistency: number;
  caps: string[];
};
