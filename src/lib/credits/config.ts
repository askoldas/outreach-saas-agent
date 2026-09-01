const DEFAULT_COST_PER_CREDIT_USD = 0.01;
export const DEFAULT_RESEARCH_CREDIT_CAP = 30;
export const DEFAULT_CONTACT_ENRICHMENT_CREDIT_CAP = 2;
const DEFAULT_TAVILY_PROVIDER_CREDIT_COST_USD = 0.008;

type CreditEnvironment = Record<string, string | undefined>;

export function getCreditEconomics(env: CreditEnvironment = process.env) {
  return Object.freeze({
    costPerCreditUsd: positiveNumber(
      env.OPPTIUM_COST_PER_CREDIT_USD,
      DEFAULT_COST_PER_CREDIT_USD,
      "OPPTIUM_COST_PER_CREDIT_USD",
    ),
    defaultResearchCreditCap: positiveNumber(
      env.OPPTIUM_DEFAULT_RESEARCH_CREDIT_CAP,
      DEFAULT_RESEARCH_CREDIT_CAP,
      "OPPTIUM_DEFAULT_RESEARCH_CREDIT_CAP",
    ),
    tavilyProviderCreditCostUsd: positiveNumber(
      env.TAVILY_PROVIDER_CREDIT_COST_USD,
      DEFAULT_TAVILY_PROVIDER_CREDIT_COST_USD,
      "TAVILY_PROVIDER_CREDIT_COST_USD",
    ),
  });
}

export function costUsdToCredits(costUsd: number, env?: CreditEnvironment) {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error("Billable provider cost must be a non-negative number.");
  }
  return costUsd / getCreditEconomics(env).costPerCreditUsd;
}

function positiveNumber(raw: string | undefined, fallback: number, name: string) {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
}
