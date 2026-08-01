import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import { calculateDiscoveryCoverage, type DiscoveryCoverageMetrics } from "./coverage.ts";
import { analyzeDiscoveryGaps } from "./gaps.ts";
import { compileDiscoveryPlanV2 } from "./planning.ts";
import {
  discoveryProgressCountersSchema,
  emptyDiscoveryProgressCounters,
} from "./progress.ts";
import { webSearchProviderCapabilities } from "./providers/web-search-provider.ts";
import { decideDiscoveryContinuation } from "./stopping.ts";

test("planning requires a confirmed strategy and exactly one route per segment", () => {
  const strategy = confirmedStrategy();
  assert.throws(() =>
    compileDiscoveryPlanV2({
      ...planInput(),
      strategy: { ...strategy, status: "review" },
    }),
  );
  assert.throws(() =>
    compileDiscoveryPlanV2({
      ...planInput(),
      routes: [],
    }),
  );
});

test("semantic plan compilation is deterministic and provider neutral", () => {
  const first = compileDiscoveryPlanV2(planInput());
  const second = compileDiscoveryPlanV2(planInput());
  assert.deepEqual(first, second);
  assert.equal(first.contentHash.length, 64);
  assert.equal(first.routes[0]?.providers[0]?.providerId, "web_search");
  assert.ok(!JSON.stringify(first.segments).includes("site:"));
});

test("coverage confidence is derived from explicit metrics", () => {
  const sufficient = calculateDiscoveryCoverage(
    metrics({
      providerCalls: 4,
      rawRecords: 15,
      normalizedCandidates: 12,
      uniqueCandidateHints: 10,
      sourceTypesAttempted: ["web_search", "industry_directory"],
      queryFamiliesAttempted: ["archetype", "directory", "local_language"],
      languagesAttempted: ["English", "Lithuanian"],
      targetUniqueCandidates: 10,
    }),
  );
  assert.equal(sufficient.status, "sufficient");
  assert.ok(sufficient.confidence >= 0.65);
  assert.equal(sufficient.duplicateRate, 0.1667);

  const blocked = calculateDiscoveryCoverage(metrics({ providerFailureCount: 2 }));
  assert.equal(blocked.status, "blocked");
});

test("exhaustion requires attempted paths and low marginal yield", () => {
  const exhausted = calculateDiscoveryCoverage(
    metrics({
      providerCalls: 10,
      rawRecords: 20,
      normalizedCandidates: 10,
      uniqueCandidateHints: 2,
      queryFamiliesAttempted: ["archetype", "directory", "local_language"],
      languagesAttempted: ["English", "Lithuanian"],
      sourceTypesAttempted: ["web_search", "industry_directory"],
      providerExhausted: true,
    }),
  );
  assert.equal(exhausted.status, "exhausted");
});

test("gap analysis chooses concrete bounded actions instead of generic iteration", () => {
  const raw = metrics({
    providerCalls: 3,
    rawRecords: 10,
    normalizedCandidates: 8,
    uniqueCandidateHints: 1,
    queryFamiliesAttempted: ["archetype"],
    languagesAttempted: ["English"],
    sourceTypesAttempted: ["web_search"],
  });
  const gaps = analyzeDiscoveryGaps({
    cell: calculateDiscoveryCoverage(raw),
    metrics: raw,
    remainingCallBudget: 4,
  });
  assert.ok(gaps.some(({ type }) => type === "language_not_attempted"));
  assert.ok(gaps.some(({ type }) => type === "source_diversity_low"));
  assert.ok(gaps.every(({ recommendedActions }) => recommendedActions.length > 0));
  assert.ok(
    gaps
      .flatMap(({ recommendedActions }) => recommendedActions)
      .every(({ reason, expectedImprovement }) => reason && expectedImprovement),
  );
});

