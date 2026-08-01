import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareResolutionCandidate,
  type CampaignResolutionInput,
} from "./candidate-preparation.ts";

const baseInput: CampaignResolutionInput = {
  canonicalDomainHint: "www.Acme.lt",
  country: "lt",
  matchedArchetypeKey: "buyer",
  matchedSegmentKey: "buyer-lt",
  name: "Acme UAB",
  normalizedCandidateId: "candidate-1",
  normalizedName: null,
  organizationTypeHint: "company",
  preliminaryQuality: { confidence: 0.7 },
  providerSourceRecordId: "source-1",
  sourcePageType: "company_homepage",
  sourceUrl: "https://www.acme.lt/",
  websiteUrl: "https://www.acme.lt/",
};

test("official company pages freeze a safe canonical-domain group", () => {
  assert.deepEqual(prepareResolutionCandidate(baseInput), {
    canonicalDomain: "acme.lt",
    canonicalUrl: "acme.lt/",
    confidence: 0.7,
    country: "LT",
    groupKey: "domain:acme.lt",
    groupingBasis: "domain",
    invalidIdentity: false,
    matchedArchetypeKey: "buyer",
    matchedSegmentKey: "buyer-lt",
    name: "Acme UAB",
    normalizedCandidateId: "candidate-1",
    normalizedName: "acme",
    organizationType: "operating_company",
    providerSourceRecordId: "source-1",
    safeOfficialDomain: true,
  });
});

test("registry and directory hosts never become canonical domains", () => {
  const prepared = prepareResolutionCandidate({
    ...baseInput,
    canonicalDomainHint: "registry.example",
    sourcePageType: "registry_record",
    sourceUrl: "https://registry.example/acme",
    websiteUrl: "https://registry.example/acme",
  });
  assert.equal(prepared.safeOfficialDomain, false);
  assert.equal(prepared.canonicalDomain, null);
  assert.equal(prepared.groupKey, "name_country:acme:LT");
});

test("curated company identity subpages retain the official company website", () => {
  const prepared = prepareResolutionCandidate({
    ...baseInput,
    sourcePageType: "company_subpage",
    sourceUrl: "https://acme.lt/about",
    websiteUrl: "https://acme.lt/about",
  });
  assert.equal(prepared.safeOfficialDomain, true);
  assert.equal(prepared.canonicalDomain, "acme.lt");
  assert.equal(prepared.groupKey, "domain:acme.lt");
});

test("content and unknown pages cannot become organizations", () => {
  for (const sourcePageType of [
    "content_page",
    "news_article",
    "document",
    "unknown",
  ]) {
    assert.equal(
      prepareResolutionCandidate({
        ...baseInput,
        name: "Top API manufacturers in the USA",
        sourcePageType,
        sourceUrl: "https://publisher.example/articles/top-api-manufacturers",
        websiteUrl: "https://publisher.example/",
      }).invalidIdentity,
      true,
    );
  }
});

test("different hinted entity types remain explicit", () => {
  assert.equal(
    prepareResolutionCandidate({
      ...baseInput,
      organizationTypeHint: "marketplace_seller",
    }).organizationType,
    "marketplace_seller",
  );
  assert.equal(
    prepareResolutionCandidate({
      ...baseInput,
      organizationTypeHint: "directory_listing",
    }).invalidIdentity,
    true,
  );
});

test("preliminary confidence is bounded before persistence", () => {
  assert.equal(
    prepareResolutionCandidate({
      ...baseInput,
      preliminaryQuality: { confidence: 4 },
    }).confidence,
    1,
  );
  assert.equal(
    prepareResolutionCandidate({
      ...baseInput,
      preliminaryQuality: {},
    }).confidence,
    0,
  );
});
