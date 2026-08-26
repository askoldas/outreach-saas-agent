import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import { marketResearchPlanSchema } from "../intelligence/core/market-intelligence.ts";
import { compileDiscoveryPlanFromMarketResearchPlan } from "./market-research-plan-adapter.ts";
import { webSearchProviderCapabilities } from "./providers/web-search-provider.ts";

test("Market Research routes become frozen provider routes and query vocabulary", () => {
  const result = compile();
  assert.equal(result.marketResearchPlanVersionId, "research-plan-1");
  assert.equal(result.routes[0]?.providers[0]?.providerId, "web_search");
  assert.match(result.routes[0]?.providers[0]?.reasons[0] ?? "", /research\.route/);
  assert.ok(
    result.segments[0]?.businessCharacteristics.keywords.includes("industrial cluster"),
  );
  assert.ok(
    result.segments[0]?.businessCharacteristics.keywords.includes(
      "https://directory.example/companies",
    ),
  );
});

test("adapter rejects disabled providers and incomplete frozen capability sets", () => {
  assert.throws(() => compile([]), /No enabled provider/);
  assert.throws(
    () =>
      compile(["web_search"], {
        providerCapabilities: [],
      }),
    /exact frozen provider capability set/,
  );
});

test("adapter is deterministic and retains Strategy identity for compatibility", () => {
  const first = compile();
  const second = compile();
  assert.equal(first.contentHash, second.contentHash);
  assert.equal(first.campaignStrategyVersionId, "strategy-1");
  assert.equal(first.segments[0]?.strategyVersionId, "strategy-1");
});

function compile(
  enabledProviderIds = ["web_search"],
  overrides: { providerCapabilities?: [] } = {},
) {
  const strategy = confirmedStrategy();
  const archetypeId = strategy.discoverySegments[0]!.archetypeId;
  return compileDiscoveryPlanFromMarketResearchPlan({
    id: "discovery-plan-1",
    workspaceId: "workspace-1",
    strategy,
    researchPlan: researchPlan(archetypeId),
    providerCapabilities: overrides.providerCapabilities ?? [
      { snapshotId: "snapshot-1", capabilities: webSearchProviderCapabilities },
    ],
    enabledProviderIds,
    versionNumber: 1,
    maximumProviderCalls: 20,
    compiledAt: "2026-08-24T00:00:00.000Z",
  });
}

function researchPlan(archetypeId: string) {
  return marketResearchPlanSchema.parse({
    id: "research-plan-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    marketAnalysisVersionId: "analysis-1",
    campaignTargetModelVersionId: "target-1",
    providerCapabilitySnapshotIds: ["snapshot-1"],
    discoveryRoutes: [
      {
        id: "research.route",
        archetypeIds: [archetypeId],
        providerCapabilitySnapshotIds: ["snapshot-1"],
        sourceFamily: "industry_directory",
        providerSourceTypes: ["industry_directory", "web_search"],
        role: "primary",
        priority: 1,
        rationale: "Use specialist industry sources.",
        languages: ["Lithuanian", "English"],
        vocabulary: ["industrial cluster"],
        sourceHints: ["https://directory.example/companies"],
        expansionMode: "resumable",
        expectedCoverage: "medium",
      },
    ],
    verificationRoutes: [],
    expectedCoverageRisks: [],
    redirectCriteria: ["Redirect after zero marginal yield."],
    stopSignals: ["Stop after exhaustion."],
    version: {
      schemaVersion: "research-plan/v1",
      compilerVersion: "research-plan-compiler/v1",
      inputHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      createdAt: "2026-08-24T00:00:00.000Z",
    },
  });
}

function confirmedStrategy() {
  const strategy = createNativeCampaignStrategyFixture();
  strategy.status = "confirmed";
  strategy.objective.userConfirmed = true;
  strategy.geography.userConfirmed = true;
  strategy.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-08-24T00:00:00.000Z",
  };
  return strategy;
}