test("continuation stops on product goals and otherwise requires an actionable gap", () => {
  const raw = metrics({
    providerCalls: 2,
    rawRecords: 4,
    normalizedCandidates: 4,
    uniqueCandidateHints: 2,
  });
  const cell = calculateDiscoveryCoverage(raw);
  const gaps = analyzeDiscoveryGaps({
    cell,
    metrics: raw,
    remainingCallBudget: 5,
  });
  const base = {
    cells: [cell],
    gaps,
    requestedCandidateCount: 25,
    currentCandidateCount: 2,
    remainingCalls: 5,
    deadlineReached: false,
    userState: "running" as const,
    fatalProviderFailure: false,
    passNumber: 1,
    maximumPasses: 5,
    consecutiveLowYieldPasses: 0,
    maximumConsecutiveLowYieldPasses: 2,
  };
  assert.equal(decideDiscoveryContinuation(base).decision, "continue");
  const bounded = decideDiscoveryContinuation({
    ...base,
    remainingCalls: 2,
  });
  assert.equal(bounded.decision, "continue");
  assert.equal(bounded.selectedGapIds.length, 1);
  assert.deepEqual(bounded.selectedActions, ["expand_directory"]);
  assert.deepEqual(
    bounded.selectedActionPlans.map(({ gapId, type, maxCalls }) => ({
      gapId,
      type,
      maxCalls,
    })),
    [
      {
        gapId: "segment-1:source_diversity_low",
        type: "expand_directory",
        maxCalls: 2,
      },
    ],
  );
  assert.equal(
    decideDiscoveryContinuation({
      ...base,
      currentCandidateCount: 25,
    }).reasonCode,
    "target_reached",
  );
  assert.equal(
    decideDiscoveryContinuation({
      ...base,
      gaps: [],
    }).reasonCode,
    "no_actionable_gaps",
  );
  assert.equal(
    decideDiscoveryContinuation({
      ...base,
      passNumber: 5,
    }).reasonCode,
    "safety_pass_ceiling",
  );
});

test("discovery progress uses one explicit counter vocabulary", () => {
  const counters = emptyDiscoveryProgressCounters();
  assert.equal(Object.keys(counters).length, 15);
  assert.equal(discoveryProgressCountersSchema.parse(counters).candidatesEvaluated, 0);
  assert.equal("leads" in counters, false);
});

function planInput() {
  const strategy = confirmedStrategy();
  return {
    id: "plan-1",
    workspaceId: "workspace-1",
    strategy,
    routes: [
      {
        segmentId: strategy.discoverySegments[0]!.id,
        providers: [
          {
            providerId: "web_search",
            role: "primary" as const,
            priority: 1,
            reasons: ["Initial enabled discovery provider."],
            unsupportedConstraints: ["employee_range_filter"],
          },
        ],
      },
    ],
    providerCapabilities: [webSearchProviderCapabilities],
    versionNumber: 1,
    maximumProviderCalls: 20,
    compiledAt: "2026-07-28T10:00:00.000Z",
  };
}

function confirmedStrategy() {
  const strategy = createNativeCampaignStrategyFixture();
  strategy.status = "confirmed";
  strategy.objective.userConfirmed = true;
  strategy.geography.userConfirmed = true;
  strategy.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-07-28T09:00:00.000Z",
  };
  return strategy;
}

function metrics(
  overrides: Partial<DiscoveryCoverageMetrics> = {},
): DiscoveryCoverageMetrics {
  return {
    campaignId: "campaign-1",
    discoverySegmentId: "segment-1",
    archetypeId: "archetype-1",
    geographyKey: "LT",
    providerCalls: 0,
    queriesExecuted: 0,
    queryFamiliesAttempted: [],
    expectedQueryFamilies: ["archetype", "directory", "local_language"],
    rawRecords: 0,
    normalizedCandidates: 0,
    uniqueCandidateHints: 0,
    invalidRecordCount: 0,
    sourceTypesAttempted: [],
    languagesAttempted: [],
    expectedLocalLanguages: ["Lithuanian"],
    providerFailureCount: 0,
    providerExhausted: false,
    updatedAt: "2026-07-28T10:00:00.000Z",
    ...overrides,
  };
}
