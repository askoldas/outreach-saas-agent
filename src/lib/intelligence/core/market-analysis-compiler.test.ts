import assert from "node:assert/strict";
import test from "node:test";
import { campaignMarketContextOutputSchema } from "../campaign-strategy-v2/task-contracts.ts";
import type { MarketContextOutput } from "../campaign-strategy-v2/market-strategy.ts";
import { campaignTargetModelSchema } from "./campaign-target-model.ts";
import {
  assertMarketAnalysisReadyForResearchPlan,
  compileMarketAnalysis,
} from "./market-analysis-compiler.ts";

test("Market Analysis projects frozen targeting and bounded market interpretation", () => {
  const analysis = compile();
  assert.equal(analysis.campaignTargetModelVersionId, "target-1");
  assert.deepEqual(analysis.selectedOfferingIds, ["offering-1"]);
  assert.deepEqual(analysis.targetArchetypes, [
    {
      archetypeId: "archetype-1",
      priority: "priority",
      rationale: "It operates the relevant process.",
    },
  ]);
  assert.deepEqual(analysis.majorSourceFamilies, ["industry_directory", "registry"]);
  assert.deepEqual(analysis.opportunityLanes, [
    {
      id: "lane.initial.archetype-1",
      sourceArchetypeId: "archetype-1",
      label: "Operator",
      organizationType: "Operating company",
      businessModels: [],
      industries: [],
      origin: "initial_target",
      disposition: "priority",
      rationale: "It operates the relevant process.",
      relationships: ["buyer"],
      evidenceIds: [],
      counterEvidenceIds: [],
      scaleDrivers: [],
      buyingTriggers: [],
      vocabulary: [],
      confidence: 0.8,
    },
  ]);
  assert.equal(analysis.requiresUserConfirmation, false);
  assert.equal("discoveryRoutes" in analysis, false);
});

test("market evidence can reject an initial hypothesis and add a supported lane", () => {
  const analysis = compile({
    ...marketContext(),
    opportunityLanes: [
      {
        laneKey: "existing-operator",
        sourceArchetypeId: "archetype-1",
        label: "Generic operators",
        organizationType: "Operating company",
        rationale: "The segment is too broad to route effectively.",
        disposition: "rejected",
        evidenceIds: [],
        counterEvidenceIds: ["evidence-1"],
        scaleDrivers: [],
        buyingTriggers: [],
        vocabulary: [],
        confidence: 0.85,
      },
      {
        laneKey: "event-venues",
        label: "Conference and event venues",
        organizationType: "Venue operator",
        businessModels: ["events and banqueting"],
        industries: ["hospitality"],
        rationale: "Banquet operations create recurring demand for the offering.",
        disposition: "priority",
        evidenceIds: ["evidence-1"],
        counterEvidenceIds: [],
        scaleDrivers: ["venue and banquet capacity"],
        buyingTriggers: ["renovation or new venue opening"],
        vocabulary: ["konferenču centrs"],
        confidence: 0.82,
      },
    ],
  });

  assert.equal(analysis.opportunityLanes[0]?.disposition, "rejected");
  assert.deepEqual(analysis.opportunityLanes[0]?.counterEvidenceIds, ["evidence-1"]);
  assert.equal(analysis.opportunityLanes[1]?.id, "lane.market.event-venues");
  assert.equal(analysis.opportunityLanes[1]?.origin, "market_research");
  assert.equal(analysis.opportunityLanes[1]?.disposition, "priority");
  assert.deepEqual(analysis.opportunityLanes[1]?.relationships, ["buyer"]);
  assert.ok(analysis.evidenceIds.includes("evidence-1"));
});

test("market opportunity expansion cannot cite evidence outside the frozen scope", () => {
  assert.throws(
    () =>
      compile({
        ...marketContext(),
        opportunityLanes: [
          {
            laneKey: "unsupported-lane",
            label: "Unsupported lane",
            organizationType: "Unknown operator",
            rationale: "A claimed opportunity.",
            disposition: "secondary",
            evidenceIds: ["outside-scope"],
            counterEvidenceIds: [],
            scaleDrivers: [],
            buyingTriggers: [],
            vocabulary: [],
            confidence: 0.4,
          },
        ],
      }),
    /references unknown evidence outside-scope/,
  );
});

