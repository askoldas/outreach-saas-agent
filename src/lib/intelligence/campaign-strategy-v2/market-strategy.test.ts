import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  campaignMarketContextOutputSchema,
  campaignStrategyAdvisoryDeltaOutputSchema,
} from "./task-contracts.ts";
import {
  compileBoundedStrategyModelInput,
  normalizeUntrustedMarketClaims,
} from "./market-strategy.ts";

test("unsupported market statements remain hypotheses", () => {
  const normalized = normalizeUntrustedMarketClaims({
    marketStructures: [
      { epistemicStatus: "evidence_backed_inference", evidenceIds: [] },
      { epistemicStatus: "explicit_fact", evidenceIds: ["evidence-1"] },
    ],
    procurementPatterns: [{ epistemicStatus: "explicit_fact", evidenceIds: [] }],
  }) as {
    marketStructures: Array<{ epistemicStatus: string }>;
    procurementPatterns: Array<{ epistemicStatus: string }>;
  };
  assert.equal(normalized.marketStructures[0]?.epistemicStatus, "hypothesis");
  assert.equal(normalized.marketStructures[1]?.epistemicStatus, "explicit_fact");
  assert.equal(normalized.procurementPatterns[0]?.epistemicStatus, "hypothesis");
});

test("unsupported priority opportunity lanes are downgraded before validation", () => {
  const normalized = normalizeUntrustedMarketClaims({
    opportunityLanes: [
      {
        laneKey: "event-venues",
        label: "Event venues",
        disposition: "priority",
        evidenceIds: [],
      },
    ],
  }) as { opportunityLanes: Array<{ disposition: string }> };

  assert.equal(normalized.opportunityLanes[0]?.disposition, "exploratory");
});

test("advisory delta accepts only bounded allowlisted operations", () => {
  const parsed = campaignStrategyAdvisoryDeltaOutputSchema.parse({
    summary: "A narrow terminology refinement.",
    operations: [
      {
        operation: "add_local_terminology",
        archetypeId: "draft.archetype.hospital",
        terms: ["universitetine ligonine"],
      },
      {
        operation: "adjust_factor_weight",
        factorKey: "offering-need",
        delta: 5,
        rationale: "Procurement evidence is especially discriminating in this market.",
      },
    ],
    omittedObservationCount: 0,
  });
  assert.equal(parsed.operations.length, 2);
});

test("advisory delta rejects replacement policies, arbitrary operations, and unsafe bounds", () => {
  for (const candidate of [
    {
      summary: "Replacement policy",
      operations: [{ operation: "replace_qualification_policy", factors: [] }],
      omittedObservationCount: 0,
    },
    {
      summary: "Excessive adjustment",
      operations: [
        {
          operation: "adjust_factor_weight",
          factorKey: "offering-need",
          delta: 50,
          rationale: "Replace the deterministic policy.",
        },
      ],
      omittedObservationCount: 0,
    },
    {
      summary: "Too many operations",
      operations: Array.from({ length: 13 }, () => ({
        operation: "identify_market_risk",
        risk: "Risk",
        rationale: "Rationale",
        evidenceIds: [],
      })),
      omittedObservationCount: 0,
    },
  ]) {
    assert.equal(
      campaignStrategyAdvisoryDeltaOutputSchema.safeParse(candidate).success,
      false,
    );
  }
});

test("invalid evidenced market context cannot enter the advisory stage", () => {
  const result = campaignMarketContextOutputSchema.safeParse({
    summary: "Synthetic market context.",
    marketBreadth: "medium",
    marketStructures: [
      {
        structureKey: "channel",
        label: "Channel structure",
        relevance: "Distributors dominate.",
        epistemicStatus: "evidence_backed_inference",
        evidenceIds: [],
      },
    ],
    localTerminology: [],
    procurementPatterns: [],
    likelySourceTypes: [],
    dataChallenges: [],
    underCoverageRisks: [],
    confidence: 0.7,
  });
  assert.equal(result.success, false);
});

test("market structures accept and require rationales consistently with shared claims", () => {
  const base = {
    summary: "Synthetic market context.",
    marketBreadth: "medium" as const,
    marketStructures: [
      {
        structureKey: "channel",
        label: "Channel structure",
        relevance: "Distributors dominate the route to market.",
        epistemicStatus: "evidence_backed_inference" as const,
        evidenceIds: ["evidence-1"],
        conciseRationale:
          "The cited source identifies distributors as the primary channel.",
      },
    ],
    localTerminology: [],
    procurementPatterns: [],
    likelySourceTypes: [],
    dataChallenges: [],
    underCoverageRisks: [],
    confidence: 0.7,
  };

  assert.equal(campaignMarketContextOutputSchema.safeParse(base).success, true);
  const { conciseRationale, ...withoutRationale } = base.marketStructures[0]!;
  assert.equal(typeof conciseRationale, "string");
  assert.equal(
    campaignMarketContextOutputSchema.safeParse({
      ...base,
      marketStructures: [withoutRationale],
    }).success,
    false,
  );
});

test("market normalization derives a rationale from structure relevance", () => {
  const normalized = normalizeUntrustedMarketClaims({
    marketStructures: [
      {
        relevance: "Distributor evidence supports this channel inference.",
        epistemicStatus: "evidence_backed_inference",
        evidenceIds: ["evidence-1"],
      },
    ],
  }) as { marketStructures: Array<{ conciseRationale?: string }> };
  assert.equal(
    normalized.marketStructures[0]?.conciseRationale,
    "Distributor evidence supports this channel inference.",
  );
});

test("market analysis and Strategy advisory remain independent compact tasks", () => {
  const source = readFileSync(
    "src/lib/intelligence/campaign-strategy-v2/market-strategy.ts",
    "utf8",
  );
  assert.doesNotMatch(source, /generateMarketSpecificStrategy/);
  assert.doesNotMatch(source, /marketContext: market\.output/);
  assert.match(source, /generateCampaignMarketContext/);
  assert.match(source, /generateCampaignStrategyAdvisoryDelta/);
  assert.match(source, /maxCompletionTokens: 2_000/);
  assert.match(source, /executeValidatedAiTask/);
  assert.match(source, /allowsRepair: true/);
});

test("model context budgets are deterministic and report omitted input", () => {
  const source = {
    oversized: Array.from({ length: 20 }, (_, index) => `item-${index}`),
    longText: "x".repeat(1_500),
  };
  const first = compileBoundedStrategyModelInput(source);
  const second = compileBoundedStrategyModelInput(source);
  assert.deepEqual(first, second);
  assert.equal(first.budget.omittedArrayItems, 8);
  assert.equal(first.budget.truncatedTextCharacters, 300);
  assert.equal((first.input as { oversized: string[] }).oversized.length, 12);
});
