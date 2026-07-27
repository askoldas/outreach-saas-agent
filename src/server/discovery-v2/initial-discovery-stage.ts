import {
  createConfiguredDiscoveryProviderRegistry,
  type ProviderDiscoveryRequest,
} from "@/lib/discovery-v2";
import type { StageResult } from "@/lib/workflow-v2";
import { executeAndPersistDiscoveryProvider } from "./provider-service";
import { routeSemanticSegments } from "./route-segments";
import { loadInitialDiscoveryContext } from "./stage-context";

const maximumInitialProviderCalls = 12;
const maximumInitialSegments = 6;
const maximumResultsPerSegment = 25;
const normalizationVersion = "web-search-normalization-v2.0";

export async function executeInitialDiscoveryStage(input: {
  campaignRunId: string;
  workspaceId: string;
}): Promise<StageResult> {
  const context = await loadInitialDiscoveryContext(input);
  const registry = createConfiguredDiscoveryProviderRegistry();
  const enabledProviderIds = context.enabledProviderIds.filter((providerId) =>
    registry.list().some(({ id }) => id === providerId),
  );
  if (!enabledProviderIds.length)
    throw new Error("No implemented V2 discovery provider is enabled.");
  if (
    enabledProviderIds.includes("web_search") &&
    !process.env.TAVILY_API_KEY?.trim()
  )
    throw new Error(
      "V2 web discovery configuration requires the TAVILY_API_KEY environment variable.",
    );

  const selectedSegments = [...context.strategy.discoverySegments]
    .sort(
      (left, right) =>
        left.priority - right.priority || left.id.localeCompare(right.id),
    )
    .slice(0, maximumInitialSegments);
  const callsPerSegment = Math.max(
    1,
    Math.floor(maximumInitialProviderCalls / selectedSegments.length),
  );
  const discoveryPlanKey = [
    "campaign-v2",
    context.strategyVersionId,
    "initial-breadth",
  ].join(":");
  const requests: ProviderDiscoveryRequest[] = selectedSegments.map((segment) => ({
    workspaceId: input.workspaceId,
    campaignId: context.campaignInternalId,
    discoveryPlanId: discoveryPlanKey,
    segment,
    executionContext: {
      passNumber: 1,
      previousExecutionIds: [],
      excludedCanonicalKeys: [],
      previousQueryFingerprints: [],
    },
    budget: {
      maxCalls: callsPerSegment,
      maxResults: Math.min(
        maximumResultsPerSegment,
        segment.targetCandidateCount ?? maximumResultsPerSegment,
      ),
      ...(context.strategy.stoppingPolicy.maximumRunMinutes
        ? {
            deadlineAt: new Date(
              Date.parse(context.strategyConfirmedAt) +
                context.strategy.stoppingPolicy.maximumRunMinutes * 60_000,
            ).toISOString(),
          }
        : {}),
    },
  }));
  const routes = await routeSemanticSegments({
    registry,
    requests,
    enabledProviderIds,
  });
  const routeBySegment = new Map(
    routes.map((route) => [route.segmentId, route] as const),
  );
  const outcomes = await mapWithConcurrency(requests, 2, async (request) => {
    const route = routeBySegment.get(request.segment.id);
    const providerId = route?.providers[0]?.providerId;
    if (!providerId)
      throw new Error(`V2 discovery segment "${request.segment.id}" has no route.`);
    const result = await executeAndPersistDiscoveryProvider({
      provider: registry.get(providerId),
      request,
      normalizationVersion,
    });
    return {
      providerId,
      segmentId: request.segment.id,
      ...result.summary,
    };
  });

  const providerRecordCount = sum(outcomes, "providerRecordCount");
  const normalizedCandidateCount = sum(outcomes, "normalizedCandidateCount");
  const providerCallCount = outcomes.reduce(
    (total, outcome) => total + usageCalls(outcome.usage),
    0,
  );
  throwForTotalRetryableFailure(outcomes, providerRecordCount);
  return {
    stage: "discover",
    status: "partial",
    outputReferences: {
      discoveryPlanKey,
      executionIds: outcomes.map(({ executionId }) => executionId),
      cachedExecutionCount: outcomes.filter(({ cached }) => cached).length,
      omittedSegmentCount:
        context.strategy.discoverySegments.length - selectedSegments.length,
      providerCallCount,
      providerRecordCount,
      normalizedCandidateCount,
      stageScope: "initial_breadth",
    },
    progressDelta: {
      discoverySegmentsAttempted: outcomes.length,
      normalizedCandidates: normalizedCandidateCount,
      providerCalls: providerCallCount,
      providerRecords: providerRecordCount,
    },
    usageEventIds: [],
  };
}

function throwForTotalRetryableFailure(
  outcomes: Array<{ errors: unknown }>,
  providerRecordCount: number,
) {
  if (providerRecordCount > 0) return;
  const errors = outcomes.flatMap(({ errors }) =>
    Array.isArray(errors) ? errors : [],
  );
  if (
    errors.length > 0 &&
    errors.every(
      (error) =>
        Boolean(error) &&
        typeof error === "object" &&
        (error as Record<string, unknown>).retryable === true,
    )
  ) {
    throw Object.assign(
      new Error("Every V2 discovery provider call failed transiently."),
      { code: "provider_unavailable", retryable: true },
    );
  }
}

function usageCalls(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const calls = Number((value as Record<string, unknown>).calls);
  return Number.isFinite(calls) && calls >= 0 ? calls : 0;
}

function sum<T extends Record<string, unknown>>(
  values: T[],
  key: keyof T,
) {
  return values.reduce((total, value) => {
    const number = Number(value[key]);
    return total + (Number.isFinite(number) ? number : 0);
  }, 0);
}

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
