import type { ModelRole } from "./model-roles.ts";

export const initialModelDefaults: Readonly<Record<ModelRole, string>> = {
  campaign_planning: "anthropic/claude-sonnet-4.6",
  profile_analysis: "anthropic/claude-sonnet-4.6",
  company_qualification: "anthropic/claude-sonnet-4.6",
  outreach_generation: "anthropic/claude-sonnet-4.6",
  campaign_reflection: "anthropic/claude-sonnet-4.6",
  website_extraction: "openai/gpt-5-mini",
  search_result_classification: "openai/gpt-5-mini",
  guided_interpretation: "openai/gpt-5-mini",
  low_risk_transformation: "openai/gpt-5-mini",
};

export const modelEnvironmentVariables: Readonly<Record<ModelRole, string>> = {
  campaign_planning: "OPENROUTER_MODEL_CAMPAIGN_PLANNING",
  profile_analysis: "OPENROUTER_MODEL_PROFILE_ANALYSIS",
  company_qualification: "OPENROUTER_MODEL_COMPANY_QUALIFICATION",
  outreach_generation: "OPENROUTER_MODEL_OUTREACH_GENERATION",
  campaign_reflection: "OPENROUTER_MODEL_CAMPAIGN_REFLECTION",
  website_extraction: "OPENROUTER_MODEL_WEBSITE_EXTRACTION",
  search_result_classification: "OPENROUTER_MODEL_SEARCH_RESULT_CLASSIFICATION",
  guided_interpretation: "OPENROUTER_MODEL_GUIDED_INTERPRETATION",
  low_risk_transformation: "OPENROUTER_MODEL_LOW_RISK_TRANSFORMATION",
};

export const criticalFallbackEnvironmentVariable = "OPENROUTER_FALLBACK_MODEL_CRITICAL";
export const initialCriticalFallback = "openai/gpt-5-mini";

export function isFreeModel(model: string) {
  return model.trim().toLowerCase().endsWith(":free");
}
