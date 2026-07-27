import { AbortTaskRunError } from "@trigger.dev/sdk";

export type WorkflowErrorCategory =
  | "retryable_provider"
  | "retryable_network"
  | "rate_limit"
  | "invalid_provider_response"
  | "validation"
  | "configuration"
  | "authorization"
  | "application"
  | "cancellation";

export type ClassifiedWorkflowError = {
  category: WorkflowErrorCategory;
  message: string;
  retryable: boolean;
};

export function classifyWorkflowError(error: unknown): ClassifiedWorkflowError {
  const message = error instanceof Error ? error.message : "Workflow operation failed.";
  const code = stringProperty(error, "code");
  const explicitlyRetryable = booleanProperty(error, "retryable");
  const preservedCategory = categoryFromMessage(message);
  if (preservedCategory)
    return {
      category: preservedCategory,
      message,
      retryable: isRetryableCategory(preservedCategory),
    };

  if (/cancel|abort/i.test(code) || /cancelled by user/i.test(message))
    return { category: "cancellation", message, retryable: false };
  if (code === "rate_limited" || /rate.?limit|status 429/i.test(message))
    return { category: "rate_limit", message, retryable: true };
  if (
    code === "timeout" ||
    code === "transport_error" ||
    /timed? ?out|network|fetch failed|econnreset|socket hang up/i.test(message)
  )
    return { category: "retryable_network", message, retryable: true };
  if (
    explicitlyRetryable ||
    code === "provider_unavailable" ||
    /status 5\d\d|temporarily unavailable/i.test(message)
  )
    return { category: "retryable_provider", message, retryable: true };
  if (
    code === "invalid_provider_response" ||
    code === "empty_response" ||
    code === "empty_completion" ||
    code === "completion_truncated"
  )
    return { category: "invalid_provider_response", message, retryable: false };
  if (/forbidden|unauthorized|permission denied|status 401|status 403/i.test(message))
    return { category: "authorization", message, retryable: false };
  if (/environment variable|configuration|must contain a pinned|api key/i.test(message))
    return { category: "configuration", message, retryable: false };
  if (/invalid|validation|missing|required|outside its allowed range/i.test(message))
    return { category: "validation", message, retryable: false };
  return { category: "application", message, retryable: false };
}

export function errorForTrigger(error: unknown) {
  const classified = classifyWorkflowError(error);
  if (classified.retryable)
    return error instanceof Error ? error : new Error(classified.message);
  return new AbortTaskRunError(`[${classified.category}] ${classified.message}`);
}

function stringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : "";
}

function booleanProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return false;
  return (value as Record<string, unknown>)[key] === true;
}

function categoryFromMessage(message: string) {
  const match = message.match(/^\[([a-z_]+)\]/);
  const category = match?.[1];
  return category && isWorkflowErrorCategory(category) ? category : null;
}

function isWorkflowErrorCategory(value: string): value is WorkflowErrorCategory {
  return [
    "retryable_provider",
    "retryable_network",
    "rate_limit",
    "invalid_provider_response",
    "validation",
    "configuration",
    "authorization",
    "application",
    "cancellation",
  ].includes(value);
}

function isRetryableCategory(category: WorkflowErrorCategory) {
  return ["retryable_provider", "retryable_network", "rate_limit"].includes(category);
}
