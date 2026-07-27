import assert from "node:assert/strict";
import test from "node:test";
import type { IntelligenceMemory } from "../intelligence/contracts/memory.ts";
import { resolveApplicableMemories } from "./retrieval.ts";
import { shouldProposeMemoryPromotion } from "./promotion.ts";

const now = "2026-07-27T12:00:00.000Z";
const context = {
  workspaceId: "workspace-1",
  userId: "user-1",
  offeringIds: ["offering-1"],
  campaignId: "campaign-1",
  geographyCodes: ["LT"],
  archetypeIds: ["hospital"],
  relationshipTypes: ["buyer"],
  qualificationFactorKeys: ["need"],
  objectiveCode: "new_logo",
  now,
};

function memory(
  id: string,
  overrides: Partial<IntelligenceMemory> = {},
): IntelligenceMemory {
  return {
    id,
    workspaceId: "workspace-1",
    scope: "workspace",
    scopeId: "workspace-1",
    kind: "correction",
    statement: `Statement ${id}`,
    applicability: {},
    applicabilityStatus: "known",
    strength: "soft",
    status: "confirmed",
    source: "system",
    confidence: 0.8,
    evidenceIds: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

test("retrieval records deterministic applicability exclusions", () => {
  const result = resolveApplicableMemories(
    [
      memory("applicable"),
      memory("unknown", { applicabilityStatus: "unknown" }),
      memory("wrong-geography", {
        applicability: { geographyCodes: ["EE"] },
      }),
      memory("expired", { expiresAt: "2026-07-26T00:00:00.000Z" }),
      memory("superseded", { status: "superseded" }),
      memory("proposed", { status: "proposed" }),
    ],
    context,
  );

  assert.deepEqual(
    result.applied.map(({ id }) => id),
    ["applicable"],
  );
  assert.deepEqual(
    Object.fromEntries(result.excluded.map(({ memoryId, reason }) => [memoryId, reason])),
    {
      expired: "expired",
      proposed: "unconfirmed",
      superseded: "superseded",
      unknown: "unknown_applicability",
      "wrong-geography": "wrong_geography",
    },
  );
});

test("explicit user and more-specific memories win independently of input order", () => {
  const broad = memory("broad", {
    source: "ai",
    createdAt: "2026-07-26T00:00:00.000Z",
  });
  const specific = memory("specific", {
    source: "user",
    scope: "campaign",
    scopeId: "campaign-1",
    strength: "hard",
    createdAt: "2026-07-01T00:00:00.000Z",
  });

  for (const values of [
    [broad, specific],
    [specific, broad],
  ]) {
    const result = resolveApplicableMemories(values, context);
    assert.deepEqual(
      result.applied.map(({ id }) => id),
      ["specific"],
    );
    assert.deepEqual(
      result.overridden.map(({ id }) => id),
      ["broad"],
    );
  }
});

test("promotion is proposed only for confirmed campaign corrections", () => {
  const correction = memory("correction", {
    scope: "campaign",
    scopeId: "campaign-1",
    source: "user",
  });

  assert.equal(
    shouldProposeMemoryPromotion({
      memory: correction,
      matchingConfirmedCorrectionCount: 2,
      explicitlyRequested: false,
    }),
    false,
  );
  assert.equal(
    shouldProposeMemoryPromotion({
      memory: correction,
      matchingConfirmedCorrectionCount: 3,
      explicitlyRequested: false,
    }),
    true,
  );
  assert.equal(
    shouldProposeMemoryPromotion({
      memory: { ...correction, status: "provisional" },
      matchingConfirmedCorrectionCount: 3,
      explicitlyRequested: true,
    }),
    false,
  );
});
