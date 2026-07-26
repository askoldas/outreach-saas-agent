import {
  criticalFallbackEnvironmentVariable,
  initialCriticalFallback,
  initialModelDefaults,
  isFreeModel,
  modelEnvironmentVariables,
} from "./model-registry.ts";
import type { ModelRole } from "./model-roles.ts";

export interface ModelRoute {
  role: ModelRole;
  primaryModel: string;
  fallbackModels: string[];
  timeoutMs: number;
  allowFallback: boolean;
}

const criticalRoles = new Set<ModelRole>([
  "campaign_planning",
  "profile_analysis",
  "company_qualification",
  "outreach_generation",
  "campaign_reflection",
]);

export function getModelRoute(role: ModelRole): ModelRoute {
  const routingEnabled = booleanEnvironment("OPENROUTER_MODEL_ROUTING_ENABLED", true);
  if (!routingEnabled)
    throw new Error(
      "Task-specific OpenRouter routing is disabled. Set OPENROUTER_MODEL_ROUTING_ENABLED=true.",
    );

  const environmentName = modelEnvironmentVariables[role];
  const primaryModel = process.env[environmentName]?.trim() || initialModelDefaults[role];
  assertPaidPinnedModel(primaryModel, environmentName);

  const allowFallback = booleanEnvironment("OPENROUTER_ALLOW_FALLBACKS", true);
  const fallback = (
    process.env[criticalFallbackEnvironmentVariable]?.trim() || initialCriticalFallback
  ).trim();
  if (allowFallback) assertPaidPinnedModel(fallback, criticalFallbackEnvironmentVariable);

  return {
    role,
    primaryModel,
    fallbackModels:
      allowFallback && criticalRoles.has(role) && fallback !== primaryModel
        ? [fallback]
        : [],
    timeoutMs: timeoutEnvironment(),
    allowFallback,
  };
}

function assertPaidPinnedModel(model: string, variable: string) {
  if (!model || !model.includes("/"))
    throw new Error(`${variable} must contain a pinned provider/model ID.`);
  if (isFreeModel(model))
    throw new Error(`${variable} must not use a :free production model.`);
  if (/(^|\/)(latest|auto)$/i.test(model))
    throw new Error(`${variable} must not use a moving latest/auto alias.`);
}

function booleanEnvironment(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function timeoutEnvironment() {
  const value = process.env.OPENROUTER_REQUEST_TIMEOUT_MS;
  if (!value) return 120_000;
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout < 5_000)
    throw new Error("OPENROUTER_REQUEST_TIMEOUT_MS must be at least 5000.");
  return Math.floor(timeout);
}
