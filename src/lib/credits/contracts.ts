import { z } from "zod";

export const researchBudgetStateSchema = z.object({
  authorizedCredits: z.number().nonnegative(),
  consumedCredits: z.number().nonnegative(),
  reservedCredits: z.number().nonnegative(),
  remainingCampaignCredits: z.number().nonnegative(),
  workspaceAvailableCredits: z.number().nonnegative(),
  spendableCredits: z.number().nonnegative(),
});

export const providerUsageSchema = z.object({
  provider: z.string().min(1),
  operation: z.string().min(1),
  model: z.string().min(1).optional(),
  providerRequestId: z.string().min(1).optional(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
  cachedTokens: z.number().int().nonnegative().optional(),
  providerUnits: z.number().nonnegative().optional(),
  actualCostUsd: z.number().nonnegative(),
});

export type ResearchBudgetState = z.infer<typeof researchBudgetStateSchema>;
export type ProviderUsage = z.infer<typeof providerUsageSchema>;
