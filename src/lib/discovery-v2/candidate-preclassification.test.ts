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

test("a manufacturer remains reviewable for a direct-buyer Campaign", () => {
  const result = classify({
    title: "API Supplier",
    content: "We manufacture and supply active pharmaceutical ingredients.",
  });
  assert.equal(result.disposition, "needs_review");
  assert.equal(result.objectiveCompatibility, "incompatible");
  assert.ok(result.probableRelationshipTypes.includes("supplier"));
  assert.ok(result.reasonCodes.includes("commercial_role_requires_verification"));
});

test("a distributor remains reviewable for a buyer Campaign", () => {
  const result = classify({
    title: "Industrial Distributor",
    content: "We distribute industrial equipment throughout the Baltics.",
  });
  assert.equal(result.disposition, "needs_review");
  assert.ok(result.probableRelationshipTypes.includes("distributor"));
});

test("a reseller remains reviewable when another relationship may exist", () => {
  const result = classify({
    title: "Technology Dealer",
    content: "We are a dealer and reseller of manufacturing systems.",
  });
  assert.equal(result.disposition, "needs_review");
  assert.ok(result.probableRelationshipTypes.includes("reseller"));
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

test("a ccTLD alone does not create a false geography rejection", () => {
  const result = classify({ url: "https://wrong-country.de/" });
  assert.equal(result.disposition, "candidate");
  assert.equal(result.geographyPlausible, null);
  assert.ok(!result.reasonCodes.includes("reliable_geography_mismatch"));
});

test("ambiguous company subpages are deliberately marked needs-review", () => {
  const result = classify({ pageType: "company_subpage" });
  assert.equal(result.disposition, "needs_review");
});

test("an unresolvable identity remains a strong invalid-entity rejection", () => {
  const result = classify({ pageType: "unknown" });
  assert.equal(result.disposition, "reject");
  assert.ok(result.reasonCodes.includes("missing_reliable_organization_identity"));
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
