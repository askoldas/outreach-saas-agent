import { createHash } from "node:crypto";
import type { CandidateClaimInput, CandidateIntelligenceSnapshot } from "./contracts.ts";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function compileCandidateIntelligenceSnapshot(input: {
  organizationId: string;
  versionNumber: number;
  sourceCutoffAt: string;
  claims: CandidateClaimInput[];
  unresolvedQuestionKeys: string[];
  conflictKeys: string[];
}): { snapshot: CandidateIntelligenceSnapshot; contentHash: string } {
  const snapshot: CandidateIntelligenceSnapshot = {
    organizationId: input.organizationId,
    versionNumber: input.versionNumber,
    sourceCutoffAt: input.sourceCutoffAt,
    claims: [...input.claims].sort(
      (left, right) =>
        left.fieldPath.localeCompare(right.fieldPath) ||
        left.statement.localeCompare(right.statement),
    ),
    unresolvedQuestionKeys: [...new Set(input.unresolvedQuestionKeys)].sort(),
    conflictKeys: [...new Set(input.conflictKeys)].sort(),
  };
  return {
    snapshot,
    contentHash: createHash("sha256")
      .update(JSON.stringify(stableValue(snapshot)))
      .digest("hex"),
  };
}
