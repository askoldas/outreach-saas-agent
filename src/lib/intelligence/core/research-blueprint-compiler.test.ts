import assert from "node:assert/strict";
import test from "node:test";
import { campaignTargetModelSchema } from "./campaign-target-model.ts";
import { marketAnalysisSchema } from "./market-intelligence.ts";
import { compileResearchBlueprints } from "./research-blueprint-compiler.ts";

test("Research Blueprints are deterministic, archetype-bound reusable research contracts", () => {
  const first = compile("blueprint-1", "2026-08-24T00:00:00.000Z");
  const second = compile("blueprint-2", "2026-08-25T00:00:00.000Z");

  assert.equal(first.length, 1);
  assert.equal(first[0]?.targetArchetypeId, "archetype-1");
  assert.equal(first[0]?.version.inputHash, second[0]?.version.inputHash);
  assert.equal(first[0]?.version.contentHash, second[0]?.version.contentHash);
  assert.deepEqual(first[0]?.exclusionChecks, ["exclude-reseller"]);
  assert.ok(first[0]?.researchQuestions.some(({ key }) => key === "operations"));
  assert.ok(
    first[0]?.researchQuestions.every(
      ({ key }) => !key.includes("qualification") && !key.includes("score"),
    ),
  );
});

test("Research Blueprint compilation rejects mismatched frozen inputs", () => {
  const analysis = marketAnalysisSchema.parse(marketAnalysis());
  assert.throws(
    () =>
      compileResearchBlueprints({
        artifactId: () => "blueprint-1",
        target: target(),
        analysis: { ...analysis, campaignTargetModelVersionId: "other-target" },
        createdAt: "2026-08-24T00:00:00.000Z",
      }),
    /frozen Campaign identity/,
  );
});

function compile(id: string, createdAt: string) {
  return compileResearchBlueprints({
    artifactId: () => id,
    target: target(),
    analysis: marketAnalysisSchema.parse(marketAnalysis()),
    createdAt,
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
      code: "direct_buyer",
      description: "Find operators.",
      desiredRelationships: ["buyer"],
    },
    geography: geography(),
    archetypes: [
      {
        id: "archetype-1",
        label: "Operator",
        organizationType: "Operating company",
        businessModel: [],
        priority: "priority",
        whyItCanBuyOrUse: "It runs the relevant process.",
        operationalEvidenceOfNeed: ["Runs the relevant process"],
        positiveSignals: [
          { key: "has-facility", statement: "Has a facility", confidence: 0.8 },
        ],
        negativeSignals: [],
        scaleSignals: [],
        geographyRequirements: [],
        hardExclusionRuleKeys: ["exclude-reseller"],
        likelyRelationships: ["buyer"],
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

function marketAnalysis() {
  return {
    id: "analysis-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    campaignTargetModelVersionId: "target-1",
    commercialIntelligenceVersionId: "commercial-1",
    geography: geography(),
    selectedOfferingIds: ["offering-1"],
    marketSummary: "A fragmented operator market.",
    targetArchetypes: [
      { archetypeId: "archetype-1", priority: "priority", rationale: "Relevant." },
    ],
    marketStructure: [],
    localTerminology: [],
    localLanguages: ["Latvian"],
    majorSourceFamilies: ["industry_directory"],
    importantMarketSources: [],
    qualificationSignals: [],
    misleadingSignals: [],
    coverageRisks: [],
    opportunityNotes: [],
    evidenceIds: [],
    unknowns: [],
    confidence: 0.7,
    requiresUserConfirmation: true,
    version: version("analysis"),
  };
}

function geography() {
  return {
    displayName: "Latvia",
    countryCodes: ["LV"],
    regions: [],
    cities: [],
    localLanguages: ["Latvian"],
    workingLanguages: ["English"],
  };
}

function version(seed: string) {
  return {
    schemaVersion: `${seed}/v1`,
    compilerVersion: `${seed}-compiler/v1`,
    inputHash: seed.padEnd(64, "a").slice(0, 64),
    contentHash: seed.padEnd(64, "b").slice(0, 64),
    createdAt: "2026-08-24T00:00:00.000Z",
    ...(seed === "analysis"
      ? {
          promptVersion: "market/v1",
          modelRole: "campaign_strategy_reasoning",
          provider: "openrouter",
          model: "provider/model-v1",
        }
      : {}),
  };
}
