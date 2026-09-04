import assert from "node:assert/strict";
import test from "node:test";
import { campaignTargetModelSchema } from "./campaign-target-model.ts";
import {
  compileMarketResearchQuestions,
  marketResearchRequestHash,
} from "./market-evidence-compiler.ts";

test("market reconnaissance asks bounded questions beyond initial archetypes", () => {
  const target = fixtureTarget();
  const questions = compileMarketResearchQuestions(target);
  assert.deepEqual(
    questions.map(({ purpose }) => purpose),
    ["buyer_landscape", "market_structure", "scale_and_timing"],
  );
  assert.match(questions[0]!.query, /adjacent sectors beyond/i);
  assert.match(questions[0]!.query, /Latvia/);
  assert.ok(questions.every(({ query }) => query.length <= 500));
  assert.equal(
    marketResearchRequestHash({ target, questions }),
    marketResearchRequestHash({ target, questions }),
  );
});

function fixtureTarget() {
  return campaignTargetModelSchema.parse({
    id: "target-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    profileSnapshotId: "profile-1",
    commercialIntelligenceVersionId: "commercial-1",
    offeringIds: ["offering-1"],
    objective: {
      code: "direct_buyer",
      description: "Find direct buyers for professional food-service equipment.",
      desiredRelationships: ["buyer"],
    },
    geography: {
      displayName: "Latvia",
      countryCodes: ["LV"],
      regions: [],
      cities: [],
      localLanguages: ["Latvian"],
      workingLanguages: ["English"],
    },
    archetypes: [
      {
        id: "restaurant",
        label: "Restaurant groups",
        organizationType: "Restaurant operator",
        businessModel: ["multi-site"],
        priority: "priority",
        whyItCanBuyOrUse: "Operates professional kitchens.",
        operationalEvidenceOfNeed: ["Operates kitchens"],
        likelyRelationships: ["buyer"],
        confidence: 0.8,
      },
    ],
    confidence: 0.8,
    version: {
      schemaVersion: "target/v1",
      compilerVersion: "target/v1",
      inputHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      createdAt: "2026-09-04T00:00:00.000Z",
    },
  });
}
