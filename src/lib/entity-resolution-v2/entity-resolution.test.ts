import assert from "node:assert/strict";
import test from "node:test";
import type { OrganizationIdentity, ResolutionCandidate } from "./contracts.ts";
import { resolveOrganization } from "./matching.ts";
import { evaluateAutomaticMerge } from "./merge-policy.ts";
import {
  normalizeCanonicalUrl,
  normalizeDomain,
  normalizeLegalIdentifier,
  normalizeOrganizationName,
} from "./normalization.ts";
import { selectBuyingOrganization } from "./buying-organization.ts";
import { buildSplitPlan } from "./split-policy.ts";

const baseCandidate: ResolutionCandidate = {
  normalizedCandidateId: "candidate-1",
  name: "Acme UAB",
  country: "LT",
  domain: "www.acme.lt",
  organizationType: "operating_company",
};

const baseOrganization: OrganizationIdentity = {
  organizationId: "organization-1",
  normalizedName: "acme",
  primaryCountry: "LT",
  domains: ["acme.lt"],
  canonicalUrls: ["https://acme.lt/"],
  legalIdentifiers: [],
  organizationType: "operating_company",
};

test("normalizes organization identity deterministically", () => {
  assert.equal(normalizeOrganizationName("  ÁCME, UAB  "), "acme");
  assert.equal(normalizeDomain("https://www.Acme.lt/path"), "acme.lt");
  assert.equal(normalizeCanonicalUrl("https://WWW.acme.lt/about/?x=1"), "acme.lt/about");
  assert.equal(normalizeLegalIdentifier("lt-123 456"), "LT123456");
});

test("links one safe exact-domain match", () => {
  const outcome = resolveOrganization(baseCandidate, [baseOrganization]);
  assert.equal(outcome.action, "link_existing");
  if (outcome.action !== "link_existing") return;
  assert.equal(evaluateAutomaticMerge(outcome.assessment).permitted, true);
});

test("does not auto-link a name-and-country-only match", () => {
  const outcome = resolveOrganization({ ...baseCandidate, domain: undefined }, [
    { ...baseOrganization, domains: [], canonicalUrls: [] },
  ]);
  assert.equal(outcome.action, "needs_review");
});

test("does not auto-link candidates found on shared directory domains", () => {
  const outcome = resolveOrganization({ ...baseCandidate, sharedDirectoryDomain: true }, [
    baseOrganization,
  ]);
  assert.equal(outcome.action, "needs_review");
});

test("keeps brands and franchisees as related graph nodes", () => {
  const outcome = resolveOrganization(
    { ...baseCandidate, organizationType: "franchisee" },
    [{ ...baseOrganization, organizationType: "brand" }],
  );
  assert.equal(outcome.action, "needs_review");
  if (outcome.action !== "needs_review") return;
  assert.equal(outcome.assessments[0]?.recommendation, "link_as_related_entity");
});

test("ambiguous exact matches require review instead of choosing silently", () => {
  const outcome = resolveOrganization(baseCandidate, [
    baseOrganization,
    { ...baseOrganization, organizationId: "organization-2" },
  ]);
  assert.equal(outcome.action, "needs_review");
});

test("verified legal identifiers support deterministic matching", () => {
  const legalIdentifier = {
    type: "company_registry",
    jurisdiction: "LT",
    value: "LT-123456",
    verified: true,
  };
  const outcome = resolveOrganization(
    { ...baseCandidate, domain: undefined, legalIdentifiers: [legalIdentifier] },
    [
      {
        ...baseOrganization,
        domains: [],
        canonicalUrls: [],
        legalIdentifiers: [{ ...legalIdentifier, value: "LT123456" }],
      },
    ],
  );
  assert.equal(outcome.action, "link_existing");
});

test("unknown procurement autonomy remains explicit", () => {
  assert.deepEqual(selectBuyingOrganization("target-1", []), {
    organizationId: "target-1",
    procurementAutonomy: "unknown",
    confidence: 0,
    evidenceIds: [],
  });
});

test("split plans restore the source organization and preserve reassignment lineage", () => {
  assert.deepEqual(
    buildSplitPlan({
      mergeEventId: "merge-1",
      sourceOrganizationId: "source-1",
      targetOrganizationId: "target-1",
      reassignedSourceLinkIds: ["link-1"],
    }),
    {
      mergeEventId: "merge-1",
      restoreOrganizationId: "source-1",
      detachFromOrganizationId: "target-1",
      restoreSourceLinkIds: ["link-1"],
    },
  );
});
