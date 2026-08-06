import {
  intelligenceMemorySchema,
  type IntelligenceMemory,
} from "../intelligence/contracts/memory.ts";
import { memoryExclusionReason } from "./applicability.ts";
import { compareMemoryPrecedence, memoryConflictKey } from "./precedence.ts";
import {
  memoryRetrievalContextSchema,
  resolvedMemorySetSchema,
  type MemoryRetrievalContext,
  type ResolvedMemorySet,
} from "./contracts.ts";

export function resolveApplicableMemories(
  values: unknown[],
  rawContext: MemoryRetrievalContext,
): ResolvedMemorySet {
  const context = memoryRetrievalContextSchema.parse(rawContext);
  const memories = values.map((value) => intelligenceMemorySchema.parse(value));
  const excluded: ResolvedMemorySet["excluded"] = [];
  const eligible: IntelligenceMemory[] = [];
  for (const memory of memories) {
    const reason = memoryExclusionReason(memory, context);
    if (reason) excluded.push({ memoryId: memory.id, reason });
    else eligible.push(memory);
  }
  const groups = new Map<string, IntelligenceMemory[]>();
  for (const memory of eligible) {
    const key = memoryConflictKey(memory);
    groups.set(key, [...(groups.get(key) ?? []), memory]);
  }
  const applied: IntelligenceMemory[] = [];
  const overridden: IntelligenceMemory[] = [];
  const conflicts: ResolvedMemorySet["conflicts"] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(compareMemoryPrecedence);
    const winner = ordered[0];
    if (!winner) continue;
    applied.push(winner);
    for (const memory of ordered.slice(1)) {
      overridden.push(memory);
      conflicts.push({
        winnerId: winner.id,
        overriddenId: memory.id,
        reason: "A higher-authority or more-specific applicable memory takes precedence.",
      });
    }
  }
  return resolvedMemorySetSchema.parse({
    applied: applied.sort(compareMemoryPrecedence),
    overridden: overridden.sort(compareMemoryPrecedence),
    excluded: excluded.sort((left, right) => left.memoryId.localeCompare(right.memoryId)),
    conflicts,
  });
}
