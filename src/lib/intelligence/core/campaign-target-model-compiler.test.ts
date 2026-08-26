import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignStrategyV2 } from "../campaign-strategy-v2/schemas.ts";
import {
  assertCampaignTargetStrategyProjection,
  compileCampaignTargetModel,
} from "./campaign-target-model-compiler.ts";
import { commercialIntelligenceSchema } from "./commercial-intelligence.ts";

test("target compilation is offering-specific and preserves non-exclusive relationships", () => {
  const packaging = compile("offering-packaging");
  const software = compile("offering-software");
  assert.deepEqual(
    packaging.archetypes.map(({ id }) => id),
    ["manufacturer"],
  );
  assert.deepEqual(packaging.archetypes[0]?.likelyRelationships, [
    "buyer",
    "manufacturer",
  ]);
  assert.deepEqual(
    software.archetypes.map(({ id }) => id),
    ["operator"],
  );
  assert.notEqual(packaging.version.inputHash, software.version.inputHash);
});

test("only confirmed applicable hard exclusions become gates", () => {
  const target = compile("offering-packaging");
  assert.deepEqual(
    target.hardExclusions.map(({ ruleKey }) => ruleKey),
    ["exclude.closed"],
  );
  assert.deepEqual(target.softExclusions, []);
  assert.deepEqual(target.archetypes[0]?.hardExclusionRuleKeys, ["exclude.closed"]);
});

test("unknowns remain research requirements and do not become negative evidence", () => {
  const target = compile("offering-packaging");
  assert.deepEqual(target.qualificationRequirements, commercial().unknowns);
  assert.deepEqual(target.unresolvedQuestions, commercial().unknowns);
  assert.equal(
    target.negativeSignals.some(({ key }) => key === "unknown.capacity"),
    false,
  );
});

test("compiler is deterministic and requires confirmed Campaign inputs", () => {
  const first = compile("offering-packaging", "target-1", "2026-08-24T00:00:00.000Z");
  const second = compile("offering-packaging", "target-2", "2026-08-25T00:00:00.000Z");
  assert.equal(first.version.inputHash, second.version.inputHash);
  assert.equal(first.version.contentHash, second.version.contentHash);
  assert.throws(
    () => compile("offering-packaging", "target-3", undefined, false),
    /confirmed objective and geography/,
  );
});

test("Campaign Strategy compatibility projection rejects divergent archetypes", () => {
  const target = compile("offering-packaging");
  const base = {
    campaignId: "campaign-1",
    offeringReferences: [
      {
        companyProfileVersionId: "profile-1",
        offeringId: "offering-packaging",
        offeringVersionId: "offering-packaging",
      },
    ],
    objective: objective(),
    geography: geography(),
    archetypes: [{ id: "manufacturer" }],
  } as unknown as CampaignStrategyV2;
  assert.equal(assertCampaignTargetStrategyProjection({ target, strategy: base }), base);
  assert.throws(
    () =>
      assertCampaignTargetStrategyProjection({
        target,
        strategy: {
          ...base,
          archetypes: [{ id: "invented-archetype" }],
        } as CampaignStrategyV2,
      }),
    /outside the Target Model/,
  );
});

function compile(
  selectedOfferingId: string,
  artifactId = "target-1",
  createdAt = "2026-08-24T00:00:00.000Z",
  confirmed = true,
) {
  return compileCampaignTargetModel({
    artifactId,
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    profileSnapshotId: "profile-1",
    commercialIntelligenceVersionId: "commercial-1",
    commercialIntelligence: commercial(),
    selectedOfferingIds: [selectedOfferingId],
    objective: { ...objective(), userConfirmed: confirmed },
    geography: geography(),
    confirmedConstraints: ["Procurement evidence required"],
    createdAt,
  });
}

function objective() {
  return {
    code: "direct_buyer" as const,
    label: "Direct buyers",
    description: "Find organizations able to buy directly.",
    targetRelationshipTypes: ["direct_buyer" as const],
    normallyExcludedRelationshipTypes: [],
    userConfirmed: true,
  };
}

function geography() {
  return {
    mode: "country" as const,
    displayName: "Latvia",
    countryCodes: ["LV"],
    includedRegions: [],
    includedCities: [],
    excludedRegions: [],
    excludedCities: [],
    localLanguages: ["Latvian"],
    workingLanguages: ["English"],
    userConfirmed: true,
  };
}

function commercial() {
  const archetype = (input: {
    id: string;
    label: string;
    roles: string[];
    relationships: ("buyer" | "manufacturer")[];
  }) => ({
    id: input.id,
    label: input.label,
    organizationType: "Operating company",
    businessRoles: input.roles,
    businessModels: [],
    industries: [],
    sourcePriority: "priority" as const,
    rationale: "Has a recurring operational need.",
    operationalUseCases: ["Run the relevant operation"],
    possibleRelationships: input.relationships,
    positiveSignals: [],
    negativeSignals: [],
    evidenceIds: ["evidence-1"],
    confidence: 0.8,
  });
  const offering = (id: string, candidate: ReturnType<typeof archetype>) => ({
    offeringId: id,
    offeringVersionId: id,
    name: id,
    summary: "Commercial offering",
    capabilities: [],
    useCases: [],
    customerProblems: [],
    operationalUseCases: ["Run the relevant operation"],
    possibleCustomerArchetypes: [candidate],
    possibleRelationships: candidate.possibleRelationships,
    positiveSignals: [],
    negativeSignals: [],
    ruleKeys: [],
    evidenceIds: ["evidence-1"],
    confidence: 0.8,
  });
  return commercialIntelligenceSchema.parse({
    id: "commercial-1",
    workspaceId: "workspace-1",
    companyProfileVersionId: "profile-1",
    seller: { name: "Seller", businessRoles: ["manufacturer"], capabilities: [] },
    offerings: [
      offering(
        "offering-packaging",
        archetype({
          id: "manufacturer",
          label: "Manufacturer",
          roles: ["manufacturer"],
          relationships: ["buyer", "manufacturer"],
        }),
      ),
      offering(
        "offering-software",
        archetype({
          id: "operator",
          label: "Operator",
          roles: ["operator"],
          relationships: ["buyer"],
        }),
      ),
    ],
    rules: [
      {
        ruleKey: "exclude.closed",
        label: "Closed organizations",
        description: "Exclude confirmed closed organizations.",
        ruleType: "hard_exclusion",
        scope: "offering",
        strength: "hard",
        applicability: {
          objectives: ["direct_buyer"],
          offeringIds: ["offering-packaging"],
          geographies: [],
          relationshipTypes: [],
          archetypeIds: [],
        },
        status: "confirmed",
        source: "user",
        evidenceIds: [],
        confidence: 1,
      },
      {
        ruleKey: "exclude.proposed",
        label: "Proposed exclusion",
        description: "Not yet confirmed.",
        ruleType: "hard_exclusion",
        scope: "offering",
        strength: "hard",
        applicability: {
          objectives: [],
          offeringIds: ["offering-packaging"],
          geographies: [],
          relationshipTypes: [],
          archetypeIds: [],
        },
        status: "proposed",
        source: "ai",
        evidenceIds: [],
        confidence: 0.5,
      },
    ],
    claims: [],
    unknowns: [
      {
        key: "unknown.capacity",
        question: "What capacity threshold matters?",
        importance: "important",
      },
    ],
    evidenceIds: ["evidence-1"],
    confidence: 0.8,
    version: {
      schemaVersion: "commercial-intelligence/v1",
      compilerVersion: "fixture/v1",
      inputHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      createdAt: "2026-08-24T00:00:00.000Z",
    },
  });
}
