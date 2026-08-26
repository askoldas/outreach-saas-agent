import { z } from "zod";
import {
  campaignResearchBudgetSchema,
  campaignResearchUsageSchema,
} from "../research-budget-v2/contracts.ts";

export const adaptiveResearchActionSchema = z.enum([
  "research_existing_pool",
  "discover_more",
  "expand_source_pages",
  "stop_budget",
  "stop_saturation",
  "stop_low_yield",
  "stop_no_actionable_work",
  "pause",
  "cancel",
]);

export const researchYieldSchema = z.object({
  researched: z.number().int().nonnegative(),
  recommended: z.number().int().nonnegative(),
  conditional: z.number().int().nonnegative(),
  requiresResearch: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  excluded: z.number().int().nonnegative(),
  reviewReadyYield: z.number().min(0).max(1),
  recommendedYield: z.number().min(0).max(1),
  requiresResearchYield: z.number().min(0).max(1),
  rejectionExclusionYield: z.number().min(0).max(1),
});

export const adaptiveResearchDecisionSchema = z.object({
  schemaVersion: z.literal(1),
  action: adaptiveResearchActionSchema,
  reasonCode: z.string().min(1),
  rationale: z.string().min(1),
  budget: campaignResearchBudgetSchema,
  usage: campaignResearchUsageSchema,
  yield: researchYieldSchema,
  remainingPlausibleCandidates: z.number().int().nonnegative(),
  strongUnresearchedCandidates: z.number().int().nonnegative(),
  actionableDiscoveryGaps: z.number().int().nonnegative(),
  unexpandedSourcePages: z.number().int().nonnegative(),
  consecutiveLowYieldWaves: z.number().int().nonnegative(),
  additionalOpportunityRemains: z.boolean(),
});

export type AdaptiveResearchDecision = z.infer<typeof adaptiveResearchDecisionSchema>;
export type AdaptiveResearchAction = z.infer<typeof adaptiveResearchActionSchema>;
