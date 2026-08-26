import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET } from "../research-budget-v2/contracts.ts";
import {
  decideAdaptiveResearchNextAction,
  nextConsecutiveLowYieldWaves,
} from "./controller.ts";

const base = {
  budget: DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET,
  usage: {
    providerCalls: 8,
    providerRecords: 100,
    aiInputTokens: 10_000,
    aiOutputTokens: 2_000,
    aiCostUsd: 0.5,
    pagesFetched: 20,
    uniqueOrganizations: 50,
    deepResearchCandidates: 12,
    qualifiedCandidates: 12,
    runtimeMinutes: 10,
  },
  lanes: {
    recommended: 5,
    conditional: 3,
    requiresResearch: 2,
    rejected: 1,
    excluded: 1,
  },
  remainingPlausibleCandidates: 30,
  strongUnresearchedCandidates: 10,
  actionableDiscoveryGaps: 2,
  unexpandedSourcePages: 1,
  consecutiveLowYieldWaves: 0,
  discoverySaturated: false,
};

test("strong existing candidates take precedence over more discovery", () => {
  const decision = decideAdaptiveResearchNextAction(base);
  assert.equal(decision.action, "research_existing_pool");
  assert.equal(decision.yield.reviewReadyYield, 8 / 12);
});

test("budget is a ceiling and preserves remaining opportunity", () => {
  const decision = decideAdaptiveResearchNextAction({
    ...base,
    usage: { ...base.usage, deepResearchCandidates: 40 },
  });
  assert.equal(decision.action, "stop_budget");
  assert.equal(decision.additionalOpportunityRemains, true);
});

test("source expansion precedes generic discovery", () => {
  const decision = decideAdaptiveResearchNextAction({
    ...base,
    strongUnresearchedCandidates: 0,
  });
  assert.equal(decision.action, "expand_source_pages");
});

test("low-yield streaks advance and reset from measured review-ready yield", () => {
  assert.equal(
    nextConsecutiveLowYieldWaves({ previous: 1, researched: 10, reviewReady: 1 }),
    2,
  );
  assert.equal(
    nextConsecutiveLowYieldWaves({ previous: 2, researched: 10, reviewReady: 4 }),
    0,
  );
  assert.equal(
    nextConsecutiveLowYieldWaves({ previous: 2, researched: 0, reviewReady: 0 }),
    2,
  );
});
