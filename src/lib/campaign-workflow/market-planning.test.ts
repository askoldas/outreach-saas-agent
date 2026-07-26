import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseDiscoveryPlan, parseMarketAnalysis } from "./market-planning.ts";

test("market planning reserves its completion budget for compact JSON", async () => {
  const source = await readFile(new URL("./market-planning.ts", import.meta.url), "utf8");

  assert.match(source, /reasoningEffort:\s*"none"/);
  assert.match(source, /3-6 discovery paths/);
  assert.match(source, /2-5 queries per path/);
  assert.match(source, /at most 8 items/);
});

test("market analysis validates local terminology and bounded confidence", () => {
  const analysis = parseMarketAnalysis({
    summary: "A medium German agency market.",
    marketBreadth: "medium",
    relevantCompanyCategories: ["B2B software agency"],
    adjacentCategories: [],
    localTerminology: ["Leadgenerierung"],
    likelySourceTypes: ["directories"],
    positiveSignals: ["outbound sales"],
    negativeSignals: [],
    exclusions: ["freelancers"],
    likelyDataChallenges: ["employee counts"],
    recommendedDiscoveryApproach: "Use German terminology and agency directories.",
    confidence: 0.8,
  });
  assert.deepEqual(analysis.localTerminology, ["Leadgenerierung"]);
});

test("discovery plan requires several auditable paths and clamps approved limits", () => {
  const plan = parseDiscoveryPlan(
    {
      strategySummary: "Combine direct and directory discovery.",
      paths: [
        {
          id: "direct",
          type: "direct_search",
          rationale: "Find first-party sites.",
          expectedCompanyCategory: "Agency",
          priority: 1,
          queries: ["software agency Germany outbound sales"],
          maxResults: 50,
        },
        {
          id: "directory",
          type: "directory",
          rationale: "Expand candidate coverage.",
          expectedCompanyCategory: "Agency",
          priority: 2,
          queries: ["German software agency directory"],
          maxResults: 25,
        },
      ],
      stopConditions: {
        maxIterations: 5,
        maxQueriesPerIteration: 10,
        maxResultsPerQuery: 50,
        minimumMarginalQualifiedYield: 0.02,
      },
    },
    100,
  );
  assert.equal(plan.stopConditions.targetQualifiedCompanies, 100);
  assert.equal(plan.paths.length, 2);
});

test("discovery plan canonicalizes reasonable model-generated path labels", () => {
  const plan = parseDiscoveryPlan(
    {
      strategySummary: "Combine localized and registry discovery.",
      paths: [
        {
          id: "localized",
          type: "localized web search",
          rationale: "Use local terminology.",
          expectedCompanyCategory: "Agency",
          priority: 1,
          queries: ["lokale Agentur"],
          maxResults: 25,
        },
        {
          id: "registry",
          type: "business-registry",
          rationale: "Inspect registered businesses.",
          expectedCompanyCategory: "Agency",
          priority: 2,
          queries: ["agency registry"],
          maxResults: 25,
        },
      ],
      stopConditions: {
        maxIterations: 5,
        maxQueriesPerIteration: 10,
        maxResultsPerQuery: 50,
        minimumMarginalQualifiedYield: 0.02,
      },
    },
    25,
  );

  assert.equal(plan.paths[0]?.type, "local_language_search");
  assert.equal(plan.paths[1]?.type, "directory");
});

test("discovery plan rejects one flat search path", () => {
  assert.throws(
    () =>
      parseDiscoveryPlan(
        { strategySummary: "Flat search", paths: [], stopConditions: {} },
        25,
      ),
    /at least two/,
  );
});
