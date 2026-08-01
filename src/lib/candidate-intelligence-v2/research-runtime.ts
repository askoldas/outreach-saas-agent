import { hashCanonical } from "../intelligence/campaign-strategy-v2/context-compiler.ts";
import type { CampaignStrategyV2 } from "../intelligence/campaign-strategy-v2/schemas.ts";
import type {
  CandidateResearchPlan,
  CandidateResearchQuestion,
  FreshnessClass,
  ResearchScope,
} from "./contracts.ts";
import { compileCandidateResearchPlan } from "./research-plan.ts";

export const CANDIDATE_RESEARCH_RUNTIME_CONTRACT_VERSION = "candidate-research-v2.2";

export type CandidateResearchClaimState = {
  key: string;
  epistemicStatus:
    | "explicit_fact"
    | "evidence_backed_inference"
    | "hypothesis"
    | "unknown"
    | "conflict";
  freshnessState: "current" | "acceptable" | "stale" | "unknown";
  reusableStatus: "active" | "conflicting" | "superseded" | "rejected";
  reusableScope: ResearchScope;
};

export type CampaignResearchCandidateInput = {
  campaignCandidateId: string;
  organizationId: string;
  organizationName: string;
  organizationType: string;
  canonicalDomain: string | null;
  canonicalUrl: string | null;
  procurementAutonomy: string | null;
  matchedArchetypeIds: string[];
  discoverySourceIds: string[];
  currentIntelligenceVersionId: string | null;
  unresolvedQuestionKeys: string[];
  conflictKeys: string[];
  claimStates: CandidateResearchClaimState[];
};

export type PreparedCampaignResearchPlan = {
  campaignCandidateId: string;
  organizationId: string;
  inputHash: string;
  contentHash: string;
  priority: number;
  plan: CandidateResearchPlan;
  sourcePlan: {
    canonicalDomain: string | null;
    canonicalUrl: string | null;
    discoverySourceIds: string[];
    preferredPages: CandidateResearchPlan["preferredPages"];
    maximumDiscoverySources: number;
    maximumFirstPartyFetches: number;
    deferredQuestionKeys: string[];
    deferredReusableQuestionKeys: string[];
  };
  reusableIntelligenceVersionId: string | null;
};

export function prepareCampaignResearchPlans(input: {
  campaignRunId: string;
  strategyVersionId: string;
  strategy: CampaignStrategyV2;
  candidates: CampaignResearchCandidateInput[];
}): PreparedCampaignResearchPlan[] {
  const archetypeById = new Map(
    input.strategy.archetypes.map((archetype) => [archetype.id, archetype] as const),
  );
  return [...input.candidates]
    .sort((left, right) =>
      left.campaignCandidateId.localeCompare(right.campaignCandidateId),
    )
    .map((candidate) => {
      const matchedArchetypes = candidate.matchedArchetypeIds.map((id) => {
        const archetype = archetypeById.get(id);
        if (!archetype) {
          throw new Error(
            `Campaign Candidate references unknown frozen archetype "${id}".`,
          );
        }
        return archetype;
      });
      const required = new Set(["business_model", "products_services"]);
      const optional = new Set(["operating_markets"]);
      const requiresTargetGeography =
        !input.strategy.geography.countryCodes.includes("WORLDWIDE");
      if (requiresTargetGeography) required.add("target_geography");
      const reusableQuestionKeys = new Set([
        "business_model",
        "products_services",
        "operating_markets",
        ...candidate.unresolvedQuestionKeys,
        ...candidate.conflictKeys,
      ]);
      for (const key of candidate.unresolvedQuestionKeys) required.add(key);
      for (const archetype of matchedArchetypes) {
        for (const question of archetype.requiredEvidenceQuestions) {
          if (
            question.importance === "critical" ||
            question.unknownAction === "requires_research"
          ) {
            required.add(question.questionKey);
          } else {
            optional.add(question.questionKey);
          }
        }
      }
      for (const question of input.strategy.qualificationPolicy
        .minimumEvidenceRequirements) {
        if (
          question.importance === "critical" ||
          question.unknownAction === "requires_research"
        ) {
          required.add(question.questionKey);
        } else {
          optional.add(question.questionKey);
        }
      }
      for (const factor of input.strategy.qualificationPolicy.factorDefinitions) {
        if (factor.unknownPolicy === "confidence_only") continue;
        const key = `factor.${factor.factorKey}`;
        if (
          factor.unknownPolicy === "gate_if_critical" ||
          factor.criticality === "critical"
        ) {
          required.add(key);
        } else {
          optional.add(key);
        }
      }
      for (const rule of input.strategy.qualificationPolicy.hardExclusionRules) {
        required.add(`exclusion.${rule.ruleKey}`);
      }
      if (!candidate.procurementAutonomy || candidate.procurementAutonomy === "unknown") {
        reusableQuestionKeys.add("procurement_authority");
      }

      const activeClaims = candidate.claimStates.filter(
        (claim) =>
          claim.reusableStatus === "active" &&
          ["current", "acceptable"].includes(claim.freshnessState) &&
          ["explicit_fact", "evidence_backed_inference"].includes(claim.epistemicStatus),
      );
      const resolvedQuestionKeys = activeClaims.map(({ key }) => key);
      const staleQuestionKeys = candidate.claimStates
        .filter(
          (claim) =>
            claim.reusableStatus === "active" && claim.freshnessState === "stale",
        )
        .map(({ key }) => key);
      for (const { key, reusableScope } of candidate.claimStates) {
        if (reusableScope === "organization") reusableQuestionKeys.add(key);
      }
      const conflictQuestionKeys = candidate.claimStates
        .filter(
          ({ reusableStatus, epistemicStatus }) =>
            reusableStatus === "conflicting" || epistemicStatus === "conflict",
        )
        .map(({ key }) => key)
        .concat(candidate.conflictKeys);
      const plan = compileCandidateResearchPlan({
        organizationId: candidate.organizationId,
        campaignCandidateId: candidate.campaignCandidateId,
        strategyVersionId: input.strategyVersionId,
        requiredQuestionKeys: prioritizeTargetGeography(required),
        optionalQuestionKeys: [...optional].sort(compareText),
        resolvedQuestionKeys,
        staleQuestionKeys,
        conflictQuestionKeys,
        reusableQuestionKeys: [...reusableQuestionKeys].sort(compareText),
        procurementUnknown:
          !candidate.procurementAutonomy || candidate.procurementAutonomy === "unknown",
        pageBudget: Math.min(8, Math.max(3, required.size)),
        questionOverrides: buildQuestionOverrides(input.strategy),
      });
      const frozenQuestionKeys = new Set(plan.questions.map(({ key }) => key));
      const requestedQuestionKeys = new Set([
        ...required,
        ...optional,
        ...staleQuestionKeys,
        ...conflictQuestionKeys,
        ...(!candidate.procurementAutonomy || candidate.procurementAutonomy === "unknown"
          ? ["procurement_authority"]
          : []),
      ]);
      const sourcePlan = {
        canonicalDomain: candidate.canonicalDomain,
        canonicalUrl: candidate.canonicalUrl,
        discoverySourceIds: [...new Set(candidate.discoverySourceIds)].sort(compareText),
        preferredPages: plan.preferredPages,
        maximumDiscoverySources: 3,
        maximumFirstPartyFetches: 1,
        deferredQuestionKeys: [...requestedQuestionKeys]
          .filter((key) => !frozenQuestionKeys.has(key))
          .sort(compareText),
        deferredReusableQuestionKeys: [...requestedQuestionKeys]
          .filter((key) => reusableQuestionKeys.has(key) && !frozenQuestionKeys.has(key))
          .sort(compareText),
      };
      const contentHash = hashCanonical({
        campaignRunId: input.campaignRunId,
        plan,
        sourcePlan,
        contractVersion: CANDIDATE_RESEARCH_RUNTIME_CONTRACT_VERSION,
      });
      return {
        campaignCandidateId: candidate.campaignCandidateId,
        organizationId: candidate.organizationId,
        inputHash: hashCanonical({
          campaignRunId: input.campaignRunId,
          campaignCandidateId: candidate.campaignCandidateId,
          contentHash,
          contractVersion: CANDIDATE_RESEARCH_RUNTIME_CONTRACT_VERSION,
        }),
        contentHash,
        priority: highestPriority(plan.questions),
        plan,
        sourcePlan,
        reusableIntelligenceVersionId:
          plan.questions.length === 0 ? candidate.currentIntelligenceVersionId : null,
      };
    });
}

