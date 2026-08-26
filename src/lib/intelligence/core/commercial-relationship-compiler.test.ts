import assert from "node:assert/strict";
import test from "node:test";
import { campaignTargetModelSchema } from "./campaign-target-model.ts";
import { companyIntelligenceSchema } from "./company-intelligence.ts";
import { compileCommercialRelationshipAssessment } from "./commercial-relationship-compiler.ts";

test("Commercial Relationships remain independent evidence-bounded dimensions", () => {
  const assessment = compile();
  assert.equal(assessment.relationships.manufacturer?.state, "confirmed");
  assert.equal(assessment.relationships.buyer?.state, "possible");
  assert.equal(assessment.relationships.supplier?.state, "possible");
  assert.equal(assessment.relationships.distributor?.state, "unknown");
  assert.equal("primaryRelationship" in assessment, false);
});

test("target intent cannot become relationship evidence and compilation is deterministic", () => {
  const first = compile("relationship-1", "2026-08-24T00:00:00.000Z");
  const second = compile("relationship-2", "2026-08-25T00:00:00.000Z");
  assert.equal(first.relationships.distributor?.confidence, 0);
  assert.deepEqual(first.relationships.distributor?.evidenceIds, []);
  assert.equal(first.version.inputHash, second.version.inputHash);
  assert.equal(first.version.contentHash, second.version.contentHash);
});

test("Commercial Relationships reject unknown matched archetypes", () => {
  assert.throws(
    () =>
      compileCommercialRelationshipAssessment({
        artifactId: "relationship-1",
        companyIntelligence: company(),
        target: target(),
        matchedArchetypeIds: ["unknown-archetype"],
        createdAt: "2026-08-24T00:00:00.000Z",
      }),
    /unknown archetype/,
  );
});

function compile(artifactId = "relationship-1", createdAt = "2026-08-24T00:00:00.000Z") {
  return compileCommercialRelationshipAssessment({
    artifactId,
    companyIntelligence: company(),
    target: target(),
    matchedArchetypeIds: ["archetype-1"],
    createdAt,
  });
}

function company() {
  return companyIntelligenceSchema.parse({
    id: "company-intelligence-1",
    workspaceId: "workspace-1",
    organizationId: "organization-1",
    identity: {
      canonicalName: "Example",
      aliases: [],
      officialDomain: "example.com",
      officialWebsite: "https://example.com/",
      identityConfidence: 0.9,
      identityReviewState: "confirmed",
    },
    organizationRoles: ["manufacturer"],
    claims: [
      {
        claimId: "claim-role",
        fieldPath: "organization.organizationRoles",
        statement: "The organization manufactures equipment.",
        value: ["manufacturer"],
        epistemicStatus: "explicit_fact",
        confidence: 0.9,
        evidenceIds: ["evidence-role"],
        counterEvidenceIds: [],
      },
    ],
    evidenceIds: ["evidence-role"],
    researchBlueprintVersionIds: ["blueprint-1"],
    confidence: 0.9,
    version: version("company"),
  });
}

function target() {
  return campaignTargetModelSchema.parse({
    id: "target-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    profileSnapshotId: "profile-1",
    commercialIntelligenceVersionId: "commercial-1",
    offeringIds: ["offering-1"],
    objective: {
      code: "distribution",
      description: "Find distributors.",
      desiredRelationships: ["distributor"],
    },
    geography: {
      displayName: "Latvia",
      countryCodes: ["LV"],
      localLanguages: ["Latvian"],
      workingLanguages: ["English"],
    },
    archetypes: [
      {
        id: "archetype-1",
        label: "Operator",
        organizationType: "Operating company",
        businessModel: [],
        priority: "priority",
        whyItCanBuyOrUse: "It operates the process.",
        operationalEvidenceOfNeed: ["Runs the process"],
        positiveSignals: [],
        negativeSignals: [],
        scaleSignals: [],
        geographyRequirements: [],
        hardExclusionRuleKeys: [],
        likelyRelationships: ["buyer", "supplier"],
        optionalOrUnknown: [],
        evidenceIds: [],
        confidence: 0.8,
      },
    ],
    requiredSignals: [],
    positiveSignals: [],
    negativeSignals: [],
    hardExclusions: [],
    softExclusions: [],
    qualificationRequirements: [],
    confirmedConstraints: [],
    unresolvedQuestions: [],
    confidence: 0.8,
    version: version("target"),
  });
}

function version(seed: string) {
  return {
    schemaVersion: `${seed}/v1`,
    compilerVersion: `${seed}-compiler/v1`,
    inputHash: seed.padEnd(64, "a").slice(0, 64),
    contentHash: seed.padEnd(64, "b").slice(0, 64),
    createdAt: "2026-08-24T00:00:00.000Z",
  };
}
