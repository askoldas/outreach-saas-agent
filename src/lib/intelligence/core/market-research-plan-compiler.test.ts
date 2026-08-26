import assert from "node:assert/strict";
import test from "node:test";
import { campaignTargetModelSchema } from "./campaign-target-model.ts";
import { marketAnalysisSchema } from "./market-intelligence.ts";
import { compileMarketResearchPlan } from "./market-research-plan-compiler.ts";

test("confirmed Market Analysis compiles provider-bound discovery and verification routes", () => {
  const plan = compile();
  assert.equal(plan.discoveryRoutes[0]?.role, "primary");
  assert.deepEqual(plan.discoveryRoutes[0]?.providerCapabilitySnapshotIds, [
    "snapshot-1",
  ]);
  assert.deepEqual(plan.discoveryRoutes[0]?.providerSourceTypes, [
    "industry_directory",
    "web_search",
  ]);
  assert.equal(plan.verificationRoutes[0]?.sourceFamily, "official_website");
  assert.deepEqual(plan.providerCapabilitySnapshotIds, ["snapshot-1"]);
});

test("planning requires explicit confirmation and exact Target Model identity", () => {
  assert.throws(() => compile(false), /explicit user confirmation/);
  assert.throws(
    () =>
      compile(true, {
        ...analysis(),
        campaignTargetModelVersionId: "another-target",
      }),
    /does not reference the supplied Target Model/,
  );
});

test("unsupported geography cannot silently receive an executable route", () => {
  assert.throws(
    () =>
      compile(true, undefined, [
        capability("snapshot-1", ["industry_directory", "web_search"], ["EE"]),
      ]),
    /No frozen provider capability/,
  );
});

test("research planning is deterministic across artifact identity and time", () => {
  const first = compile(true, undefined, undefined, "plan-1", "2026-08-24T00:00:00.000Z");
  const second = compile(
    true,
    undefined,
    undefined,
    "plan-2",
    "2026-08-25T00:00:00.000Z",
  );
  assert.equal(first.version.inputHash, second.version.inputHash);
  assert.equal(first.version.contentHash, second.version.contentHash);
});

function compile(
  userConfirmed = true,
  market = analysis(),
  providerCapabilities = [
    capability("snapshot-1", ["industry_directory", "web_search"], ["LV"]),
  ],
  artifactId = "plan-1",
  createdAt = "2026-08-24T00:00:00.000Z",
) {
  return compileMarketResearchPlan({
    artifactId,
    analysis: marketAnalysisSchema.parse(market),
    target: target(),
    userConfirmed,
    providerCapabilities,
    createdAt,
  });
}

function analysis() {
  return {
    id: "analysis-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    campaignTargetModelVersionId: "target-1",
    commercialIntelligenceVersionId: "commercial-1",
    geography: {
      displayName: "Latvia",
      countryCodes: ["LV"],
      regions: [],
      cities: [],
      localLanguages: ["Latvian"],
      workingLanguages: ["English"],
    },
    selectedOfferingIds: ["offering-1"],
    marketSummary: "A fragmented operating-company market.",
    targetArchetypes: [
      {
        archetypeId: "archetype-1",
        priority: "priority" as const,
        rationale: "It operates the relevant process.",
      },
    ],
    marketStructure: [],
    localTerminology: [
      {
        language: "Latvian",
        term: "operators",
        meaning: "Operating companies",
        archetypeIds: ["archetype-1"],
      },
    ],
    localLanguages: ["Latvian"],
    majorSourceFamilies: ["industry_directory" as const],
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
      description: "Find buyers.",
      desiredRelationships: ["buyer"],
    },
    geography: analysis().geography,
    archetypes: [
      {
        id: "archetype-1",
        label: "Operator",
        organizationType: "Operating company",
        businessModel: [],
        priority: "priority",
        whyItCanBuyOrUse: "It operates the relevant process.",
        operationalEvidenceOfNeed: ["Runs the process"],
        positiveSignals: [],
        negativeSignals: [],
        scaleSignals: [],
        geographyRequirements: [],
        hardExclusionRuleKeys: [],
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

function capability(snapshotId: string, sourceTypes: string[], countries: string[]) {
  return {
    snapshotId,
    capabilities: {
      providerId: "provider-1",
      providerVersion: "provider/v1",
      sourceTypes,
      supports: Object.fromEntries(
        [
          "countryFilter",
          "regionFilter",
          "localityFilter",
          "languageTargeting",
          "industryFilter",
          "keywordFilter",
          "companySizeFilter",
          "employeeRangeFilter",
          "revenueRangeFilter",
          "technologyFilter",
          "businessModelFilter",
          "ownershipFilter",
          "jobSignalFilter",
          "fundingSignalFilter",
          "pagination",
          "totalCountEstimate",
          "recordFreshness",
        ].map((key) => [key, true]),
      ),
      supportedCountries: countries,
      supportedLanguages: ["Latvian", "English"],
    },
  } as Parameters<typeof compileMarketResearchPlan>[0]["providerCapabilities"][number];
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
