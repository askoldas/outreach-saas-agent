import type {
  CampaignResearchBudget,
  CampaignResearchUsage,
} from "../research-budget-v2/contracts.ts";
import { adaptiveResearchDecisionSchema } from "./contracts.ts";

export const MIN_PRODUCTIVE_REVIEW_READY_YIELD = 0.2;

export function nextConsecutiveLowYieldWaves(input: {
  previous: number;
  researched: number;
  reviewReady: number;
}) {
  if (input.researched === 0) return input.previous;
  return input.reviewReady / input.researched < MIN_PRODUCTIVE_REVIEW_READY_YIELD
    ? input.previous + 1
    : 0;
}

export function decideAdaptiveResearchNextAction(input: {
  budget: CampaignResearchBudget;
  usage: CampaignResearchUsage;
  lanes: {
    recommended: number;
    conditional: number;
    requiresResearch: number;
    rejected: number;
    excluded: number;
  };
  remainingPlausibleCandidates: number;
  strongUnresearchedCandidates: number;
  actionableDiscoveryGaps: number;
  unexpandedSourcePages: number;
  consecutiveLowYieldWaves: number;
  discoverySaturated: boolean;
  requestedCompanyCount?: number;
  qualifiedCompanyCount?: number;
  controlState?: "run" | "paused" | "cancelled";
}) {
  const researched = input.usage.deepResearchCandidates;
  const ratio = (value: number) => (researched === 0 ? 0 : value / researched);
  const reviewReady = input.lanes.recommended + input.lanes.conditional;
  const qualifiedCompanyCount = input.qualifiedCompanyCount ?? reviewReady;
  const budgetExhausted =
    input.usage.providerCalls >= input.budget.maxProviderCalls ||
    input.usage.aiCostUsd >= input.budget.maxAiCostUsd ||
    input.usage.aiInputTokens + input.usage.aiOutputTokens >= input.budget.maxAiTokens ||
    input.usage.deepResearchCandidates >= input.budget.maxDeepResearchCandidates ||
    input.usage.runtimeMinutes >= input.budget.maxRuntimeMinutes;
  const opportunity =
    input.strongUnresearchedCandidates > 0 ||
    input.unexpandedSourcePages > 0 ||
    input.actionableDiscoveryGaps > 0;

  let action: ReturnType<typeof adaptiveResearchDecisionSchema.parse>["action"];
  let reasonCode: string;
  let rationale: string;
  if (
    input.requestedCompanyCount !== undefined &&
    qualifiedCompanyCount >= input.requestedCompanyCount
  ) {
    [action, reasonCode, rationale] = [
      "stop_target_reached",
      "qualified_company_target_reached",
      `The requested ${input.requestedCompanyCount} qualified companies have been delivered.`,
    ];
  } else if (input.controlState === "cancelled") {
    [action, reasonCode, rationale] = [
      "cancel",
      "user_cancelled",
      "The user cancelled research.",
    ];
  } else if (input.controlState === "paused") {
    [action, reasonCode, rationale] = [
      "pause",
      "user_paused",
      "The user paused research.",
    ];
  } else if (budgetExhausted) {
    [action, reasonCode, rationale] = [
      "stop_budget",
      "cycle_budget_exhausted",
      opportunity
        ? "The current cycle budget is exhausted while additional opportunity remains."
        : "The current cycle budget is exhausted.",
    ];
  } else if (input.strongUnresearchedCandidates > 0) {
    [action, reasonCode, rationale] = [
      "research_existing_pool",
      "strong_pool_available",
      "Strong unresearched candidates remain, so no additional discovery should be purchased yet.",
    ];
  } else if (input.unexpandedSourcePages > 0) {
    [action, reasonCode, rationale] = [
      "expand_source_pages",
      "source_expansion_available",
      "High-value discovery sources remain partially expanded.",
    ];
  } else if (input.consecutiveLowYieldWaves >= 2) {
    [action, reasonCode, rationale] = [
      "stop_low_yield",
      "research_yield_declined",
      "Review-ready yield remained low across consecutive research waves.",
    ];
  } else if (input.actionableDiscoveryGaps > 0 && !input.discoverySaturated) {
    [action, reasonCode, rationale] = [
      "discover_more",
      "productive_gap_available",
      "The candidate pool is depleted and a bounded discovery gap remains actionable.",
    ];
  } else if (input.discoverySaturated) {
    [action, reasonCode, rationale] = [
      "stop_saturation",
      "market_routes_saturated",
      "Available discovery routes appear saturated.",
    ];
  } else {
    [action, reasonCode, rationale] = [
      "stop_no_actionable_work",
      "no_actionable_work",
      "No strong candidate, source expansion, or productive discovery gap remains.",
    ];
  }

  return adaptiveResearchDecisionSchema.parse({
    schemaVersion: 1,
    action,
    reasonCode,
    rationale,
    budget: input.budget,
    usage: input.usage,
    yield: {
      researched,
      ...input.lanes,
      reviewReadyYield: ratio(reviewReady),
      recommendedYield: ratio(input.lanes.recommended),
      requiresResearchYield: ratio(input.lanes.requiresResearch),
      rejectionExclusionYield: ratio(input.lanes.rejected + input.lanes.excluded),
    },
    remainingPlausibleCandidates: input.remainingPlausibleCandidates,
    strongUnresearchedCandidates: input.strongUnresearchedCandidates,
    actionableDiscoveryGaps: input.actionableDiscoveryGaps,
    unexpandedSourcePages: input.unexpandedSourcePages,
    consecutiveLowYieldWaves: input.consecutiveLowYieldWaves,
    additionalOpportunityRemains: opportunity,
  });
}