test("unsupported source labels stay explicit as other and unknowns stay non-negative", () => {
  const context = marketContext();
  const analysis = compile({
    ...context,
    likelySourceTypes: ["Unmapped specialist source"],
  });
  assert.deepEqual(analysis.majorSourceFamilies, ["other"]);
  assert.equal(analysis.unknowns[0]?.question, "Private procurement data is sparse.");
  assert.deepEqual(analysis.misleadingSignals, target().negativeSignals);
});

test("Market Analysis rejects evidence outside the frozen evidence scope", () => {
  const context = marketContext();
  assert.throws(
    () =>
      compile({
        ...context,
        marketStructures: [
          {
            structureKey: "unsupported",
            label: "Unsupported fact",
            relevance: "Claims a market fact.",
            epistemicStatus: "explicit_fact",
            evidenceIds: ["unknown-evidence"],
          },
        ],
      }),
    /references unknown evidence/,
  );
});

test("Market Analysis is deterministic and uses confirmed Strategy as its approval gate", () => {
  const first = compile(undefined, "analysis-1", "2026-08-24T00:00:00.000Z");
  const second = compile(undefined, "analysis-2", "2026-08-25T00:00:00.000Z");
  assert.equal(first.version.inputHash, second.version.inputHash);
  assert.equal(first.version.contentHash, second.version.contentHash);
  assert.equal(
    assertMarketAnalysisReadyForResearchPlan({ analysis: first, userConfirmed: false }),
    first,
  );
});

test("Market Analysis deterministically bounds verbose frozen archetype rationale", () => {
  const frozenTarget = target();
  frozenTarget.archetypes[0]!.whyItCanBuyOrUse = "x".repeat(1_200);
  const analysis = compileMarketAnalysis({
    artifactId: "analysis-bounded",
    target: frozenTarget,
    marketContext: marketContext(),
    allowedEvidenceIds: [],
    provenance: {
      promptVersion: "market-context/v1",
      modelRole: "campaign_strategy_reasoning",
      provider: "openrouter",
      model: "provider/model-version",
    },
    createdAt: "2026-08-24T00:00:00.000Z",
  });
  assert.equal(analysis.targetArchetypes[0]?.rationale.length, 800);
  assert.match(analysis.targetArchetypes[0]?.rationale ?? "", /…$/);
});

function compile(
  context: unknown = marketContext(),
  artifactId = "analysis-1",
  createdAt = "2026-08-24T00:00:00.000Z",
) {
  return compileMarketAnalysis({
    artifactId,
    target: target(),
    marketContext: campaignMarketContextOutputSchema.parse(context),
    allowedEvidenceIds: [],
    provenance: {
      promptVersion: "market-context/v1",
      modelRole: "campaign_strategy_reasoning",
      provider: "openrouter",
      model: "provider/model-version",
    },
    createdAt,
  });
}

function marketContext(): MarketContextOutput {
  return {
    summary: "A fragmented market with identifiable operating organizations.",
    marketBreadth: "medium" as const,
    marketStructures: [
      {
        structureKey: "fragmented",
        label: "Fragmented operators",
        relevance: "Coverage requires several source families.",
        epistemicStatus: "hypothesis" as const,
        evidenceIds: [],
      },
    ],
    localTerminology: [
      {
        language: "Latvian",
        term: "operators",
        meaning: "Local operating companies",
        targetUse: "company_type" as const,
      },
    ],
    procurementPatterns: [],
    opportunityLanes: [],
    likelySourceTypes: ["registry", "industry directory"],
    dataChallenges: ["Private procurement data is sparse."],
    underCoverageRisks: ["Small regional operators may be absent."],
    confidence: 0.7,
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
      description: "Find direct buyers.",
      desiredRelationships: ["buyer"],
    },
    geography: {
      displayName: "Latvia",
      countryCodes: ["LV"],
      regions: [],
      cities: [],
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
        whyItCanBuyOrUse: "It operates the relevant process.",
        operationalEvidenceOfNeed: ["Runs the relevant process"],
        positiveSignals: [],
        negativeSignals: [],
        scaleSignals: [],
        geographyRequirements: [],
        hardExclusionRuleKeys: [],
        likelyRelationships: ["buyer"],
        optionalOrUnknown: [],
        evidenceIds: ["evidence-1"],
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
    version: {
      schemaVersion: "target/v1",
      compilerVersion: "target-compiler/v1",
      inputHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      createdAt: "2026-08-24T00:00:00.000Z",
    },
  });
}
