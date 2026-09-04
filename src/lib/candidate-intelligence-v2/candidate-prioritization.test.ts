import assert from "node:assert/strict";
import test from "node:test";
import { prioritizeResearchCandidate } from "./candidate-prioritization.ts";
import type { CampaignResearchCandidateInput } from "./research-runtime.ts";

const base: CampaignResearchCandidateInput = {
  campaignCandidateId: "candidate-1",
  organizationId: "organization-1",
  organizationName: "Example",
  organizationType: "operating_company",
  canonicalDomain: "example.com",
  canonicalUrl: "https://example.com/",
  procurementAutonomy: "unknown",
  matchedArchetypeIds: ["archetype-1"],
  discoverySourceIds: ["source-1", "source-2"],
  currentIntelligenceVersionId: null,
  unresolvedQuestionKeys: [],
  conflictKeys: [],
  claimStates: [],
};

test("commercial opportunity outranks excellent researchability", () => {
  const strong = prioritizeResearchCandidate(
    {
      ...base,
      canonicalDomain: null,
      canonicalUrl: null,
      discoverySourceIds: ["source-1"],
      claimStates: [
        {
          key: "scale.locations",
          epistemicStatus: "explicit_fact",
          freshnessState: "current",
          reusableStatus: "active",
          reusableScope: "organization",
        },
        {
          key: "timing.expansion",
          epistemicStatus: "explicit_fact",
          freshnessState: "current",
          reusableStatus: "active",
          reusableScope: "campaign_only",
        },
      ],
    },
    { matchedLanePriorities: ["priority"], positiveSignalCount: 2 },
  );
  const weak = prioritizeResearchCandidate(
    {
      ...base,
      matchedArchetypeIds: ["archetype-1"],
    },
    { matchedLanePriorities: ["exploratory"] },
  );
  assert.ok(strong.score > weak.score);
  assert.ok(strong.researchability.score < weak.researchability.score);
});

test("known customers are suppressed before expensive research", () => {
  const result = prioritizeResearchCandidate({
    ...base,
    claimStates: [
      {
        key: "relationship.existing_customer",
        epistemicStatus: "explicit_fact",
        freshnessState: "current",
        reusableStatus: "active",
        reusableScope: "organization",
      },
    ],
  });
  assert.equal(result.lane, "suppress");
  assert.equal(result.suppressedReason, "existing_customer");
  assert.equal(result.score, 0);
});

test("cheap discovery evidence raises potential and timing without rewarding website quality", () => {
  const result = prioritizeResearchCandidate(
    {
      ...base,
      canonicalDomain: null,
      canonicalUrl: null,
      triageEvidence: {
        employeeCount: 280,
        industries: ["Hospitality"],
        keywords: ["new banquet wing"],
        matchedSignals: ["conference capacity expansion"],
        preliminaryQuality: [
          {
            likelyOperatingOrganization: true,
            likelyTargetGeography: true,
            confidence: 0.91,
          },
        ],
      },
    },
    {
      matchedLanePriorities: ["priority"],
      expectedScaleSignals: ["banquet capacity"],
      expectedBuyingSignals: ["new venue expansion"],
    },
  );
  assert.equal(result.lane, "deep_research");
  assert.ok(
    result.signals.find(({ key }) => key === "account_potential")!.contribution > 0,
  );
  assert.ok(result.signals.find(({ key }) => key === "buying_timing")!.contribution > 0);
  assert.equal(result.researchability.difficulty, "high");
});

test("high-confidence non-company and out-of-market evidence is suppressed early", () => {
  for (const [quality, reason] of [
    [
      {
        likelyOperatingOrganization: false,
        likelyTargetGeography: true,
        confidence: 0.9,
      },
      "not_operating_organization",
    ],
    [
      {
        likelyOperatingOrganization: true,
        likelyTargetGeography: false,
        confidence: 0.9,
      },
      "outside_target_geography",
    ],
  ] as const) {
    const result = prioritizeResearchCandidate({
      ...base,
      triageEvidence: {
        industries: [],
        keywords: [],
        matchedSignals: [],
        preliminaryQuality: [quality],
      },
    });
    assert.equal(result.lane, "suppress");
    assert.equal(result.suppressedReason, reason);
  }
});

test("conflicting preliminary evidence remains reviewable instead of being suppressed", () => {
  const result = prioritizeResearchCandidate({
    ...base,
    triageEvidence: {
      industries: [],
      keywords: [],
      matchedSignals: [],
      preliminaryQuality: [
        {
          likelyOperatingOrganization: true,
          likelyTargetGeography: true,
          confidence: 0.9,
        },
        {
          likelyOperatingOrganization: false,
          likelyTargetGeography: false,
          confidence: 0.85,
        },
      ],
    },
  });
  assert.notEqual(result.lane, "suppress");
});
