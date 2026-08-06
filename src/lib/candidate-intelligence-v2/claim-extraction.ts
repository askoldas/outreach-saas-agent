import type { CandidateClaimInput } from "./contracts.ts";

export type ExtractedObservation = {
  key: string;
  fieldPath: string;
  statement: string;
  value?: unknown;
  directness: "direct" | "indirect" | "reported" | "unknown";
  confidence: number;
  evidenceIds: string[];
  freshnessClass: CandidateClaimInput["freshnessClass"];
  sourceScope: CandidateClaimInput["sourceScope"];
};

export function compileCandidateClaims(
  observations: ExtractedObservation[],
): CandidateClaimInput[] {
  const claims = new Map<string, CandidateClaimInput>();
  for (const observation of observations) {
    const key = `${observation.key}:${JSON.stringify(observation.value ?? null)}`;
    const status =
      observation.value === undefined
        ? "unknown"
        : observation.directness === "direct" && observation.confidence >= 0.8
          ? "confirmed_fact"
          : observation.directness === "unknown"
            ? "hypothesis"
            : "evidence_backed_inference";
    const claim: CandidateClaimInput = {
      key: observation.key,
      fieldPath: observation.fieldPath,
      statement: observation.statement,
      value: observation.value ?? null,
      status,
      confidence: observation.value === undefined ? 0 : observation.confidence,
      evidenceIds: [...new Set(observation.evidenceIds)].sort(),
      freshnessClass: observation.freshnessClass,
      sourceScope: observation.sourceScope,
    };
    const existing = claims.get(key);
    if (!existing) claims.set(key, claim);
    else if (claim.confidence > existing.confidence) {
      claim.evidenceIds = [
        ...new Set([...existing.evidenceIds, ...claim.evidenceIds]),
      ].sort();
      claims.set(key, claim);
    } else {
      existing.evidenceIds = [
        ...new Set([...existing.evidenceIds, ...claim.evidenceIds]),
      ].sort();
    }
  }
  return [...claims.values()].sort(
    (left, right) =>
      left.fieldPath.localeCompare(right.fieldPath) ||
      left.statement.localeCompare(right.statement),
  );
}
