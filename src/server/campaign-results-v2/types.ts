export const resultLanes = [
  "recommended",
  "conditional",
  "needs_research",
  "rejected",
  "excluded",
  "invalid_duplicate",
] as const;

export type ResultLane = (typeof resultLanes)[number];

export type CampaignResultCandidate = {
  archetypes: string[];
  artifactVersions: {
    campaignTargetModelVersionId: string | null;
    candidateIntelligenceVersionId: string;
    commercialRelationshipAssessmentVersionId: string | null;
    companyIntelligenceVersionId: string | null;
    qualificationEvaluationVersionId: string;
  };
  candidateId: string;
  confidence: number | null;
  correctionCount: number;
  country: string | null;
  domain: string | null;
  eligibility: string;
  eligibilityReason: string;
  evaluationId: string;
  explanation: string;
  factors: Array<{
    confidence: number;
    explanation: string;
    key: string;
    missingEvidence: string[];
    state: string;
    value: number | null;
  }>;
  fit: number | null;
  identityConfidence: number;
  identityReviewState: string;
  lane: ResultLane;
  location: string;
  name: string;
  organizationType: string;
  potential: number | null;
  provenance: {
    discoveryPurpose: string | null;
    discoveryQuery: string | null;
    firstParty: boolean;
    preclassificationConfidence: number | null;
    preclassificationDisposition: string | null;
    preclassificationReasons: string[];
    provider: string | null;
    sourceTitle: string | null;
    sourceType: string | null;
  };
  rank: number;
  relationship: string;
  relationshipConfidence: number | null;
  relationshipCorrectionProposals: Array<{
    createdAt: string;
    dimension: string;
    id: string;
    proposedValue: string;
    reason: string;
    sourceRelationshipAssessmentVersionId: string;
    status: string;
  }>;
  relationshipDimensions: Array<{
    confidence: number;
    counterEvidenceIds: string[];
    evidenceIds: string[];
    rationale: string;
    state: string;
    type: string;
    unresolvedQuestions: string[];
  }>;
  reviewDecision: string | null;
  reviewReason: string | null;
  sourceUrl: string | null;
  strongestEvidence: string;
  unresolvedQuestions: string[];
  websiteUrl: string | null;
};

export type CampaignV2Results = {
  funnel: {
    sourceRecords: number;
    organizationReferences: number;
    uniqueOrganizations: number;
    plausibleCandidates: number;
    deeplyResearched: number;
  };
  researchOutcome: {
    action: string;
    rationale: string;
    additionalOpportunityRemains: boolean;
  } | null;
  appliedMemorySnapshotId: string | null;
  anomalies: Array<{
    blocking: boolean;
    explanation: string;
    id: string;
    recommendation: string;
    severity: string;
  }>;
  candidates: CampaignResultCandidate[];
  coverage: Array<{
    archetype: string;
    confidence: number;
    geography: string;
    id: string;
    reasons: string[];
    status: string;
  }>;
  entityReviewCases: Array<{
    id: string;
    openedAt: string;
    status: string;
  }>;
  gaps: Array<{
    description: string;
    id: string;
    severity: string;
    status: string;
  }>;
  laneCounts: Record<ResultLane, number>;
  runId: string;
  runStatus: string;
};
