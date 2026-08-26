import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignResearchBudgetSchema,
  campaignResearchUsageSchema,
  DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET,
} from "./contracts.ts";

test("test campaign research has one bounded default budget", () => {
  assert.deepEqual(campaignResearchBudgetSchema.parse(DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET), {
    maxProviderCalls: 30,
    maxAiCostUsd: 2,
    maxAiTokens: 500_000,
    maxDeepResearchCandidates: 40,
    maxRuntimeMinutes: 45,
  });
});

test("research usage measures work and yield without defining a target count", () => {
  const usage = campaignResearchUsageSchema.parse({
    providerCalls: 1,
    providerRecords: 10,
    aiInputTokens: 100,
    aiOutputTokens: 20,
    aiCostUsd: 0.01,
    pagesFetched: 2,
    uniqueOrganizations: 7,
    deepResearchCandidates: 3,
    qualifiedCandidates: 2,
    runtimeMinutes: 1.5,
  });
  assert.equal(usage.qualifiedCandidates, 2);
  assert.equal("targetCompanies" in usage, false);
});
