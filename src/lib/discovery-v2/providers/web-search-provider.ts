import { randomUUID } from "node:crypto";
import { searchWeb, type SearchResult } from "../../providers/tavily.ts";
import {
  providerDiscoveryRequestSchema,
  providerDiscoveryResponseSchema,
  type DiscoveryProviderCapabilities,
  type ProviderDiscoveryRequest,
} from "../contracts.ts";
import type {
  CompanyDiscoveryProvider,
  ProviderDiscoveryExecutionPlan,
} from "../provider.ts";
import {
  generateWebDiscoveryQueries,
  webDiscoveryQuerySchema,
} from "./web-query-generator.ts";
import { normalizeWebSearchResult } from "./web-normalization.ts";

type WebSearchTransport = (
  query: string,
  maxResults: number,
  options?: { includeDomains?: string[]; includeRawContent?: boolean },
) => Promise<SearchResult[]>;

export class WebSearchProvider implements CompanyDiscoveryProvider {
  readonly id = "web_search";
  readonly version = "2.0";
  readonly #transport: WebSearchTransport;
  readonly #now: () => string;
  readonly #executionId: () => string;

  constructor(
    transport: WebSearchTransport = searchWeb,
    now: () => string = () => new Date().toISOString(),
    executionId: () => string = randomUUID,
  ) {
    this.#transport = transport;
    this.#now = now;
    this.#executionId = executionId;
  }

  async getCapabilities(): Promise<DiscoveryProviderCapabilities> {
    return webSearchProviderCapabilities;
  }

  async estimate(request: ProviderDiscoveryRequest) {
    const parsed = providerDiscoveryRequestSchema.parse(request);
    const queries = generateWebDiscoveryQueries(parsed);
    const unsupportedConstraints = [
      ...(parsed.segment.businessCharacteristics.sizeRange
        ? ["employee_range_filter"]
        : []),
      ...(parsed.segment.exclusionRules.length ? ["structured_exclusion_filter"] : []),
    ];
    return {
      providerId: this.id,
      supported: queries.length > 0,
      unsupportedConstraints,
      estimatedCalls: queries.length,
      estimatedRecords: Math.min(
        parsed.budget.maxResults ?? queries.length * 5,
        queries.length * 8,
      ),
      warnings: unsupportedConstraints.map(
        (constraint) => `${constraint} requires downstream evidence evaluation.`,
      ),
    };
  }

  async search(
    request: ProviderDiscoveryRequest,
    executionPlan?: ProviderDiscoveryExecutionPlan,
  ) {
    const startedAt = Date.now();
    const parsed = providerDiscoveryRequestSchema.parse(request);
    const queries =
      executionPlan?.queries === undefined
        ? generateWebDiscoveryQueries(parsed)
        : webDiscoveryQuerySchema.array().parse(executionPlan.queries);
    if (
      queries.some(
        (query) =>
          query.campaignId !== parsed.campaignId ||
          query.discoverySegmentId !== parsed.segment.id,
      )
    ) {
      throw new Error("Frozen web discovery queries do not match the request.");
    }
    const retrievedAt = this.#now();
    const maxResults = parsed.budget.maxResults ?? 25;
    const perQuery = Math.max(
      1,
      Math.min(8, Math.ceil(maxResults / Math.max(1, queries.length))),
    );
    const outcomes = await mapWithConcurrency(queries, 3, async (query) => {
      try {
        return {
          query,
          results: await this.#transport(query.query, perQuery),
        };
      } catch (error) {
        return {
          query,
          results: [] as SearchResult[],
          error: {
            code: classifyTransportError(error),
            message: boundedMessage(error),
            retryable: isRetryableTransportError(error),
            recordReference: query.fingerprint,
          },
        };
      }
    });
    const records = [];
    const normalizedCandidates = [];
    for (const outcome of outcomes) {
      for (const [index, result] of outcome.results.entries()) {
        if (records.length >= maxResults) break;
        const normalized = normalizeWebSearchResult({
          result,
          query: outcome.query,
          rank: index + 1,
          providerVersion: this.version,
          retrievedAt,
          archetypeId: parsed.segment.archetypeId,
        });
        records.push(normalized.record);
        if (normalized.candidate) normalizedCandidates.push(normalized.candidate);
      }
    }
    const errors = outcomes.flatMap((outcome) => (outcome.error ? [outcome.error] : []));
    const retainedResultCapReached = records.length >= maxResults;
    return providerDiscoveryResponseSchema.parse({
      providerId: this.id,
      executionId: this.#executionId(),
      records,
      normalizedCandidates,
      exhausted: errors.length === 0 && !retainedResultCapReached,
      usage: {
        calls: outcomes.length,
        recordsReturned: records.length,
        runtimeMs: Math.max(0, Date.now() - startedAt),
      },
      warnings:
        records.length === 0 ? ["Web search returned no retained source records."] : [],
      errors,
    });
  }
}

export const webSearchProviderCapabilities: DiscoveryProviderCapabilities = {
  providerId: "web_search",
  providerVersion: "2.0",
  sourceTypes: ["web_search", "industry_directory"],
  supports: {
    countryFilter: true,
    regionFilter: true,
    localityFilter: true,
    languageTargeting: true,
    industryFilter: true,
    keywordFilter: true,
    companySizeFilter: false,
    employeeRangeFilter: false,
    revenueRangeFilter: false,
    technologyFilter: false,
    businessModelFilter: true,
    ownershipFilter: false,
    jobSignalFilter: false,
    fundingSignalFilter: false,
    pagination: false,
    totalCountEstimate: false,
    recordFreshness: false,
  },
  maximumPageSize: 8,
  rateLimit: { calls: 3, periodSeconds: 1 },
  costModel: { type: "unknown" },
};

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        const value = values[index];
        if (value !== undefined) results[index] = await mapper(value);
      }
    }),
  );
  return results;
}

function classifyTransportError(error: unknown) {
  const message = boundedMessage(error).toLowerCase();
  if (message.includes("timeout")) return "timeout" as const;
  if (message.includes("429") || message.includes("rate")) return "rate_limit" as const;
  return "provider_failure" as const;
}

function isRetryableTransportError(error: unknown) {
  const message = boundedMessage(error).toLowerCase();
  return /timeout|429|rate|status 5\d\d/.test(message);
}

function boundedMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
