import type { CampaignResearchCandidateInput } from "./research-runtime.ts";

export const CANDIDATE_PRIORITIZATION_VERSION = "candidate-opportunity-triage-v2";

export type CandidatePrioritySignal = {
  key: string;
  contribution: number;
  explanation: string;
};
export type CandidatePrioritization = {
  version: typeof CANDIDATE_PRIORITIZATION_VERSION;
  score: number;
  lane: "deep_research" | "hold" | "suppress";
  suppressedReason?:
    | "existing_customer"
    | "competitor"
    | "explicit_exclusion"
    | "excluded_relationship"
    | "outside_target_geography"
    | "not_operating_organization";
  researchability: { score: number; difficulty: "low" | "medium" | "high" };
  relationshipSuppression?: CampaignResearchCandidateInput["relationshipSuppression"];
  signals: CandidatePrioritySignal[];
};
export type CandidateCommercialContext = {
  matchedLanePriorities?: Array<"priority" | "secondary" | "conditional" | "exploratory">;
  positiveSignalCount?: number;
  negativeSignalCount?: number;
  expectedScaleSignals?: string[];
  expectedBuyingSignals?: string[];
};

export function prioritizeResearchCandidate(
  candidate: CampaignResearchCandidateInput,
  context: CandidateCommercialContext = {},
): CandidatePrioritization {
  const keys = candidate.claimStates.map(({ key }) => key.toLowerCase());
  const reliableRelationshipKeys = candidate.claimStates
    .filter(
      ({ epistemicStatus, freshnessState, reusableStatus }) =>
        (epistemicStatus === "explicit_fact" ||
          epistemicStatus === "evidence_backed_inference") &&
        freshnessState !== "stale" &&
        reusableStatus === "active",
    )
    .map(({ key }) => key.toLowerCase());
  const existingCustomer = reliableRelationshipKeys.some((key) =>
    /existing[_ .-]?customer/.test(key),
  );
  const excludedRelationship = reliableRelationshipKeys.some((key) =>
    /(?:competitor|irrelevant[_ .-]?relationship|hard[_ .-]?exclusion)/.test(key),
  );
  const reliableQuality = candidate.triageEvidence?.preliminaryQuality.filter(
    ({ confidence }) => confidence >= 0.75,
  );
  const outsideTargetGeography =
    reliableQuality?.some(
      ({ likelyTargetGeography }) => likelyTargetGeography === false,
    ) &&
    !reliableQuality.some(({ likelyTargetGeography }) => likelyTargetGeography === true);
  const notOperatingOrganization =
    reliableQuality?.some(
      ({ likelyOperatingOrganization }) => likelyOperatingOrganization === false,
    ) &&
    !reliableQuality.some(
      ({ likelyOperatingOrganization }) => likelyOperatingOrganization === true,
    );
  const suppressedReason = existingCustomer
    ? ("existing_customer" as const)
    : excludedRelationship
      ? ("excluded_relationship" as const)
      : outsideTargetGeography
        ? ("outside_target_geography" as const)
        : notOperatingOrganization
          ? ("not_operating_organization" as const)
          : undefined;
  const relationshipSuppression = candidate.relationshipSuppression;
  const relationshipSuppressedReason =
    relationshipSuppression?.decision === "suppress"
      ? relationshipSuppression.reason === "existing_customer" ||
        relationshipSuppression.reason === "competitor" ||
        relationshipSuppression.reason === "explicit_exclusion"
        ? relationshipSuppression.reason
        : "excluded_relationship"
      : undefined;
  const finalSuppressedReason = relationshipSuppressedReason ?? suppressedReason;
  const signals: CandidatePrioritySignal[] = [];
  const priorities = context.matchedLanePriorities ?? [];
  const laneFit = priorities.includes("priority")
    ? 30
    : priorities.includes("secondary") || priorities.includes("conditional")
      ? 23
      : candidate.matchedArchetypeIds.length
        ? 16
        : 0;
  add(
    signals,
    "lane_fit",
    laneFit,
    "Commercial fit follows the strongest matched opportunity lane.",
  );
  const cheapSignals = [
    ...(candidate.triageEvidence?.matchedSignals ?? []),
    ...(candidate.triageEvidence?.keywords ?? []),
  ].map((value) => value.toLowerCase());
  const genericScaleEvidence = [...keys, ...cheapSignals].filter((key) =>
    /(?:scale|employee|revenue|location|site|facility|capacity|room|production)/.test(
      key,
    ),
  ).length;
  const scaleEvidence = Math.max(
    genericScaleEvidence,
    matchingSignalCount(cheapSignals, context.expectedScaleSignals ?? []),
  );
  const employeeScale = candidate.triageEvidence?.employeeCount
    ? candidate.triageEvidence.employeeCount >= 250
      ? 10
      : candidate.triageEvidence.employeeCount >= 50
        ? 6
        : candidate.triageEvidence.employeeCount >= 10
          ? 3
          : 0
    : 0;
  add(
    signals,
    "account_potential",
    Math.min(25, scaleEvidence * 6 + employeeScale),
    `${scaleEvidence} account-scale proxy signal(s) and bounded employee evidence are available.`,
  );
  add(
    signals,
    "offering_relevance",
    Math.min(15, candidate.matchedArchetypeIds.length * 8),
    `${candidate.matchedArchetypeIds.length} opportunity lane(s) match.`,
  );
  const genericTimingEvidence = [...keys, ...cheapSignals].filter((key) =>
    /(?:freshness|opening|expansion|renovation|funding|tender|procurement|hiring|investment|acquisition)/.test(
      key,
    ),
  ).length;
  const timingEvidence = Math.max(
    genericTimingEvidence,
    matchingSignalCount(cheapSignals, context.expectedBuyingSignals ?? []),
  );
  add(
    signals,
    "buying_timing",
    Math.min(
      15,
      timingEvidence * 6 + Math.min(6, (context.positiveSignalCount ?? 0) * 2),
    ),
    `${timingEvidence} current buying/timing signal(s) are available.`,
  );
  add(
    signals,
    "market_lane_importance",
    priorities.includes("priority")
      ? 10
      : priorities.includes("secondary") || priorities.includes("conditional")
        ? 6
        : priorities.length
          ? 3
          : 0,
    "Market lane importance informs queue order.",
  );
  add(
    signals,
    "identity_confidence",
    candidate.organizationType !== "unknown" ? 3 : 0,
    "Identity contributes limited confidence, not commercial value.",
  );
  const qualityEvidence = reliableQuality ?? [];
  add(
    signals,
    "commercial_plausibility",
    Math.min(
      7,
      qualityEvidence.reduce(
        (total, quality) =>
          total +
          (quality.likelyOperatingOrganization === true ? 2 : 0) +
          (quality.likelyTargetGeography === true ? 2 : 0),
        0,
      ),
    ),
    "High-confidence discovery evidence supports operating-company and geography plausibility.",
  );
  add(
    signals,
    "negative_evidence",
    -Math.min(30, (context.negativeSignalCount ?? 0) * 8),
    "Negative commercial evidence reduces priority.",
  );
  const score = finalSuppressedReason
    ? 0
    : Math.max(
        0,
        Math.min(
          100,
          signals.reduce((sum, item) => sum + item.contribution, 0),
        ),
      );
  const researchabilityScore = Math.min(
    100,
    (candidate.canonicalDomain ? 45 : 0) +
      (candidate.canonicalUrl ? 15 : 0) +
      Math.min(30, new Set(candidate.discoverySourceIds).size * 10) +
      (candidate.currentIntelligenceVersionId ? 10 : 0),
  );
  return {
    version: CANDIDATE_PRIORITIZATION_VERSION,
    score,
    lane: finalSuppressedReason
      ? "suppress"
      : relationshipSuppression?.decision === "hold"
        ? "hold"
        : score >= 45
          ? "deep_research"
          : "hold",
    ...(finalSuppressedReason ? { suppressedReason: finalSuppressedReason } : {}),
    ...(relationshipSuppression ? { relationshipSuppression } : {}),
    researchability: {
      score: researchabilityScore,
      difficulty:
        researchabilityScore >= 70
          ? "low"
          : researchabilityScore >= 35
            ? "medium"
            : "high",
    },
    signals,
  };
}

function add(
  signals: CandidatePrioritySignal[],
  key: string,
  contribution: number,
  explanation: string,
) {
  signals.push({ key, contribution, explanation });
}

function matchingSignalCount(observed: string[], expected: string[]) {
  const expectedTokens = expected.map(tokenSet).filter((tokens) => tokens.size > 0);
  return observed.filter((value) => {
    const observedTokens = tokenSet(value);
    return expectedTokens.some((tokens) =>
      [...tokens].some((token) => observedTokens.has(token)),
    );
  }).length;
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 4),
  );
}
