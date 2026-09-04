import { randomUUID } from "node:crypto";
import {
  compileMarketResearchQuestions,
  marketEvidenceCorpusSchema,
  marketResearchRequestHash,
  type CampaignTargetModel,
  type MarketEvidenceCorpus,
} from "@/lib/intelligence/core";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { searchWebResult, type SearchResult } from "@/lib/providers/tavily";
import { runBudgetedTavilyCall } from "@/server/credits/budgeted-tavily-call";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

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
};

export async function executeMarketReconnaissance(
  input: {
    workspaceId: string;
    campaignId: string;
    campaignRunId: string;
    target: CampaignTargetModel;
  },
  adapters: MarketReconnaissanceAdapters = productionAdapters,
) {
  const questions = compileMarketResearchQuestions(input.target);
  const requestHash = marketResearchRequestHash({ target: input.target, questions });
  const cached = await adapters.findCached({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    requestHash,
  });
  if (cached) return { corpus: cached, cached: true as const };

  assertIntelligenceExternalCallsAllowed("provider");
  const responses = await Promise.all(
    questions.map((question) =>
      adapters.search({
        workspaceId: input.workspaceId,
        campaignRunId: input.campaignRunId,
        idempotencyKey: `market-reconnaissance:${input.campaignRunId}:${hashCanonical(question).slice(0, 16)}`,
        query: question.query,
        ...(singleCountry(input.target) ? { country: singleCountry(input.target) } : {}),
      }),
    ),
  );
  const createdAt = adapters.now();
  const evidence = questions.flatMap((question, questionIndex) =>
    responses[questionIndex]!.data.filter(({ content }) => content.trim())
      .slice(0, 8)
      .map((result) => evidenceItem(question.id, result, createdAt)),
  );
  const corpus = marketEvidenceCorpusSchema.parse({
    id: adapters.id(),
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    campaignRunId: input.campaignRunId,
    campaignTargetModelVersionId: input.target.id,
    questions,
    evidence: deduplicateEvidence(evidence).slice(0, 30),
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
};

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
