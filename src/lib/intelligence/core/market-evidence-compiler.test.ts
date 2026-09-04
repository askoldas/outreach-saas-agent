import assert from "node:assert/strict";
import test from "node:test";
import { campaignTargetModelSchema } from "./campaign-target-model.ts";
import {
  compileMarketResearchFollowUpQuestions,
  compileMarketResearchQuestions,
  marketResearchRequestHash,
  unresolvedPriorityMarketGaps,
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

test("Wave 2 follows evidence-discovered sources and local terminology", () => {
  const questions = compileMarketResearchFollowUpQuestions({
    target: fixtureTarget(),
    waveNumber: 2,
    evidence: [
      {
        id: "evidence-association",
        url: "https://horeca-association.example/member-directory",
        title: "Latvijas ēdināšanas uzņēmumu un banketu servisa katalogs",
        excerpt: "Conference venues and catering operators are members.",
        relevanceScore: 0.95,
      },
      {
        id: "evidence-venues",
        url: "https://trade.example/event-venues",
        title: "Konferenču un pasākumu norises vietas",
        excerpt: "Venues operate banquet kitchens.",
        relevanceScore: 0.9,
      },
    ],
  });
  assert.equal(questions[0]?.direction, "source_investigation");
  assert.match(questions[0]?.query ?? "", /site:horeca-association\.example/);
  assert.equal(
    questions.some(({ query }) => /Konferenču|ēdināšanas/.test(query)),
    true,
  );
  assert.equal(
    questions.every(({ derivedFromEvidenceIds }) => derivedFromEvidenceIds.length > 0),
    true,
  );
});

test("Wave 3 is generated only for an explicit unresolved priority gap", () => {
  const target = fixtureTarget();
  assert.deepEqual(
    unresolvedPriorityMarketGaps(target, [
      { title: "Restaurant groups", excerpt: "Market coverage is available." },
    ]),
    [],
  );
  const gaps = unresolvedPriorityMarketGaps(target, [
    { title: "Hotel directory", excerpt: "Independent accommodation operators." },
  ]);
  assert.deepEqual(gaps, ["Restaurant groups"]);
  assert.equal(
    compileMarketResearchFollowUpQuestions({
      target,
      waveNumber: 3,
      evidence: [],
      priorityGapKeys: gaps,
    })[0]?.direction,
    "priority_gap",
  );
  assert.deepEqual(
    compileMarketResearchFollowUpQuestions({
      target,
      waveNumber: 3,
      evidence: [],
      priorityGapKeys: [],
    }),
    [],
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
