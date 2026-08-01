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
  rank: number;
  relationship: string;
  relationshipConfidence: number | null;
  reviewDecision: string | null;
  reviewReason: string | null;
  sourceUrl: string | null;
  strongestEvidence: string;
  unresolvedQuestions: string[];
  websiteUrl: string | null;
};

export type CampaignV2Results = {
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
