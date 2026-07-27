import type { EntityMatchAssessment } from "./contracts.ts";

export type MergePolicyDecision = {
  permitted: boolean;
  reason: string;
};

export function evaluateAutomaticMerge(
  assessment: EntityMatchAssessment,
): MergePolicyDecision {
  if (assessment.contradictionSeverity !== "none") {
    return { permitted: false, reason: "Identity evidence contains a contradiction." };
  }
  const keys = new Set(
    assessment.signals
      .filter((signal) => signal.state === "match")
      .map((signal) => signal.key),
  );
  const exactIdentity =
    keys.has("verified_legal_identifier") ||
    keys.has("canonical_domain") ||
    keys.has("canonical_url");
  return exactIdentity && assessment.aggregateConfidence >= 0.98
    ? { permitted: true, reason: "A deterministic exact identity signal is present." }
    : {
        permitted: false,
        reason:
          "Only deterministic exact identity signals may trigger an automatic merge.",
      };
}
