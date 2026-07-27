import type { IntelligenceMemory } from "../intelligence/contracts/memory.ts";
import type { ExcludedMemory, MemoryRetrievalContext } from "./types.ts";

export function memoryExclusionReason(
  memory: IntelligenceMemory,
  context: MemoryRetrievalContext,
): ExcludedMemory["reason"] | null {
  if (memory.status === "superseded") return "superseded";
  if (
    memory.status === "expired" ||
    (memory.expiresAt && memory.expiresAt <= context.now)
  )
    return "expired";
  if (!["confirmed", "provisional"].includes(memory.status)) return "unconfirmed";
  if (memory.applicabilityStatus === "unknown") return "unknown_applicability";
  if (!scopeMatches(memory, context)) return "wrong_scope";
  const applicability = memory.applicability;
  if (!applicability) return null;
  if (!matches(applicability.objectiveCodes, context.objectiveCode))
    return "wrong_objective";
  if (!matchesAny(applicability.offeringIds, context.offeringIds))
    return "wrong_offering";
  if (!matchesAny(applicability.geographyCodes, context.geographyCodes))
    return "wrong_geography";
  if (!matchesAny(applicability.archetypeIds, context.archetypeIds))
    return "wrong_archetype";
  if (!matches(applicability.candidateIds, context.candidateId)) return "wrong_candidate";
  if (!matchesAny(applicability.relationshipTypes, context.relationshipTypes))
    return "wrong_relationship";
  if (!matchesAny(applicability.qualificationFactorKeys, context.qualificationFactorKeys))
    return "wrong_factor";
  return null;
}

function scopeMatches(memory: IntelligenceMemory, context: MemoryRetrievalContext) {
  if (memory.workspaceId !== context.workspaceId) return false;
  const expected: Partial<Record<IntelligenceMemory["scope"], string | undefined>> = {
    user: context.userId,
    workspace: context.workspaceId,
    offering: context.offeringIds.includes(memory.scopeId) ? memory.scopeId : undefined,
    campaign: context.campaignId,
    candidate: context.candidateId,
    run: context.runId,
  };
  return expected[memory.scope] === memory.scopeId;
}

function matches(values: string[] | undefined, selected: string | undefined) {
  return !values?.length || (selected !== undefined && values.includes(selected));
}

function matchesAny(values: string[] | undefined, selected: string[]) {
  return !values?.length || values.some((value) => selected.includes(value));
}
