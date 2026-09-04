import { randomUUID } from "node:crypto";
import {
  compileMarketResearchQuestions,
  compileMarketResearchFollowUpQuestions,
  DEFAULT_MARKET_RESEARCH_POLICY,
  marketEvidenceCorpusSchema,
  marketResearchWaveSummarySchema,
  marketResearchRequestHash,
  type CampaignTargetModel,
  type MarketEvidenceCorpus,
  type MarketResearchPolicy,
  type MarketResearchQuestion,
  unresolvedPriorityMarketGaps,
} from "@/lib/intelligence/core";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { searchWebResult, type SearchResult } from "@/lib/providers/tavily";
import { runBudgetedTavilyCall } from "@/server/credits/budgeted-tavily-call";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import { reasonAboutWaveOne } from "./wave-reasoning";

type SearchResponse = Awaited<ReturnType<typeof searchWebResult>>;

export type MarketReconnaissanceAdapters = {
  findCached: (input: {
    workspaceId: string;
    campaignRunId: string;
    requestHash: string;
  }) => Promise<MarketEvidenceCorpus | null>;
  search: (input: {
    workspaceId: string;
    campaignRunId: string;
    idempotencyKey: string;
    query: string;
    country?: string;
  }) => Promise<SearchResponse>;
  persist: (corpus: MarketEvidenceCorpus) => Promise<MarketEvidenceCorpus>;
  id: () => string;
  now: () => string;
  summarizeWaveOne?: typeof reasonAboutWaveOne;
};

export async function executeMarketReconnaissance(
  input: {
    workspaceId: string;
    campaignId: string;
    campaignRunId: string;
    target: CampaignTargetModel;
    policy?: Partial<MarketResearchPolicy>;
  },
  adapters: MarketReconnaissanceAdapters = productionAdapters,
) {
  const requestedPolicy = { ...DEFAULT_MARKET_RESEARCH_POLICY, ...input.policy };
  const policy = {
    maxMarketResearchWaves: boundedInteger(requestedPolicy.maxMarketResearchWaves, 1, 3),
    normalMarketResearchWaves: boundedInteger(
      requestedPolicy.normalMarketResearchWaves,
      1,
      2,
    ),
    maxQueriesPerWave: boundedInteger(requestedPolicy.maxQueriesPerWave, 1, 3),
    maxProviderCalls: boundedInteger(requestedPolicy.maxProviderCalls, 1, 9),
    maxEvidenceItems: boundedInteger(requestedPolicy.maxEvidenceItems, 1, 72),
    maxRuntimeMs: boundedInteger(requestedPolicy.maxRuntimeMs, 1_000, 300_000),
  };
  const initialQuestions = compileMarketResearchQuestions(input.target).slice(
    0,
    policy.maxQueriesPerWave,
  );
  const requestHash = marketResearchRequestHash({
    target: input.target,
    questions: initialQuestions,
    policy,
  });
  const cached = await adapters.findCached({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    requestHash,
  });
  if (cached) return { corpus: cached, cached: true as const };

  assertIntelligenceExternalCallsAllowed("provider");
  const startedAt = Date.now();
  const createdAt = adapters.now();
  const questions: MarketResearchQuestion[] = [];
  const responses: SearchResponse[] = [];
  const evidence: ReturnType<typeof evidenceItem>[] = [];
  const waves: MarketEvidenceCorpus["waves"] = [];
  const runWave = async (
    waveQuestions: MarketResearchQuestion[],
    priorityGapKeys: string[],
  ) => {
    const remainingCalls = policy.maxProviderCalls - responses.length;
    const executable = waveQuestions.slice(0, Math.max(0, remainingCalls));
    if (!executable.length || Date.now() - startedAt >= policy.maxRuntimeMs) return;
    const waveResponses = await Promise.all(
      executable.map((question) =>
        adapters.search({
          workspaceId: input.workspaceId,
          campaignRunId: input.campaignRunId,
          idempotencyKey: `market-reconnaissance:${input.campaignRunId}:wave-${question.waveNumber}:${hashCanonical(question).slice(0, 16)}`,
          query: question.query,
          ...(singleCountry(input.target)
            ? { country: singleCountry(input.target) }
            : {}),
        }),
      ),
    );
    const waveEvidence = executable.flatMap((question, questionIndex) =>
      waveResponses[questionIndex]!.data.filter(({ content }) => content.trim())
        .slice(0, 8)
        .map((result) => evidenceItem(question.id, result, createdAt)),
    );
    questions.push(...executable);
    responses.push(...waveResponses);
    evidence.push(...waveEvidence);
    waves.push({
      waveNumber: executable[0]!.waveNumber,
      questionIds: executable.map(({ id }) => id),
      evidenceIds: deduplicateEvidence(waveEvidence).map(({ id }) => id),
      priorityGapKeys,
    });
  };
  await runWave(initialQuestions, []);
  const waveOneSummary = await (adapters.summarizeWaveOne ?? emptyWaveOneSummary)({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    target: input.target,
    evidence: deduplicateEvidence(evidence),
  });
  if (policy.maxMarketResearchWaves >= 2 && policy.normalMarketResearchWaves >= 2) {
    await runWave(
      compileMarketResearchFollowUpQuestions({
        target: input.target,
        evidence,
        waveNumber: 2,
        waveSummary: waveOneSummary,
        maximum: policy.maxQueriesPerWave,
      }),
      [],
    );
  }
  const priorityGaps = unresolvedPriorityMarketGaps(input.target, evidence);
  if (policy.maxMarketResearchWaves >= 3 && priorityGaps.length > 0) {
    await runWave(
      compileMarketResearchFollowUpQuestions({
        target: input.target,
        evidence,
        waveNumber: 3,
        priorityGapKeys: priorityGaps,
        maximum: policy.maxQueriesPerWave,
      }),
      priorityGaps,
    );
  }
  const corpus = marketEvidenceCorpusSchema.parse({
    id: adapters.id(),
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    campaignRunId: input.campaignRunId,
    campaignTargetModelVersionId: input.target.id,
    questions,
    evidence: deduplicateEvidence(evidence).slice(0, policy.maxEvidenceItems),
    waves,
    waveSummaries: [waveOneSummary],
    policy: {
      maxMarketResearchWaves: policy.maxMarketResearchWaves,
      maxQueriesPerWave: policy.maxQueriesPerWave,
      maxProviderCalls: policy.maxProviderCalls,
      maxEvidenceItems: policy.maxEvidenceItems,
      maxRuntimeMs: policy.maxRuntimeMs,
    },
    provider: "tavily",
    providerRequestIds: responses.flatMap(({ usage }) =>
      usage.providerRequestId ? [usage.providerRequestId] : [],
    ),
    providerCredits: responses.reduce(
      (total, { usage }) => total + usage.providerUnits,
      0,
    ),
    requestHash,
    createdAt,
  });
  return { corpus: await adapters.persist(corpus), cached: false as const };
}

