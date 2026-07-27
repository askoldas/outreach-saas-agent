import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  evaluateDiscoveryBenchmark,
  explainExpectedCompanyOutcome,
  type DiscoveryBenchmarkFixture,
  type DiscoveryBenchmarkTrace,
} from "./benchmark.ts";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../tests/fixtures/discovery/olainfarm-lithuania.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as DiscoveryBenchmarkFixture;

const traces: DiscoveryBenchmarkTrace[] = [
  trace("eurovaistine.lt", "pharmacy_chain", "Lithuanian", "pharmacy chains", true),
  trace("gintarine.lt", "pharmacy_chain", "Lithuanian", "pharmacy chains", true),
  trace("gintarine.lt", "pharmacy_chain", "English", "industry directories", false, {
    deduplicated: true,
  }),
  trace("camelia.lt", "online_pharmacy", "Lithuanian", "online pharmacies", false, {
    classification: "possible",
    rejectionReason: "Insufficient first-party product evidence",
  }),
  trace("olainfarm.com", "seller", "English", "supplier pages", false, {
    classification: "ineligible",
    rejectionReason: "Seller exclusion",
  }),
];

test("Olainfarm is a permanent, order-independent discovery benchmark", () => {
  assert.equal(fixture.id, "olainfarm-lithuania-pharmaceutical-retail-v1");
  assert.deepEqual(fixture.campaignBrief.targetCountries, ["LT"]);
  assert.deepEqual([...fixture.campaignBrief.discoveryLanguages].sort(), [
    "English",
    "Lithuanian",
  ]);

  const metrics = evaluateDiscoveryBenchmark({
    fixture,
    searchCost: 0.4,
    traces: [...traces].reverse(),
  });

  assert.equal(metrics.rawCandidateCount, 5);
  assert.equal(metrics.deduplicatedCandidateCount, 4);
  assert.equal(metrics.duplicateRate, 0.2);
  assert.equal(metrics.expectedCompanyRecall, 0.5);
  assert.equal(metrics.acceptedCompanyPrecision, 1);
  assert.equal(metrics.falseNegativeCount, 2);
  assert.equal(metrics.falsePositiveCount, 0);
  assert.equal(metrics.costPerAcceptedCompany, 0.2);
  assert.equal(metrics.searchRequestsPerAcceptedCompany, 2);
  assert.equal(metrics.coverage.category.pharmacy_chain, 2);
  assert.equal(metrics.coverage.category.online_pharmacy, 0);
  assert.equal(metrics.coverage.country.LT, 2);
  assert.equal(metrics.coverage.discoveryLanguage.Lithuanian, 2);
  assert.equal(metrics.coverage.discoveryLanguage.English, 0);
  assert.equal(metrics.coverage.sourcePath["pharmacy chains"], 2);
});

test("a missed expected company can be located at its failed pipeline stage", () => {
  assert.equal(explainExpectedCompanyOutcome("eurovaistine.lt", traces), "accepted");
  assert.equal(
    explainExpectedCompanyOutcome("camelia.lt", traces),
    "rejected_during_qualification",
  );
  assert.equal(explainExpectedCompanyOutcome("benu.lt", traces), "not_discovered");
});

function trace(
  domain: string,
  category: string,
  discoveryLanguage: string,
  discoveryPath: string,
  accepted: boolean,
  overrides: Partial<DiscoveryBenchmarkTrace> = {},
): DiscoveryBenchmarkTrace {
  return {
    accepted,
    category,
    classification: accepted ? "eligible" : "ineligible",
    countryCode: domain.endsWith(".lt") ? "LT" : "LV",
    deduplicated: false,
    discoveryLanguage,
    discoveryPath,
    domain,
    provider: "tavily",
    qualificationScore: accepted ? 0.86 : 0.35,
    query: `${discoveryPath} Lithuania`,
    ...overrides,
  };
}
