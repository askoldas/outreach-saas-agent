import type { IntelligenceMemory } from "../intelligence/contracts/memory.ts";

export const repeatedCorrectionPromotionThreshold = 3;

export function shouldProposeMemoryPromotion(input: {
  memory: IntelligenceMemory;
  matchingConfirmedCorrectionCount: number;
  explicitlyRequested: boolean;
}) {
  if (input.memory.scope !== "campaign" || input.memory.kind !== "correction")
    return false;
  if (input.memory.status !== "confirmed") return false;
  return (
    input.explicitlyRequested ||
    input.matchingConfirmedCorrectionCount >= repeatedCorrectionPromotionThreshold
  );
}
