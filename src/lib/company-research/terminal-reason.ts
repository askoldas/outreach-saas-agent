import type { AdaptiveResearchAction } from "@/lib/adaptive-research-v2/contracts";
import type { CompanyResearchCompletionReason } from "./outcome";

export function completionReasonForAdaptiveAction(
  action: AdaptiveResearchAction,
): CompanyResearchCompletionReason | null {
  if (action === "stop_target_reached") return "target_reached";
  if (action === "stop_budget") return "internal_cost_guard";
  if (
    action === "stop_saturation" ||
    action === "stop_low_yield" ||
    action === "stop_no_actionable_work"
  )
    return "market_exhausted";
  if (action === "cancel") return "user_stopped";
  return null;
}

export function completionReasonForWorkflowError(
  error: unknown,
): "provider_failure" | "technical_failure" | "user_stopped" {
  const message = error instanceof Error ? error.message : String(error);
  const code = property(error, "code");
  if (/cancel/i.test(code) || /cancelled by user|user cancelled/i.test(message)) {
    return "user_stopped";
  }
  if (
    /provider|rate.?limit|status 429|status 5\d\d|network|fetch failed|timed? ?out|econnreset|socket hang up/i.test(
      `${code} ${message}`,
    )
  ) {
    return "provider_failure";
  }
  return "technical_failure";
}

function property(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const result = (value as Record<string, unknown>)[key];
  return typeof result === "string" ? result : "";
}
