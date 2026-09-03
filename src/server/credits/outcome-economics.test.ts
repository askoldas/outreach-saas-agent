import assert from "node:assert/strict";
import test from "node:test";
import { summarizeOutcomeEconomics } from "./outcome-economics.ts";

test("outcome economics deduplicate companies within each discovery channel", () => {
  const summary = summarizeOutcomeEconomics({
    actualCostUsd: 1.2,
    billableCostUsd: 1,
    candidates: [
      { id: "candidate-a", organizationId: "company-a", state: "ready_for_evaluation" },
      { id: "candidate-b", organizationId: "company-b", state: "ready_for_evaluation" },
      { id: "candidate-duplicate", organizationId: "company-a", state: "merged" },
    ],
    qualificationFacts: [
      { candidateId: "candidate-a", lane: "recommended", status: "completed" },
      { candidateId: "candidate-b", lane: "rejected", status: "completed" },
      { candidateId: "candidate-duplicate", lane: "duplicate", status: "completed" },
    ],
    discoveryLinks: [
      { candidateId: "candidate-a", sourceId: "source-web-1" },
      { candidateId: "candidate-a", sourceId: "source-web-2" },
      { candidateId: "candidate-a", sourceId: "source-directory" },
      { candidateId: "candidate-b", sourceId: "source-directory" },
    ],
    sources: [
      { id: "source-web-1", provider: "tavily", sourceType: "web_search" },
      { id: "source-web-2", provider: "tavily", sourceType: "web_search" },
      { id: "source-directory", provider: "tavily", sourceType: "industry_directory" },
    ],
  });

  assert.equal(summary.discoveredCompanies, 2);
  assert.equal(summary.qualifiedCompanies, 1);
  assert.equal(summary.duplicateCompanies, 1);
  assert.equal(summary.qualificationRate, 0.5);
  assert.equal(summary.actualCostPerQualifiedCompany, 1.2);
  assert.deepEqual(summary.channels, [
    {
      provider: "tavily",
      sourceType: "industry_directory",
      sourceRecords: 1,
      resolvedCompanies: 2,
      qualifiedCompanies: 1,
      qualificationYield: 0.5,
    },
    {
      provider: "tavily",
      sourceType: "web_search",
      sourceRecords: 2,
      resolvedCompanies: 1,
      qualifiedCompanies: 1,
      qualificationYield: 1,
    },
  ]);
});

test("empty delivered outcomes do not report misleading per-company ratios", () => {
  const summary = summarizeOutcomeEconomics({
    actualCostUsd: 0.4,
    billableCostUsd: 0.3,
    candidates: [],
    qualificationFacts: [],
    discoveryLinks: [],
    sources: [],
  });
  assert.equal(summary.actualCostPerQualifiedCompany, null);
  assert.equal(summary.billableCostPerQualifiedCompany, null);
  assert.equal(summary.qualificationRate, null);
});
