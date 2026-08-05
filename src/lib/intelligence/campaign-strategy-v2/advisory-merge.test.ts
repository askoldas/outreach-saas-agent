import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "./test-fixture.ts";
import { mergeCampaignStrategyAdvisoryDelta } from "./advisory-merge.ts";

test("safe advisory operations merge deterministically without changing frozen identity", () => {
  const baseline = createNativeCampaignStrategyFixture();
  const archetypeId = baseline.archetypes[0]!.id;
  const advisory = {
    summary: "Market refinements",
    operations: [
      {
        operation: "add_local_terminology" as const,
        archetypeId,
        terms: ["Industriebetrieb"],
      },
      {
        operation: "propose_signal" as const,
        archetypeId,
        polarity: "positive" as const,
        signal: "Publishes relevant procurement notices",
        rationale: "This is a discoverable buying indicator.",
      },
    ],
    omittedObservationCount: 0,
  };
  const first = mergeCampaignStrategyAdvisoryDelta({ baseline, advisory });
  const second = mergeCampaignStrategyAdvisoryDelta({ baseline, advisory });
  assert.deepEqual(first, second);
  assert.deepEqual(first.strategy.objective, baseline.objective);
  assert.deepEqual(first.strategy.offeringReferences, baseline.offeringReferences);
  assert.ok(
    first.strategy.discoverySegments[0]!.businessCharacteristics.keywords.includes(
      "Industriebetrieb",
    ),
  );
  assert.deepEqual(first.dispositions.map((item) => item.status), ["applied", "applied"]);
});

test("unknown references and evidence are rejected while weights require review", () => {
  const baseline = createNativeCampaignStrategyFixture();
  const result = mergeCampaignStrategyAdvisoryDelta({
    baseline,
    advisory: {
      summary: "Unsafe proposals",
      operations: [
        {
          operation: "clarify_archetype",
          archetypeId: "unknown-archetype",
          label: "Replacement",
        },
        {
          operation: "identify_market_risk",
          risk: "Unverified regulation",
          rationale: "Needs checking.",
          evidenceIds: ["invented-evidence"],
        },
        {
          operation: "adjust_factor_weight",
          factorKey: baseline.qualificationPolicy.factorDefinitions[0]!.factorKey,
          delta: 5,
          rationale: "Proposed market emphasis.",
        },
      ],
      omittedObservationCount: 0,
    },
  });
  assert.deepEqual(result.dispositions.map((item) => item.status), [
    "rejected",
    "rejected",
    "requires_user_review",
  ]);
  assert.deepEqual(result.strategy, baseline);
});

test("budget omissions are persisted as an explicit disposition", () => {
  const result = mergeCampaignStrategyAdvisoryDelta({
    baseline: createNativeCampaignStrategyFixture(),
    advisory: {
      summary: "Bounded response",
      operations: [],
      omittedObservationCount: 3,
    },
  });
  assert.deepEqual(result.dispositions, [
    {
      operationIndex: 0,
      operation: "omitted_observation",
      status: "omitted_by_budget",
      reason: "3 lower-priority market observation(s) were omitted by the bounded advisory contract.",
    },
  ]);
});
