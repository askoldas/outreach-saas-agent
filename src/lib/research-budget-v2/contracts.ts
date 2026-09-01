import { z } from "zod";

export const campaignResearchBudgetSchema = z
  .object({
    maxProviderCalls: z.number().int().positive(),
    maxAiCostUsd: z.number().nonnegative(),
    maxAiTokens: z.number().int().nonnegative(),
    maxDeepResearchCandidates: z.number().int().nonnegative(),
    maxRuntimeMinutes: z.number().int().positive(),
  })
  .strict();

export const campaignResearchUsageSchema = z
  .object({
    providerCalls: z.number().int().nonnegative(),
    providerRecords: z.number().int().nonnegative(),
    aiInputTokens: z.number().int().nonnegative(),
    aiOutputTokens: z.number().int().nonnegative(),
    aiCostUsd: z.number().nonnegative(),
    pagesFetched: z.number().int().nonnegative(),
    uniqueOrganizations: z.number().int().nonnegative(),
    deepResearchCandidates: z.number().int().nonnegative(),
    qualifiedCandidates: z.number().int().nonnegative(),
    runtimeMinutes: z.number().nonnegative(),
  })
  .strict();

export type CampaignResearchBudget = z.infer<typeof campaignResearchBudgetSchema>;
export type CampaignResearchUsage = z.infer<typeof campaignResearchUsageSchema>;

// Operational safety limits are independent from the customer-authorized credit cap.
export const DEFAULT_CAMPAIGN_RESEARCH_SAFETY_LIMITS: CampaignResearchBudget =
  Object.freeze({
    maxProviderCalls: 30,
    maxAiCostUsd: 2,
    maxAiTokens: 500_000,
    maxDeepResearchCandidates: 40,
    maxRuntimeMinutes: 45,
  });

// Transitional database projection only. Native research never treats this as a goal.
export const LEGACY_CAMPAIGN_VOLUME_PROJECTION = 25;
