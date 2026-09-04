import assert from "node:assert/strict";
import test from "node:test";
import { prioritizeResearchCandidate } from "./candidate-prioritization.ts";
import {
  matchRelationshipSuppression,
  type RelationshipSuppressionEntry,
} from "./relationship-suppression.ts";
import type { CampaignResearchCandidateInput } from "./research-runtime.ts";

const candidate = {
  organizationId: "organization-new",
  canonicalDomain: "buyer.example",
  organizationName: "Buyer SIA",
};

function entry(
  overrides: Partial<RelationshipSuppressionEntry>,
): RelationshipSuppressionEntry {
  return {
    organizationId: "organization-new",
    canonicalDomains: ["buyer.example"],
    normalizedNames: ["buyer sia"],
    relationship: "existing_customer",
    status: "confirmed",
    confidence: 0.95,
    evidenceIds: ["relationship-evidence-1"],
    source: "prior_qualification",
    ...overrides,
  };
}

test("confirmed customers and competitors suppress before deep research", () => {
  for (const relationship of ["existing_customer", "competitor"] as const) {
    const match = matchRelationshipSuppression({
      candidate,
      entries: [entry({ relationship })],
    });
    assert.equal(match.decision, "suppress");
    assert.equal(match.reason, relationship);
    assert.equal(match.matchedBy, "organization_id");
  }
});

test("ambiguous customer and partner relationships are held", () => {
  for (const relationship of ["existing_customer", "partner"] as const) {
    const match = matchRelationshipSuppression({
      candidate,
      entries: [entry({ relationship, status: "ambiguous", confidence: 0.55 })],
    });
    assert.equal(match.decision, "hold");
    assert.equal(match.reason, "relationship_requires_verification");
  }
});

test("similar but non-identical names do not suppress unrelated organizations", () => {
  const match = matchRelationshipSuppression({
    candidate: {
      organizationId: "unrelated",
      canonicalDomain: "another-buyer.example",
      organizationName: "Buyer Services SIA",
    },
    entries: [entry({ organizationId: "known-customer" })],
  });
  assert.equal(match.decision, "continue");
});

test("an explicit excluded domain suppresses an exact resolved domain", () => {
  const match = matchRelationshipSuppression({
    candidate,
    entries: [
      entry({
        organizationId: undefined,
        relationship: "excluded",
        source: "user_exclusion",
        evidenceIds: [],
      }),
    ],
  });
  assert.equal(match.decision, "suppress");
  assert.equal(match.reason, "explicit_exclusion");
  assert.equal(match.matchedBy, "canonical_domain");
});

test("relationship matching controls selection before research plans are admitted", () => {
  const input: CampaignResearchCandidateInput = {
    campaignCandidateId: "candidate-1",
    organizationId: candidate.organizationId,
    organizationName: candidate.organizationName,
    organizationType: "company",
    canonicalDomain: candidate.canonicalDomain,
    canonicalUrl: "https://buyer.example/",
    procurementAutonomy: "independent",
    matchedArchetypeIds: ["priority-lane"],
    discoverySourceIds: ["source-1"],
    currentIntelligenceVersionId: null,
    unresolvedQuestionKeys: [],
    conflictKeys: [],
    claimStates: [],
    relationshipSuppression: matchRelationshipSuppression({
      candidate,
      entries: [entry({})],
    }),
  };
  const prioritization = prioritizeResearchCandidate(input, {
    matchedLanePriorities: ["priority"],
    positiveSignalCount: 3,
  });
  assert.equal(prioritization.score, 0);
  assert.equal(prioritization.lane, "suppress");
  assert.equal(prioritization.suppressedReason, "existing_customer");
});