export function freshnessClassForQuestion(
  question: CandidateResearchQuestion,
): FreshnessClass {
  if (question.purpose === "identity") return "stable";
  if (question.purpose === "business_model" || question.purpose === "relationship") {
    return "slow_changing";
  }
  if (question.purpose === "procurement") return "dynamic";
  if (question.purpose === "freshness") return "volatile";
  return "dynamic";
}

function highestPriority(questions: CandidateResearchQuestion[]) {
  return Math.max(1, Math.min(100, questions[0]?.priority ?? 1));
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function prioritizeTargetGeography(keys: Set<string>) {
  return [...keys].sort((left, right) => {
    if (left === "target_geography") return -1;
    if (right === "target_geography") return 1;
    return compareText(left, right);
  });
}

function buildQuestionOverrides(
  strategy: CampaignStrategyV2,
): NonNullable<Parameters<typeof compileCandidateResearchPlan>[0]["questionOverrides"]> {
  const overrides: NonNullable<
    Parameters<typeof compileCandidateResearchPlan>[0]["questionOverrides"]
  > = {};
  for (const archetype of strategy.archetypes) {
    for (const question of archetype.requiredEvidenceQuestions) {
      overrides[question.questionKey] = {
        question: question.question,
        purpose: "eligibility",
        reusableScope: "campaign_only",
        expectedEvidenceTypes: ["official_web_page", "official_document"],
      };
    }
  }
  for (const requirement of strategy.qualificationPolicy.minimumEvidenceRequirements) {
    overrides[requirement.questionKey] = {
      question: requirement.question,
      purpose: "eligibility",
      reusableScope: "campaign_only",
      expectedEvidenceTypes: [
        "official_web_page",
        "official_document",
        "legal_registry",
        "directory_profile",
      ],
    };
  }
  for (const factor of strategy.qualificationPolicy.factorDefinitions) {
    overrides[`factor.${factor.factorKey}`] = {
      question: `What reliable public evidence resolves this qualification factor: ${factor.definition}`,
      purpose: "qualification_factor",
      reusableScope: "campaign_only",
      expectedEvidenceTypes: ["official_web_page", "official_document"],
    };
  }
  if (!strategy.geography.countryCodes.includes("WORLDWIDE")) {
    const countryCodes = strategy.geography.countryCodes.join(", ");
    overrides.target_geography = {
      question:
        `Is the organization legally based in or demonstrably operating in ${strategy.geography.displayName} (${countryCodes})? ` +
        "A search-query match or incidental mention is not evidence of geographic eligibility.",
      purpose: "eligibility",
      reusableScope: "campaign_only",
      expectedEvidenceTypes: [
        "official_web_page",
        "official_document",
        "legal_registry",
        "directory_profile",
      ],
    };
  }
  return overrides;
}
