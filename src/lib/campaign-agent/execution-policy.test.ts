import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_EXECUTION_LIMITS, createDiscoveryBounds } from "./execution-policy.ts";

test("Campaign Agent execution limits match the approved deterministic ceilings", () => {
  assert.deepEqual(CAMPAIGN_EXECUTION_LIMITS, {
    maxCompaniesInspected: 500,
    maxDiscoveryIterations: 5,
    maxQueriesPerIteration: 10,
    maxResultsPerQuery: 50,
  });
});

test("discovery bounds cap company volume and keep provider results conservative", () => {
  assert.deepEqual(createDiscoveryBounds(25), {
    companies: 25,
    queries: 10,
    resultsPerQuery: 8,
  });
  assert.equal(createDiscoveryBounds(5_000).companies, 500);
  assert.equal(createDiscoveryBounds(0).companies, 1);
});