const productionAdapters: MarketReconnaissanceAdapters = {
  findCached: loadCachedCorpus,
  search: (input) =>
    runBudgetedTavilyCall({
      workspaceId: input.workspaceId,
      campaignRunId: input.campaignRunId,
      operation: "company_research_market_reconnaissance",
      idempotencyKey: input.idempotencyKey,
      estimatedProviderCredits: 1,
      execute: () =>
        searchWebResult(input.query, 8, {
          ...(input.country ? { country: input.country } : {}),
        }),
      usage: ({ usage }) => ({
        providerCredits: usage.providerUnits,
        ...(usage.providerRequestId
          ? { providerRequestId: usage.providerRequestId }
          : {}),
      }),
    }),
  persist: persistCorpus,
  id: randomUUID,
  now: () => new Date().toISOString(),
  summarizeWaveOne: reasonAboutWaveOne,
};

async function emptyWaveOneSummary() {
  return marketResearchWaveSummarySchema.parse({
    waveNumber: 1,
    discoveredLaneHypotheses: [], strengthenedLaneHypotheses: [], weakenedLaneHypotheses: [],
    localTerminology: [], importantSourceLeads: [], scaleDriverFindings: [],
    buyingSignalFindings: [], marketStructureFindings: [], evidenceGaps: [],
    followUpQuestions: [], evidenceIds: [],
  });
}

function evidenceItem(questionId: string, result: SearchResult, retrievedAt: string) {
  return {
    id: `market-evidence.${hashCanonical({ questionId, url: result.url }).slice(0, 32)}`,
    questionId,
    sourceFamily: sourceFamily(result.url),
    url: result.url,
    title: bounded(result.title, 500),
    excerpt: bounded(result.content, 1600),
    relevanceScore: result.score,
    retrievedAt,
  };
}

function deduplicateEvidence<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter(({ url }) => {
    const key = url.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceFamily(url: string) {
  const value = url.toLowerCase();
  if (/\.gov\.|registry|register/.test(value)) return "registry" as const;
  if (/association|federation|chamber/.test(value)) return "association" as const;
  if (/news|press|journal/.test(value)) return "news" as const;
  return "web_search" as const;
}

function singleCountry(target: CampaignTargetModel) {
  return target.geography.countryCodes.length === 1 &&
    target.geography.countryCodes[0] !== "WORLDWIDE"
    ? target.geography.displayName
    : undefined;
}

function bounded(value: string, maximum: number) {
  const trimmed = value.trim();
  return trimmed.length <= maximum ? trimmed : trimmed.slice(0, maximum).trimEnd();
}

function boundedInteger(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}

type CorpusSelectBuilder = {
  eq(column: string, value: unknown): CorpusSelectBuilder;
  maybeSingle(): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

type CorpusDatabase = {
  from(table: string): {
    select(columns: string): CorpusSelectBuilder;
    insert(value: Record<string, unknown>): {
      select(columns: string): {
        single(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
};

async function loadCachedCorpus(input: {
  workspaceId: string;
  campaignRunId: string;
  requestHash: string;
}) {
  const database = createServiceRoleClient() as unknown as CorpusDatabase;
  const { data, error } = await database
    .from("market_research_executions_v2")
    .select("corpus_json")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .eq("request_hash", input.requestHash)
    .maybeSingle();
  if (error) throw new Error(`Could not inspect Market Research cache: ${error.message}`);
  if (!data) return null;
  return marketEvidenceCorpusSchema.parse((data as { corpus_json: unknown }).corpus_json);
}

async function persistCorpus(corpus: MarketEvidenceCorpus) {
  const database = createServiceRoleClient() as unknown as CorpusDatabase;
  const { data, error } = await database
    .from("market_research_executions_v2")
    .insert({
      id: corpus.id,
      workspace_id: corpus.workspaceId,
      campaign_id: corpus.campaignId,
      campaign_run_id: corpus.campaignRunId,
      campaign_target_model_version_id: corpus.campaignTargetModelVersionId,
      request_hash: corpus.requestHash,
      corpus_json: corpus as unknown as Json,
      provider: corpus.provider,
      provider_request_ids: corpus.providerRequestIds,
      provider_credits: corpus.providerCredits,
      evidence_count: corpus.evidence.length,
      created_at: corpus.createdAt,
    })
    .select("corpus_json")
    .single();
  if (error)
    throw new Error(`Could not persist Market Research corpus: ${error.message}`);
  return marketEvidenceCorpusSchema.parse((data as { corpus_json: unknown }).corpus_json);
}
