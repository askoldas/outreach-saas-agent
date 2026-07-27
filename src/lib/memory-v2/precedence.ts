import type { IntelligenceMemory } from "../intelligence/contracts/memory.ts";

const scopePriority: Record<IntelligenceMemory["scope"], number> = {
  run: 700,
  campaign: 600,
  candidate: 500,
  offering: 400,
  workspace: 300,
  user: 200,
};

export function memoryPrecedence(memory: IntelligenceMemory) {
  const authority =
    memory.source === "user"
      ? 10_000
      : memory.status === "confirmed"
        ? 5_000
        : memory.status === "provisional"
          ? 1_000
          : 0;
  const specificity = applicabilitySpecificity(memory);
  const hard = memory.strength === "hard" ? 100 : 0;
  return authority + scopePriority[memory.scope] + specificity + hard + memory.confidence;
}

export function compareMemoryPrecedence(
  left: IntelligenceMemory,
  right: IntelligenceMemory,
) {
  return (
    memoryPrecedence(right) - memoryPrecedence(left) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function memoryConflictKey(memory: IntelligenceMemory) {
  const applicability = memory.applicability;
  return [
    memory.kind,
    applicability?.objectiveCodes?.join(",") ?? "*",
    applicability?.offeringIds?.join(",") ?? "*",
    applicability?.geographyCodes?.join(",") ?? "*",
    applicability?.archetypeIds?.join(",") ?? "*",
    applicability?.candidateIds?.join(",") ?? "*",
    applicability?.relationshipTypes?.join(",") ?? "*",
    applicability?.qualificationFactorKeys?.join(",") ?? "*",
  ].join("|");
}

function applicabilitySpecificity(memory: IntelligenceMemory) {
  const applicability = memory.applicability;
  if (!applicability) return 0;
  return Object.values(applicability).reduce(
    (count, values) => count + (values?.length ? 1 : 0),
    0,
  );
}
