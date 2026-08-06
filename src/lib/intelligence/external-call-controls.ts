export type IntelligenceExternalCallKind = "model" | "provider";

export function intelligenceExternalCallsAllowed(
  kind: IntelligenceExternalCallKind,
  environment: Record<string, string | undefined> = process.env,
) {
  const name =
    kind === "model"
      ? "INTELLIGENCE_V2_MODEL_CALLS_ENABLED"
      : "INTELLIGENCE_V2_PROVIDER_CALLS_ENABLED";
  const value = environment[name];
  if (value === undefined || !value.trim()) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

export function assertIntelligenceExternalCallsAllowed(
  kind: IntelligenceExternalCallKind,
  environment?: Record<string, string | undefined>,
) {
  if (!intelligenceExternalCallsAllowed(kind, environment)) {
    throw new Error(
      kind === "model"
        ? "Intelligence V2 model calls are disabled by the operator kill switch."
        : "Intelligence V2 provider calls are disabled by the operator kill switch.",
    );
  }
}
