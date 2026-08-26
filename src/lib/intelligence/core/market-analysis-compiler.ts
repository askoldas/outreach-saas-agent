import { assertClaimEvidenceScope, type IntelligenceClaim } from "../contracts/claims.ts";
import type { MarketContextOutput } from "../campaign-strategy-v2/market-strategy.ts";
import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel } from "./campaign-target-model.ts";
import {
  marketAnalysisSchema,
  type MarketAnalysis,
  type MarketResearchPlan,
} from "./market-intelligence.ts";

export const MARKET_ANALYSIS_SCHEMA_VERSION = "market-analysis/v1";
export const MARKET_ANALYSIS_COMPILER_VERSION = "target-market-analysis-compiler/v1";

export type MarketAnalysisModelProvenance = {
  promptVersion: string;
  modelRole: string;
  provider: string;
  model: string;
};

export function compileMarketAnalysis(input: {
  artifactId: string;
  target: CampaignTargetModel;
  marketContext: MarketContextOutput;
  allowedEvidenceIds: string[];
  provenance: MarketAnalysisModelProvenance;
  createdAt: string;
}): MarketAnalysis {
  const allowedEvidenceIds = new Set([
    ...input.allowedEvidenceIds,
    ...targetEvidenceIds(input.target),
  ]);
  const marketStructure = marketStructureClaims(input.marketContext);
  for (const claim of marketStructure)
    assertClaimEvidenceScope(claim, allowedEvidenceIds);
  const evidenceIds = uniqueSorted([
    ...marketStructure.flatMap(({ evidenceIds, counterEvidenceIds }) => [
      ...evidenceIds,
      ...counterEvidenceIds,
    ]),
  ]);
  const body = {
    workspaceId: input.target.workspaceId,
    campaignId: input.target.campaignId,
    campaignTargetModelVersionId: input.target.id,
    commercialIntelligenceVersionId: input.target.commercialIntelligenceVersionId,
    geography: input.target.geography,
    selectedOfferingIds: input.target.offeringIds,
    marketSummary: input.marketContext.summary,
    targetArchetypes: input.target.archetypes
      .filter(({ priority }) => priority !== "incompatible")
      .map(({ id, priority, whyItCanBuyOrUse }) => ({
        archetypeId: id,
        priority,
        rationale: whyItCanBuyOrUse,
      })),
    marketStructure,
    localTerminology: input.marketContext.localTerminology.map((term) => ({
      language: term.language,
      term: term.term,
      meaning: term.meaning,
      archetypeIds: input.target.archetypes.map(({ id }) => id),
    })),
    localLanguages: input.target.geography.localLanguages,
    majorSourceFamilies: sourceFamilies(input.marketContext.likelySourceTypes),
    importantMarketSources: [],
    qualificationSignals: input.target.positiveSignals,
    misleadingSignals: input.target.negativeSignals,
    coverageRisks: input.marketContext.underCoverageRisks.map((question, index) => ({
      key: `market.coverage-risk.${index + 1}`,
      question,
      importance: "important" as const,
    })),
    opportunityNotes: input.marketContext.marketStructures.map(
      ({ relevance }) => relevance,
    ),
    evidenceIds,
    unknowns: input.marketContext.dataChallenges.map((question, index) => ({
      key: `market.data-challenge.${index + 1}`,
      question,
      importance: "important" as const,
    })),
    confidence: input.marketContext.confidence,
    requiresUserConfirmation: true,
  };
  return marketAnalysisSchema.parse({
    id: input.artifactId,
    ...body,
    version: {
      schemaVersion: MARKET_ANALYSIS_SCHEMA_VERSION,
      compilerVersion: MARKET_ANALYSIS_COMPILER_VERSION,
      inputHash: hashCanonical({
        targetContentHash: input.target.version.contentHash,
        marketContext: input.marketContext,
        promptVersion: input.provenance.promptVersion,
        compilerVersion: MARKET_ANALYSIS_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
      ...input.provenance,
    },
  });
}

export function assertMarketAnalysisReadyForResearchPlan(input: {
  analysis: MarketAnalysis;
  userConfirmed: boolean;
}) {
  if (input.analysis.requiresUserConfirmation && !input.userConfirmed) {
    throw new Error(
      "Market Analysis requires explicit user confirmation before planning.",
    );
  }
  return input.analysis;
}

export function assertResearchPlanUsesMarketAnalysis(input: {
  analysis: MarketAnalysis;
  plan: MarketResearchPlan;
}) {
  if (input.plan.marketAnalysisVersionId !== input.analysis.id) {
    throw new Error("Market Research Plan references another Market Analysis.");
  }
  if (input.plan.campaignId !== input.analysis.campaignId) {
    throw new Error(
      "Market Research Plan and Market Analysis reference different Campaigns.",
    );
  }
  if (
    input.plan.campaignTargetModelVersionId !==
    input.analysis.campaignTargetModelVersionId
  ) {
    throw new Error(
      "Market Research Plan and Market Analysis use different Target Models.",
    );
  }
  return input.plan;
}

function marketStructureClaims(context: MarketContextOutput) {
  const structures: IntelligenceClaim[] = context.marketStructures.map((structure) => ({
    claimId: `market.structure.${structure.structureKey}`,
    fieldPath: "marketStructure",
    statement: `${structure.label}: ${structure.relevance}`,
    epistemicStatus: structure.epistemicStatus,
    confidence: context.confidence,
    evidenceIds: structure.evidenceIds,
    counterEvidenceIds: [],
    ...(structure.conciseRationale
      ? { conciseRationale: structure.conciseRationale }
      : {}),
  }));
  return [...structures, ...context.procurementPatterns];
}

function sourceFamilies(values: string[]) {
  const families = values.map((value) => {
    const normalized = value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
    const supported = [
      "local_business",
      "official_website",
      "company_database",
      "registry",
      "industry_directory",
      "association",
      "certification_list",
      "trade_event",
      "marketplace",
      "partner_ecosystem",
      "funding_database",
      "jobs",
      "news",
      "web_search",
    ] as const;
    return supported.includes(normalized as (typeof supported)[number])
      ? (normalized as (typeof supported)[number])
      : ("other" as const);
  });
  return uniqueSorted(families.length ? families : ["web_search" as const]);
}

function targetEvidenceIds(target: CampaignTargetModel) {
  return [
    ...target.requiredSignals.flatMap(({ evidenceIds }) => evidenceIds),
    ...target.positiveSignals.flatMap(({ evidenceIds }) => evidenceIds),
    ...target.negativeSignals.flatMap(({ evidenceIds }) => evidenceIds),
    ...target.archetypes.flatMap(({ evidenceIds }) => evidenceIds),
  ];
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}
