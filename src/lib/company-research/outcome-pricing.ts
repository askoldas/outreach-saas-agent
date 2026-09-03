import { z } from "zod";
import type { CompanyResearchCompletionReason } from "./outcome.ts";

export const COMPANY_QUANTITY_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_REQUESTED_COMPANY_COUNT = 25;
export const MAX_REQUESTED_COMPANY_COUNT = 500;
export const campaignComplexitySchema = z.enum(["low", "medium", "high"]);
export type CampaignComplexity = z.infer<typeof campaignComplexitySchema>;

const pricingByComplexity = Object.freeze({
  // Includes the fixed discovery/bootstrap cost plus expected validation and
  // qualification yield. Provider accounting still settles only actual work.
  low: { baseCredits: 15, perCompanyCredits: 2.6, recommendedCompanyCount: 25 },
  medium: { baseCredits: 20, perCompanyCredits: 3.2, recommendedCompanyCount: 50 },
  high: { baseCredits: 25, perCompanyCredits: 3.8, recommendedCompanyCount: 100 },
} satisfies Record<
  CampaignComplexity,
  { baseCredits: number; perCompanyCredits: number; recommendedCompanyCount: number }
>);

export const companyResearchQuoteSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestedCompanyCount: z.number().int().min(1).max(MAX_REQUESTED_COMPANY_COUNT),
    complexity: campaignComplexitySchema,
    authorizedCredits: z.number().positive(),
    recommendedCompanyCount: z.number().int().positive(),
    pricingBasis: z.literal("requested_qualified_companies"),
  })
  .strict();

export const companyResearchSettlementSchema = z
  .object({
    schemaVersion: z.literal(1),
    requestedCompanyCount: z.number().int().positive(),
    deliveredCompanyCount: z.number().int().nonnegative(),
    completionReason: z.enum([
      "target_reached",
      "market_exhausted",
      "user_stopped",
      "internal_cost_guard",
      "provider_failure",
      "technical_failure",
    ]),
    authorizedCredits: z.number().nonnegative(),
    accruedCredits: z.number().nonnegative(),
    finalChargedCredits: z.number().nonnegative(),
    releasedAuthorizationCredits: z.number().nonnegative(),
    refundableCredits: z.number().nonnegative(),
    settlementPolicy: z.literal("actual_work_bounded_by_outcome_value_v1"),
  })
  .strict();

export type CompanyResearchQuote = z.infer<typeof companyResearchQuoteSchema>;
export type CompanyResearchSettlement = z.infer<typeof companyResearchSettlementSchema>;

export function assessCampaignComplexity(input: {
  countryCount?: number;
  targetSignalCount?: number;
  broadMarket?: boolean;
}): CampaignComplexity {
  const countryCount = Math.max(1, input.countryCount ?? 1);
  const targetSignalCount = Math.max(0, input.targetSignalCount ?? 0);
  if (countryCount > 8 || input.broadMarket) return "high";
  if (countryCount > 3 || targetSignalCount < 2) return "medium";
  return "low";
}

export function quoteCompanyResearch(input: {
  requestedCompanyCount: number;
  complexity?: CampaignComplexity;
  countryCount?: number;
  targetSignalCount?: number;
  broadMarket?: boolean;
}): CompanyResearchQuote {
  const requestedCompanyCount = normalizeRequestedCompanyCount(
    input.requestedCompanyCount,
  );
  const complexity = input.complexity ?? assessCampaignComplexity(input);
  const pricing = pricingByComplexity[complexity];
  return companyResearchQuoteSchema.parse({
    schemaVersion: 1,
    requestedCompanyCount,
    complexity,
    authorizedCredits: roundUp(
      pricing.baseCredits + requestedCompanyCount * pricing.perCompanyCredits,
    ),
    recommendedCompanyCount: pricing.recommendedCompanyCount,
    pricingBasis: "requested_qualified_companies",
  });
}

export function settleCompanyResearchOutcome(input: {
  authorizedCredits: number;
  accruedCredits: number;
  previouslyChargedCredits?: number;
  requestedCompanyCount: number;
  deliveredCompanyCount: number;
  completionReason: CompanyResearchCompletionReason;
}): CompanyResearchSettlement {
  const requestedCompanyCount = normalizeRequestedCompanyCount(
    input.requestedCompanyCount,
  );
  const deliveredCompanyCount = Math.max(
    0,
    Math.min(requestedCompanyCount, Math.floor(input.deliveredCompanyCount)),
  );
  const authorizedCredits = nonnegative(input.authorizedCredits, "authorization");
  const accruedCredits = nonnegative(input.accruedCredits, "accrued credits");
  const previouslyChargedCredits = nonnegative(
    input.previouslyChargedCredits ?? accruedCredits,
    "previously charged credits",
  );
  const outcomeValueCeiling =
    authorizedCredits * (0.2 + 0.8 * (deliveredCompanyCount / requestedCompanyCount));
  const chargeCeiling =
    input.completionReason === "technical_failure"
      ? 0
      : ["market_exhausted", "internal_cost_guard", "provider_failure"].includes(
            input.completionReason,
          )
        ? outcomeValueCeiling
        : authorizedCredits;
  const finalChargedCredits = roundUp(
    Math.min(accruedCredits, authorizedCredits, chargeCeiling),
  );
  return companyResearchSettlementSchema.parse({
    schemaVersion: 1,
    requestedCompanyCount,
    deliveredCompanyCount,
    completionReason: input.completionReason,
    authorizedCredits,
    accruedCredits,
    finalChargedCredits,
    releasedAuthorizationCredits: roundDown(
      Math.max(0, authorizedCredits - finalChargedCredits),
    ),
    refundableCredits: roundDown(
      Math.max(0, previouslyChargedCredits - finalChargedCredits),
    ),
    settlementPolicy: "actual_work_bounded_by_outcome_value_v1",
  });
}

/** Normalize only at the user-input boundary. Persisted values use the strict schema. */
export function normalizeRequestedCompanyCount(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_REQUESTED_COMPANY_COUNT;
  return Math.min(MAX_REQUESTED_COMPANY_COUNT, Math.max(1, Math.round(value)));
}

function nonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`Company Research ${label} must be a non-negative number.`);
  return value;
}
function roundUp(value: number) {
  return Math.ceil(value * 10) / 10;
}
function roundDown(value: number) {
  return Math.floor(value * 10) / 10;
}
