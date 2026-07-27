import assert from "node:assert/strict";
import test from "node:test";
import { compileCandidateClaims } from "./claim-extraction.ts";
import { createFirstPartyFetchRequest } from "./first-party-fetch.ts";
import { classifyFreshness, shouldReuseEvidence } from "./freshness.ts";
import { compileCandidateResearchPlan } from "./research-plan.ts";
import { compileCandidateIntelligenceSnapshot } from "./snapshot.ts";

test("research plans omit resolved questions and prioritize conflicts and stale facts", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    requiredQuestionKeys: ["business_model", "products_services"],
    optionalQuestionKeys: ["operating_markets"],
    resolvedQuestionKeys: ["products_services"],
    staleQuestionKeys: ["operating_markets"],
    conflictQuestionKeys: ["ownership_structure"],
    procurementUnknown: true,
    pageBudget: 5,
  });
  assert.deepEqual(
    plan.questions.map((question) => question.key),
    [
      "ownership_structure",
      "operating_markets",
      "business_model",
      "procurement_authority",
    ],
  );
  assert.equal(plan.preferredPages.length <= 5, true);
  assert.equal(plan.stopPolicy.stopWhenRequiredQuestionsResolved, true);
});

test("campaign context remains separate from reusable research", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["campaign_offering_relationship"],
  });
  assert.equal(plan.researchType, "campaign_specific");
  assert.equal(plan.questions[0]?.reusableScope, "campaign_only");
});

test("freshness windows vary by claim volatility", () => {
  const now = new Date("2026-07-27T00:00:00.000Z");
  assert.equal(classifyFreshness("stable", "2025-01-01T00:00:00.000Z", now), "current");
  assert.equal(classifyFreshness("volatile", "2026-06-01T00:00:00.000Z", now), "stale");
  assert.equal(classifyFreshness("dynamic", undefined, now), "unknown");
});

test("only available sufficiently fresh evidence is reusable", () => {
  const now = new Date("2026-07-27T00:00:00.000Z");
  assert.equal(
    shouldReuseEvidence({
      freshnessClass: "slow_changing",
      observedAt: "2026-01-01T00:00:00.000Z",
      minimumState: "acceptable",
      accessStatus: "available",
      now,
    }),
    true,
  );
  assert.equal(
    shouldReuseEvidence({
      freshnessClass: "stable",
      observedAt: "2026-07-01T00:00:00.000Z",
      minimumState: "acceptable",
      accessStatus: "partial",
      now,
    }),
    false,
  );
});

test("claim compilation distinguishes facts, inference, hypotheses, and unknowns", () => {
  const claims = compileCandidateClaims([
    {
      key: "business_model",
      fieldPath: "commercial.businessModel",
      statement: "The official site describes wholesale distribution.",
      value: "wholesale_distribution",
      directness: "direct",
      confidence: 0.95,
      evidenceIds: ["evidence-1"],
      freshnessClass: "slow_changing",
      sourceScope: "system_public",
    },
    {
      key: "procurement",
      fieldPath: "commercial.procurement",
      statement: "Procurement authority is not stated.",
      directness: "unknown",
      confidence: 0.4,
      evidenceIds: ["evidence-2"],
      freshnessClass: "dynamic",
      sourceScope: "system_public",
    },
  ]);
  assert.equal(claims[0]?.status, "confirmed_fact");
  assert.equal(claims[1]?.status, "unknown");
  assert.equal(claims[1]?.confidence, 0);
});

test("duplicate observations retain independent corroborating evidence", () => {
  const base = {
    key: "markets",
    fieldPath: "operations.markets",
    statement: "The company operates in Lithuania.",
    value: ["LT"],
    directness: "direct" as const,
    freshnessClass: "dynamic" as const,
    sourceScope: "system_public" as const,
  };
  const claims = compileCandidateClaims([
    { ...base, confidence: 0.9, evidenceIds: ["evidence-1"] },
    { ...base, confidence: 0.8, evidenceIds: ["evidence-2"] },
  ]);
  assert.deepEqual(claims[0]?.evidenceIds, ["evidence-1", "evidence-2"]);
});

test("first-party fetches stay on the canonical domain and remain bounded", () => {
  const request = createFirstPartyFetchRequest({
    organizationId: "organization-1",
    url: "https://careers.example.com/jobs#open",
    expectedDomain: "example.com",
    pageKind: "careers",
    questionKeys: ["procurement", "procurement"],
  });
  assert.equal(request.canonicalUrl, "https://careers.example.com/jobs");
  assert.deepEqual(request.questionKeys, ["procurement"]);
  assert.throws(
    () =>
      createFirstPartyFetchRequest({
        organizationId: "organization-1",
        url: "https://directory.example.net/company",
        expectedDomain: "example.com",
        pageKind: "about",
        questionKeys: ["identity"],
      }),
    /outside the canonical domain/,
  );
});

test("intelligence snapshots are deterministic and retain unresolved state", () => {
  const input = {
    organizationId: "organization-1",
    versionNumber: 1,
    sourceCutoffAt: "2026-07-27T00:00:00.000Z",
    claims: [],
    unresolvedQuestionKeys: ["procurement", "business_model", "procurement"],
    conflictKeys: ["ownership"],
  };
  const first = compileCandidateIntelligenceSnapshot(input);
  const second = compileCandidateIntelligenceSnapshot(input);
  assert.equal(first.contentHash, second.contentHash);
  assert.deepEqual(first.snapshot.unresolvedQuestionKeys, [
    "business_model",
    "procurement",
  ]);
  assert.equal(first.contentHash.length, 64);
});
