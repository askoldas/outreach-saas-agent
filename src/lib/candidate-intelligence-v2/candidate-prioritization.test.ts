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

test("candidate prioritization rewards identity, source diversity, and campaign fit", () => {
  const strong = prioritizeResearchCandidate(base);
  const weak = prioritizeResearchCandidate({
    ...base,
    canonicalDomain: null,
    canonicalUrl: null,
    organizationType: "unknown",
    matchedArchetypeIds: [],
    discoverySourceIds: [],
  });
  assert.ok(strong.score > weak.score);
  assert.ok(strong.signals.some(({ key }) => key === "source_diversity"));
});

test("candidate prioritization is bounded and records negative conflict signals", () => {
  const result = prioritizeResearchCandidate({
    ...base,
    conflictKeys: ["a", "b", "c", "d"],
    unresolvedQuestionKeys: ["e", "f", "g", "h", "i", "j"],
  });
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(
    result.signals.find(({ key }) => key === "evidence_conflicts")?.contribution,
    -15,
  );
});
