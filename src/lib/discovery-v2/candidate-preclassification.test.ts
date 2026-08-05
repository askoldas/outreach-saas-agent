import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import { preclassifyWebResult } from "./candidate-preclassification.ts";

function classify(input: {
  content?: string;
  pageType?: Parameters<typeof preclassifyWebResult>[0]["pageType"];
  title?: string;
  url?: string;
}) {
  const segment = structuredClone(
    createNativeCampaignStrategyFixture().discoverySegments[0]!,
  );
  return preclassifyWebResult({
    pageType: input.pageType ?? "company_homepage",
    result: {
      title: input.title ?? "Example Buyer",
      url: input.url ?? "https://buyer.example/",
      content: input.content ?? "An industrial operator using process technology.",
      score: 0.8,
    },
    segment,
    sourceRecordKey: "source-1",
  });
}

test("a plausible buyer homepage becomes a candidate with frozen Strategy provenance", () => {
  const result = classify({});
  assert.equal(result.disposition, "candidate");
  assert.equal(result.probableOrganizationType, "operating_company");
  assert.equal(result.strategyVersionId.length > 0, true);
  assert.deepEqual(result.sourceEvidenceIds, ["source-1"]);
});

test("an explicit supplier in a buyer Campaign is rejected before Entity Resolution", () => {
  const result = classify({
    title: "API Supplier",
    content: "We manufacture and supply active pharmaceutical ingredients.",
  });
  assert.equal(result.disposition, "reject");
  assert.equal(result.objectiveCompatibility, "incompatible");
  assert.ok(result.reasonCodes.includes("explicit_incompatible_commercial_role"));
});

test("news, directory, and marketplace results remain source-only", () => {
  for (const pageType of [
    "news_article",
    "directory_list",
    "marketplace_listing",
  ] as const) {
    const result = classify({ pageType });
    assert.equal(result.disposition, "source_only");
  }
});

test("a reliable wrong-country domain is rejected", () => {
  const result = classify({ url: "https://wrong-country.de/" });
  assert.equal(result.disposition, "reject");
  assert.equal(result.geographyPlausible, false);
  assert.ok(result.reasonCodes.includes("reliable_geography_mismatch"));
});

test("ambiguous company subpages are deliberately marked needs-review", () => {
  const result = classify({ pageType: "company_subpage" });
  assert.equal(result.disposition, "needs_review");
});

test("a confirmed excluded competitor domain is rejected deterministically", () => {
  const strategy = createNativeCampaignStrategyFixture();
  const segment = structuredClone(strategy.discoverySegments[0]!);
  segment.exclusionRules = [
    {
      ruleKey: "exclude-competitor",
      label: "Known competitor",
      description: "Exclude competitor.example from candidate discovery.",
      ruleType: "hard_exclusion",
      scope: "campaign",
      strength: "hard",
      applicability: {
        objectives: [],
        offeringIds: [],
        geographies: [],
        relationshipTypes: [],
        archetypeIds: [],
      },
      status: "confirmed",
      source: "user",
      evidenceIds: [],
      confidence: 1,
    },
  ];
  const result = preclassifyWebResult({
    pageType: "company_homepage",
    result: {
      title: "Competitor",
      url: "https://competitor.example/",
      content: "Operating company.",
      score: 0.8,
    },
    segment,
    sourceRecordKey: "competitor-source",
  });
  assert.equal(result.disposition, "reject");
  assert.ok(result.reasonCodes.includes("known_hard_exclusion"));
});
