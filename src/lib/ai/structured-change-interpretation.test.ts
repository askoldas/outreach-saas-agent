import assert from "node:assert/strict";
import test from "node:test";
import {
  inferUserModificationIntents,
  parseStructuredChanges,
} from "./structured-change-interpretation.ts";

const parseEntity = (value: unknown) => {
  if (!value || typeof value !== "object") throw new Error("Invalid test entity.");
  return value as { id: string; name: string };
};

test("also/add language is interpreted as additive intent", () => {
  assert.deepEqual(
    inferUserModificationIntents(
      "We also repair game consoles and offer pickup for business clients.",
    ),
    ["add"],
  );
});

test("additive changes preserve existing confirmed items", () => {
  const parsed = parseStructuredChanges(
    {
      detectedIntents: ["add"],
      summary: "Add game-console repair and keep existing services.",
      changes: [
        {
          operation: "add",
          proposedValue: { id: "console_repair", name: "Game-console repair" },
          reason: "The user explicitly added this service.",
          confidence: "high",
        },
        {
          operation: "keep",
          entityId: "smartphone_repair",
          reason: "No replacement was requested.",
          confidence: "high",
        },
      ],
      keptEntityIds: ["smartphone_repair", "laptop_repair", "tablet_repair"],
      requiresConfirmation: true,
    },
    parseEntity,
  );
  assert.equal(parsed.changeSet.changes[0]?.operation, "add");
  assert.deepEqual(parsed.keptEntityIds, [
    "smartphone_repair",
    "laptop_repair",
    "tablet_repair",
  ]);
  assert.equal(parsed.changeSet.requiresConfirmation, true);
});

test("replacement remains explicit and requires confirmation", () => {
  const parsed = parseStructuredChanges(
    {
      detectedIntents: ["replace"],
      summary: "Replace all targets with medical-device manufacturers.",
      changes: [
        {
          operation: "remove",
          entityId: "industrial_manufacturers",
          reason: "Explicit replacement requested.",
          confidence: "high",
        },
        {
          operation: "remove",
          entityId: "packaging_companies",
          reason: "Explicit replacement requested.",
          confidence: "high",
        },
        {
          operation: "add",
          proposedValue: {
            id: "medical_device_manufacturers",
            name: "Medical-device manufacturers",
          },
          reason: "Explicit replacement target.",
          confidence: "high",
        },
      ],
      keptEntityIds: [],
      requiresConfirmation: true,
    },
    parseEntity,
  );
  assert.ok(parsed.detectedIntents.includes("replace"));
  assert.equal(parsed.changeSet.requiresConfirmation, true);
});
