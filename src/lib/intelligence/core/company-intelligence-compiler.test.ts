import assert from "node:assert/strict";
import test from "node:test";
import { compileCompanyIntelligence } from "./company-intelligence-compiler.ts";

test("Company Intelligence compiles only reusable organization evidence", () => {
  const intelligence = compile();
  assert.deepEqual(intelligence.businessModel, ["Wholesale distribution"]);
  assert.deepEqual(intelligence.facilities, ["Operates two warehouses"]);
  assert.deepEqual(intelligence.organizationRoles, ["manufacturer"]);
  assert.equal(
    intelligence.claims.some(({ claimId }) => claimId === "campaign-claim"),
    false,
  );
  assert.deepEqual(intelligence.researchBlueprintVersionIds, ["blueprint-1"]);
  assert.deepEqual(intelligence.contradictions, ["Facility count conflicts"]);
  assert.equal("eligibility" in intelligence, false);
  assert.equal("fit" in intelligence, false);
  assert.equal("rank" in intelligence, false);
});

test("Company Intelligence is content deterministic and requires blueprint provenance", () => {
  const first = compile("intelligence-1", "2026-08-24T00:00:00.000Z");
  const second = compile("intelligence-2", "2026-08-25T00:00:00.000Z");
  assert.equal(first.version.inputHash, second.version.inputHash);
  assert.equal(first.version.contentHash, second.version.contentHash);
  assert.throws(
    () => compileCompanyIntelligence({ ...input(), researchBlueprintVersionIds: [] }),
    /requires a frozen Research Blueprint/,
  );
});

function compile(artifactId = "intelligence-1", createdAt = "2026-08-24T00:00:00.000Z") {
  return compileCompanyIntelligence({ ...input(), artifactId, createdAt });
}

function input() {
  return {
    artifactId: "intelligence-1",
    workspaceId: "workspace-1",
    organization: {
      id: "organization-1",
      canonicalName: "Example SIA",
      aliases: ["Example"],
      officialDomain: "example.com",
      officialWebsite: "https://example.com/",
      identityConfidence: 0.9,
      identityReviewState: "confirmed" as const,
    },
    sourceCandidateIntelligenceVersionId: "candidate-intelligence-1",
    researchBlueprintVersionIds: ["blueprint-1"],
    claims: [
      claim("business", "business_model", "Wholesale distribution"),
      claim("facility", "facilities", "Operates two warehouses"),
      claim("role", "organization_roles", "manufacturer"),
      {
        ...claim("conflict", "facilities", "Facility count conflicts"),
        status: "conflicting" as const,
      },
      {
        ...claim("campaign-claim", "relationship-compatibility", "Campaign fit"),
        reusableScope: "campaign_only" as const,
      },
    ],
    unresolvedQuestionKeys: ["scale"],
    conflictKeys: ["facilities"],
    createdAt: "2026-08-24T00:00:00.000Z",
  };
}

function claim(id: string, key: string, statement: string) {
  return {
    id,
    key,
    fieldPath: `organization.${key}`,
    statement,
    value: statement,
    status: "confirmed_fact" as const,
    confidence: 0.8,
    evidenceIds: [`evidence-${id}`],
    reusableScope: "organization" as const,
  };
}
