import { assertClaimEvidenceScope, type IntelligenceClaim } from "../contracts/claims.ts";
import type { MarketContextOutput } from "../campaign-strategy-v2/market-strategy.ts";
import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import type { CampaignTargetModel } from "./campaign-target-model.ts";
import {
  marketAnalysisSchema,
  type MarketAnalysis,
  type MarketResearchPlan,
} from "./market-intelligence.ts";

export const MARKET_ANALYSIS_SCHEMA_VERSION = "market-analysis/v2-opportunity-map";
export const MARKET_ANALYSIS_COMPILER_VERSION =
  "target-market-analysis-compiler/v2.1-sources-typed-signals";

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
  const opportunityLanes = compileOpportunityLanes({
    target: input.target,
    marketContext: input.marketContext,
    allowedEvidenceIds,
  });
  const importantMarketSources = compileImportantMarketSources({
    marketContext: input.marketContext,
    opportunityLanes,
    allowedEvidenceIds,
  });
  for (const claim of marketStructure)
    assertClaimEvidenceScope(claim, allowedEvidenceIds);
  const evidenceIds = uniqueSorted([
    ...marketStructure.flatMap(({ evidenceIds, counterEvidenceIds }) => [
      ...evidenceIds,
      ...counterEvidenceIds,
    ]),
    ...opportunityLanes.flatMap(({ evidenceIds, counterEvidenceIds }) => [
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
    marketBreadth: input.marketContext.marketBreadth,
    ...(input.marketContext.estimatedCandidateRange
      ? { estimatedCandidateRange: input.marketContext.estimatedCandidateRange }
      : {}),
    marketSummary: input.marketContext.summary,
    targetArchetypes: input.target.archetypes
      .filter(({ priority }) => priority !== "incompatible")
      .map(({ id, priority, whyItCanBuyOrUse }) => ({
        archetypeId: id,
        priority,
        rationale: boundedText(whyItCanBuyOrUse, 800),
      })),
    opportunityLanes,
    marketStructure,
    localTerminology: input.marketContext.localTerminology.map((term) => ({
      language: term.language,
      term: term.term,
      meaning: term.meaning,
      archetypeIds: input.target.archetypes.map(({ id }) => id),
    })),
    localLanguages: input.target.geography.localLanguages,
    majorSourceFamilies: sourceFamilies(input.marketContext.likelySourceTypes),
    importantMarketSources,
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
    // The confirmed Strategy is the user approval boundary. This run-scoped
    // analysis is execution guidance and must not introduce a second gate.
    requiresUserConfirmation: false,
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

function compileOpportunityLanes(input: {
  target: CampaignTargetModel;
  marketContext: MarketContextOutput;
  allowedEvidenceIds: Set<string>;
}) {
  const eligibleArchetypes = input.target.archetypes.filter(
    ({ priority }) => priority !== "incompatible",
  );
  const knownArchetypeIds = new Set(eligibleArchetypes.map(({ id }) => id));
  const proposalsByArchetype = new Map<
    string,
    MarketContextOutput["opportunityLanes"][number]
  >();
  const proposals = input.marketContext.opportunityLanes ?? [];
  for (const proposal of proposals) {
    if (proposal.sourceArchetypeId) {
      if (!knownArchetypeIds.has(proposal.sourceArchetypeId)) {
        throw new Error(
          `Market opportunity lane references unknown target archetype ${proposal.sourceArchetypeId}.`,
        );
      }
      if (proposalsByArchetype.has(proposal.sourceArchetypeId)) {
        throw new Error(
          `Market opportunity map contains duplicate decisions for ${proposal.sourceArchetypeId}.`,
        );
      }
      proposalsByArchetype.set(proposal.sourceArchetypeId, proposal);
    }
    assertEvidenceIdsInScope(proposal.evidenceIds, input.allowedEvidenceIds);
    assertEvidenceIdsInScope(proposal.counterEvidenceIds, input.allowedEvidenceIds);
  }

  const initial = eligibleArchetypes.map((archetype) => {
    const proposal = proposalsByArchetype.get(archetype.id);
    return {
      id: `lane.initial.${archetype.id}`,
      sourceArchetypeId: archetype.id,
      label: proposal?.label ?? archetype.label,
      organizationType: proposal?.organizationType ?? archetype.organizationType,
      businessModels: uniqueSorted(proposal?.businessModels ?? archetype.businessModel),
      industries: uniqueSorted(proposal?.industries ?? []),
      origin: "initial_target" as const,
      disposition: proposal?.disposition ?? archetype.priority,
      rationale: boundedText(proposal?.rationale ?? archetype.whyItCanBuyOrUse, 800),
      relationships: input.target.objective.desiredRelationships,
      evidenceIds: uniqueSorted(proposal?.evidenceIds ?? []),
      counterEvidenceIds: uniqueSorted(proposal?.counterEvidenceIds ?? []),
      scaleDrivers: uniqueSorted(
        proposal?.scaleDrivers ??
          archetype.scaleSignals.map(({ statement }) => statement),
      ),
      buyingTriggers: uniqueSorted(proposal?.buyingTriggers ?? []),
      commercialSignals: compileTypedSignals({
        laneKey: archetype.id,
        scaleDrivers:
          proposal?.scaleDrivers ??
          archetype.scaleSignals.map(({ statement }) => statement),
        buyingTriggers: proposal?.buyingTriggers ?? [],
        needSignals: input.target.positiveSignals,
        evidenceIds: uniqueSorted([
          ...(proposal?.evidenceIds ?? []),
          ...archetype.evidenceIds,
        ]),
        confidence: proposal?.confidence ?? archetype.confidence,
      }),
      vocabulary: uniqueSorted(proposal?.vocabulary ?? []),
      confidence: proposal?.confidence ?? archetype.confidence,
    };
  });
  const discovered = proposals
    .filter(({ sourceArchetypeId }) => !sourceArchetypeId)
    .map((proposal) => ({
      id: `lane.market.${stableLaneKey(proposal.laneKey)}`,
      label: proposal.label,
      organizationType: proposal.organizationType,
      businessModels: uniqueSorted(proposal.businessModels),
      industries: uniqueSorted(proposal.industries),
      origin: "market_research" as const,
      disposition: proposal.disposition,
      rationale: proposal.rationale,
      relationships: input.target.objective.desiredRelationships,
      evidenceIds: uniqueSorted(proposal.evidenceIds),
      counterEvidenceIds: uniqueSorted(proposal.counterEvidenceIds),
      scaleDrivers: uniqueSorted(proposal.scaleDrivers),
      buyingTriggers: uniqueSorted(proposal.buyingTriggers),
      commercialSignals: compileTypedSignals({
        laneKey: proposal.laneKey,
        scaleDrivers: proposal.scaleDrivers,
        buyingTriggers: proposal.buyingTriggers,
        needSignals: input.target.positiveSignals,
        evidenceIds: proposal.evidenceIds,
        confidence: proposal.confidence,
      }),
      vocabulary: uniqueSorted(proposal.vocabulary),
      confidence: proposal.confidence,
    }));
  const lanes = [...initial, ...discovered].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  if (new Set(lanes.map(({ id }) => id)).size !== lanes.length) {
    throw new Error("Market opportunity lane keys must be unique.");
  }
  if (!lanes.some(({ disposition }) => disposition === "priority")) {
    throw new Error("Market Opportunity Map requires at least one priority lane.");
  }
  return lanes;
}

function compileImportantMarketSources(input: {
  marketContext: MarketContextOutput;
  opportunityLanes: ReturnType<typeof compileOpportunityLanes>;
  allowedEvidenceIds: Set<string>;
}) {
  const laneIdByKey = new Map<string, string>();
  for (const lane of input.opportunityLanes) {
    laneIdByKey.set(lane.id, lane.id);
    if ("sourceArchetypeId" in lane && lane.sourceArchetypeId) {
      laneIdByKey.set(lane.sourceArchetypeId, lane.id);
    }
  }
  for (const proposal of input.marketContext.opportunityLanes) {
    const id = proposal.sourceArchetypeId
      ? `lane.initial.${proposal.sourceArchetypeId}`
      : `lane.market.${stableLaneKey(proposal.laneKey)}`;
    laneIdByKey.set(proposal.laneKey, id);
  }
  return input.marketContext.importantMarketSources.map((source) => {
    assertEvidenceIdsInScope(source.evidenceIds, input.allowedEvidenceIds);
    const applicableOpportunityLaneIds = uniqueSorted(
      source.applicableOpportunityLaneKeys.flatMap((key) => {
        const id = laneIdByKey.get(key);
        return id ? [id] : [];
      }),
    );
    return {
      id: `market-source.${stableLaneKey(source.sourceKey)}`,
      name: source.name,
      ...(source.url ? { url: source.url } : {}),
      sourceFamily: sourceFamily(source.sourceFamily),
      relevance: source.whyUseful,
      applicableOpportunityLaneIds,
      useFor: source.useFor,
      evidenceIds: uniqueSorted(source.evidenceIds),
      confidence: source.confidence,
    };
  });
}

function compileTypedSignals(input: {
  laneKey: string;
  scaleDrivers: string[];
  buyingTriggers: string[];
  needSignals: CampaignTargetModel["positiveSignals"];
  evidenceIds: string[];
  confidence: number;
}) {
  const textSignals = (values: string[], type: "scale_driver" | "buying_trigger") =>
    values.map((statement) => ({
      type,
      key: `${input.laneKey}.${type}.${hashCanonical(statement).slice(0, 12)}`,
      label: statement,
      statement,
      evidenceIds: uniqueSorted(input.evidenceIds),
      confidence: input.confidence,
    }));
  return [
    ...textSignals(input.scaleDrivers, "scale_driver"),
    ...textSignals(input.buyingTriggers, "buying_trigger"),
    ...input.needSignals.map((signal) => ({
      type: "need_signal" as const,
      key: signal.key,
      label: signal.statement,
      statement: signal.statement,
      evidenceIds: uniqueSorted(signal.evidenceIds),
      confidence: signal.confidence,
    })),
  ];
}

function sourceFamily(
  value: MarketContextOutput["importantMarketSources"][number]["sourceFamily"],
) {
  const mapping = {
    industry_association: "association",
    member_directory: "industry_directory",
    trade_event: "trade_event",
    exhibitor_directory: "industry_directory",
    business_directory: "industry_directory",
    ranking: "web_search",
    registry: "registry",
    government: "registry",
    trade_publication: "news",
    marketplace: "marketplace",
    other: "other",
  } as const;
  return mapping[value];
}

function assertEvidenceIdsInScope(values: string[], allowed: Set<string>) {
  const unknown = values.find((id) => !allowed.has(id));
  if (unknown)
    throw new Error(`Market opportunity lane references unknown evidence ${unknown}.`);
}

function stableLaneKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 120);
  if (!normalized) throw new Error("Market opportunity lane key must be stable text.");
  return normalized;
}

function boundedText(value: string, maximum: number) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, Math.max(1, maximum - 1)).trimEnd();
  return `${shortened}…`;
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
