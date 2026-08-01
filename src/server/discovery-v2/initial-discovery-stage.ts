import {
  analyzeDiscoveryGaps,
  calculateDiscoveryCoverage,
  createConfiguredDiscoveryProviderRegistry,
  decideDiscoveryContinuation,
  discoveryProviderCapabilitiesSchema,
  generateWebDiscoveryQueries,
  providerDiscoveryRequestSchema,
  webDiscoveryQuerySchema,
  type DiscoveryCoverageMetrics,
  type DiscoveryPlanV2,
  type ProviderDiscoveryRequest,
} from "@/lib/discovery-v2";
import type { StageResult } from "@/lib/workflow-v2";
import type { Json } from "@/types/database.types";
import {
  finalizeDiscoveryPass,
  freezeDiscoveryQueryPlan,
  listDiscoveryPlanSegments,
  loadCampaignDiscoveryPlan,
  loadLatestDiscoveryPassDecision,
  persistDiscoverySegmentCoverageOnce,
  recordDiscoveryQueryAudit,
  startCampaignDiscoveryRun,
  startDiscoverySegmentPassOnce,
  type CampaignDiscoveryPlanRecord,
} from "./coverage-repository";
import {
  compileAndPersistDiscoveryPlan,
  parsePersistedFrozenDiscoveryPlan,
} from "./plan-discovery";
import { reconstructSettledProviderExecution } from "./provider-coverage";
import { executeAndPersistDiscoveryProvider } from "./provider-service";
import { routeSemanticSegments } from "./route-segments";
import { prepareSemanticDiscoveryContext } from "./semantic-context";
import { loadEnabledDiscoveryProviderIds } from "./stage-context";

const maximumInitialProviderCalls = 12;
const maximumInitialSegments = 6;
const maximumResultsPerSegment = 25;
const normalizationVersion = "web-search-normalization-v2.0";
const initialPassNumber = 1;

export async function executeInitialDiscoveryStage(input: {
  campaignRunId: string;
  workspaceId: string;
}): Promise<StageResult> {
  const context = await prepareSemanticDiscoveryContext(input);
  const registry = createConfiguredDiscoveryProviderRegistry();
  const logicalPlanId = `campaign-v2:${input.campaignRunId}:semantic-discovery`;
  let plan: DiscoveryPlanV2;
  let planRecord: CampaignDiscoveryPlanRecord;
  const existingPlanRecord = await loadCampaignDiscoveryPlan({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
  });
  if (existingPlanRecord) {
    planRecord = existingPlanRecord;
    plan = parsePersistedFrozenDiscoveryPlan({
      record: existingPlanRecord,
      workspaceId: input.workspaceId,
      campaignRunId: input.campaignRunId,
    });
  } else {
    const registeredProviderIds = new Set(registry.list().map(({ id }) => id));
    const enabledProviderIds = (
      await loadEnabledDiscoveryProviderIds(input.workspaceId)
    ).filter((providerId) => registeredProviderIds.has(providerId));
    if (!enabledProviderIds.length)
      throw new Error("No implemented V2 discovery provider is enabled.");
    const initialRequests = buildRequests({
      workspaceId: input.workspaceId,
      campaignId: context.campaignInternalId,
      discoveryPlanId: logicalPlanId,
      segments: context.strategy.discoverySegments,
      maximumCalls: maximumInitialProviderCalls,
      deadlineAt: discoveryDeadline(context),
    });
    const routes = await routeSemanticSegments({
      registry,
      requests: initialRequests,
      enabledProviderIds,
    });
    const providerCapabilities = await Promise.all(
      enabledProviderIds.map(async (providerId) =>
        discoveryProviderCapabilitiesSchema.parse(
          await registry.get(providerId).getCapabilities(),
        ),
      ),
    );
    const maximumPlanProviderCalls =
      maximumInitialProviderCalls *
      context.strategy.stoppingPolicy.maximumDiscoveryPasses;
    const compiled = await compileAndPersistDiscoveryPlan({
      id: logicalPlanId,
      workspaceId: input.workspaceId,
      campaignRunId: input.campaignRunId,
      strategy: context.strategy,
      routes,
      providerCapabilities,
      versionNumber: 1,
      maximumProviderCalls: maximumPlanProviderCalls,
      ...(discoveryDeadline(context) ? { deadlineAt: discoveryDeadline(context) } : {}),
      compiledAt: context.campaignRunCreatedAt,
    });
    plan = compiled.plan;
    planRecord = compiled.record;
  }
  assertFrozenPlanContext({
    plan,
    campaignId: context.campaignInternalId,
    memorySnapshotId: context.memorySnapshot.id,
    strategyVersionId: context.strategyVersionId,
  });
  const discoveryRun = await startCampaignDiscoveryRun({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    planId: planRecord.id,
  });
  const persistedSegments = await listDiscoveryPlanSegments({
    workspaceId: input.workspaceId,
    planId: planRecord.id,
  });
  assertPersistedSegmentIdentity(
    plan.segments.map(({ id }) => id),
    persistedSegments.map(({ segment_key }) => segment_key),
  );
  const finalizedPass = await loadLatestDiscoveryPassDecision({
    workspaceId: input.workspaceId,
    runId: discoveryRun.id,
  });
  if (finalizedPass) {
    return {
      stage: "discover",
      status: "partial",
      outputReferences: {
        memorySnapshotId: context.memorySnapshot.id,
        discoveryPlanId: planRecord.id,
        discoveryRunId: discoveryRun.id,
        passNumber: finalizedPass.pass_number,
        continuationDecision: finalizedPass.decision_json,
        stageScope: "persisted_semantic_discovery",
      },
      progressDelta: {
        discoveryPasses: finalizedPass.pass_number,
        normalizedCandidates: jsonSummaryCount(
          finalizedPass.usage_summary_json,
          "normalizedProviderCandidates",
        ),
        providerCalls: jsonSummaryCount(
          finalizedPass.usage_summary_json,
          "providerCalls",
        ),
        providerRecords: jsonSummaryCount(
          finalizedPass.usage_summary_json,
          "providerRecordsRetrieved",
        ),
      },
      usageEventIds: [],
    };
  }

  const segmentRuns = await mapWithConcurrency(persistedSegments, 4, async (segment) => ({
    segmentKey: segment.segment_key,
    segmentRun: await startDiscoverySegmentPassOnce({
      workspaceId: input.workspaceId,
      runId: discoveryRun.id,
      segmentId: segment.id,
      passNumber: initialPassNumber,
      gapKeys: [],
    }),
  }));
  const segmentRunByKey = new Map(
    segmentRuns.map(({ segmentKey, segmentRun }) => [segmentKey, segmentRun]),
  );
  const selectedSegments = [...plan.segments]
    .sort(
      (left, right) => left.priority - right.priority || compareText(left.id, right.id),
    )
    .slice(0, maximumInitialSegments);
  if (!selectedSegments.length)
    throw new Error("Semantic Discovery Plan contains no executable segments.");
  const executionRequests = buildRequests({
    workspaceId: input.workspaceId,
    campaignId: context.campaignInternalId,
    discoveryPlanId: planRecord.id,
    segments: selectedSegments,
    maximumCalls: maximumInitialProviderCalls,
    ...(plan.budgetPolicy.deadlineAt ? { deadlineAt: plan.budgetPolicy.deadlineAt } : {}),
  });
  const routeBySegment = new Map(
    plan.routes.map((route) => [route.segmentId, route] as const),
  );
  const frozenCapabilityByProvider = new Map(
    plan.providerCapabilities.map((entry) => [entry.providerId, entry] as const),
  );
  const registeredProviderById = new Map(
    registry.list().map((provider) => [provider.id, provider] as const),
  );
  const outcomes = await mapWithConcurrency(executionRequests, 2, async (request) => {
    const segmentRun = segmentRunByKey.get(request.segment.id);
    if (!segmentRun)
      throw new Error(
        `V2 discovery segment "${request.segment.id}" has no durable pass.`,
      );
    const providerId = routeBySegment.get(request.segment.id)?.providers[0]?.providerId;
    if (!providerId)
      throw new Error(
        `V2 discovery segment "${request.segment.id}" has no frozen route.`,
      );
    const frozenCapabilities = frozenCapabilityByProvider.get(providerId);
    if (!frozenCapabilities) {
      throw new Error(
        `V2 discovery provider "${providerId}" has no frozen capability snapshot.`,
      );
    }
    const proposedQueries =
      providerId === "web_search" ? generateWebDiscoveryQueries(request) : [];
    const queryPlan = await freezeDiscoveryQueryPlan({
      workspaceId: input.workspaceId,
      segmentRunId: segmentRun.id,
      providerId,
      providerVersion: frozenCapabilities.providerVersion,
      request,
      queries: proposedQueries,
    });
    const frozenRequest = providerDiscoveryRequestSchema.parse(queryPlan.request_json);
    const queries = webDiscoveryQuerySchema.array().parse(queryPlan.queries_json);
    const result = await executeAndPersistDiscoveryProvider({
      provider: registeredProviderById.get(providerId),
      providerId,
      providerVersion: frozenCapabilities.providerVersion,
      frozenCapabilities: frozenCapabilities.capabilities,
      frozenCapabilitiesHash: frozenCapabilities.contentHash,
      request: frozenRequest,
      executionPlan: { queries },
      normalizationVersion,
      assertConfigured: () => {
        if (providerId === "web_search" && !process.env.TAVILY_API_KEY?.trim()) {
          throw new Error(
            "V2 web discovery configuration requires the TAVILY_API_KEY environment variable.",
          );
        }
      },
    });
    const reconstructed = reconstructSettledProviderExecution({
      queries,
      execution: result.summary,
    });
    await recordDiscoveryQueryAudit({
      workspaceId: input.workspaceId,
      providerExecutionId: result.summary.executionId,
      segmentRunId: segmentRun.id,
      queries: reconstructed.queryAuditRecords as unknown as Json,
    });
    return {
      cached: result.cached,
      completedAt: result.summary.completedAt,
      coverageFacts: reconstructed.coverageFacts,
      errors: result.summary.errors,
      executionId: result.summary.executionId,
      providerId,
      segmentId: frozenRequest.segment.id,
    };
  });

  const outcomeBySegment = new Map(
    outcomes.map((outcome) => [outcome.segmentId, outcome] as const),
  );
  const providerCallCount = outcomes.reduce(
    (total, { coverageFacts }) => total + coverageFacts.providerCalls,
    0,
  );
  const providerRecordCount = outcomes.reduce(
    (total, { coverageFacts }) => total + coverageFacts.rawRecords,
    0,
  );
  const normalizedCandidateCount = outcomes.reduce(
    (total, { coverageFacts }) => total + coverageFacts.normalizedCandidates,
    0,
  );
  const remainingCallBudget = Math.max(
    0,
    plan.budgetPolicy.maximumProviderCalls - providerCallCount,
  );
  const coverageResults = plan.segments.map((segment) => {
    const outcome = outcomeBySegment.get(segment.id);
    const metrics = buildCoverageMetrics({
      campaignId: context.campaignInternalId,
      segment,
      outcome,
      updatedAt: outcome?.completedAt ?? context.campaignRunCreatedAt,
    });
    const coverage = calculateDiscoveryCoverage(metrics);
    const gaps = analyzeDiscoveryGaps({
      cell: coverage,
      metrics,
      remainingCallBudget,
    });
    return { coverage, gaps, segment };
  });
  const coverageCells = coverageResults.map(({ coverage }) => coverage);
  const discoveryGaps = coverageResults.flatMap(({ gaps }) => gaps);
  const uniqueCandidateHintCount = new Set(
    outcomes.flatMap(({ coverageFacts }) => coverageFacts.candidateIdentityHints),
  ).size;
  const requestedCandidateCount =
    context.strategy.coverageTarget.minimumUniqueCandidates ??
    Math.max(
      1,
      plan.segments.reduce(
        (total, segment) => total + (segment.targetCandidateCount ?? 0),
        0,
      ),
    );
  const fatalProviderFailure =
    outcomes.length > 0 &&
    providerRecordCount === 0 &&
    outcomes.every(({ coverageFacts }) => coverageFacts.providerFailureCount > 0);
  const decision = decideDiscoveryContinuation({
    cells: coverageCells,
    gaps: discoveryGaps,
    requestedCandidateCount,
    currentCandidateCount: uniqueCandidateHintCount,
    remainingCalls: remainingCallBudget,
    deadlineReached: deadlineReached(
      plan.budgetPolicy.deadlineAt,
      outcomes.map(({ completedAt }) => completedAt),
    ),
    userState: "running",
    fatalProviderFailure,
    passNumber: initialPassNumber,
    maximumPasses: plan.stoppingPolicy.maximumDiscoveryPasses,
    consecutiveLowYieldPasses: 0,
    maximumConsecutiveLowYieldPasses: 2,
  });
  if (fatalProviderFailure) {
    const providerErrors = [
      ...new Set(
        outcomes.flatMap(({ errors }) =>
          providerErrorMessages(errors),
        ),
      ),
    ].slice(0, 3);
    if (providerErrors.length) {
      decision.rationale = `No provider returned source records. ${providerErrors.join(
        " ",
      )}`;
    }
  }
  const coverageSnapshots = await mapWithConcurrency(
    coverageResults,
    4,
    async ({ coverage, gaps, segment }) => {
      const segmentRun = segmentRunByKey.get(segment.id);
      if (!segmentRun)
        throw new Error(`V2 discovery segment "${segment.id}" lost its durable pass.`);
      const snapshot = await persistDiscoverySegmentCoverageOnce({
        workspaceId: input.workspaceId,
        runId: discoveryRun.id,
        segmentRunId: segmentRun.id,
        coverage: coverage as unknown as Json,
        gaps: gaps as unknown as Json,
      });
      return {
        coverageSnapshotId: snapshot.id,
        segmentId: segment.id,
        segmentRunId: segmentRun.id,
      };
    },
  );
  const coverageSummary = {
    schemaVersion: 2,
    passNumber: initialPassNumber,
    cells: coverageCells,
    gaps: discoveryGaps,
    omittedInitialBreadthSegmentCount: plan.segments.length - selectedSegments.length,
  };
  const usageSummary = {
    providerCalls: providerCallCount,
    providerRecordsRetrieved: providerRecordCount,
    normalizedProviderCandidates: normalizedCandidateCount,
    uniqueCandidateGroups: uniqueCandidateHintCount,
    canonicalOrganizations: 0,
    candidatesPrefiltered: 0,
    candidatesResearched: 0,
    candidatesEvaluated: 0,
    eligibleCandidates: 0,
    recommendedCandidates: 0,
    conditionalCandidates: 0,
    researchNeededCandidates: 0,
    rejectedCandidates: 0,
    excludedCandidates: 0,
    invalidEntities: coverageCells.reduce(
      (total, { invalidRecordCount }) => total + invalidRecordCount,
      0,
    ),
    duplicatesOrMergedEntities: Math.max(
      0,
      normalizedCandidateCount - uniqueCandidateHintCount,
    ),
  };
  await finalizeDiscoveryPass({
    workspaceId: input.workspaceId,
    runId: discoveryRun.id,
    passNumber: initialPassNumber,
    expectedSegmentRunIds: coverageSnapshots.map(({ segmentRunId }) => segmentRunId),
    coverageSummary: coverageSummary as unknown as Json,
    usageSummary: usageSummary as unknown as Json,
    decision: decision as unknown as Json,
  });

  return {
    stage: "discover",
    status: "partial",
    outputReferences: {
      memorySnapshotId: context.memorySnapshot.id,
      discoveryPlanId: planRecord.id,
      discoveryRunId: discoveryRun.id,
      passNumber: initialPassNumber,
      segmentRuns: coverageSnapshots,
      executionIds: outcomes.map(({ executionId }) => executionId),
      cachedExecutionCount: outcomes.filter(({ cached }) => cached).length,
      omittedSegmentCount: plan.segments.length - selectedSegments.length,
      providerCallCount,
      providerRecordCount,
      normalizedCandidateCount,
      uniqueCandidateHintCount,
      continuationDecision: decision,
      stageScope: "initial_semantic_breadth",
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

function buildRequests(input: {
  workspaceId: string;
  campaignId: string;
  discoveryPlanId: string;
  segments: ProviderDiscoveryRequest["segment"][];
  maximumCalls: number;
  deadlineAt?: string;
}): ProviderDiscoveryRequest[] {
  if (!input.segments.length) return [];
  const callsPerSegment = Math.max(
    1,
    Math.floor(
      input.maximumCalls / Math.min(input.segments.length, maximumInitialSegments),
    ),
  );
  return input.segments.map((segment) => ({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    discoveryPlanId: input.discoveryPlanId,
    segment,
    executionContext: {
      passNumber: initialPassNumber,
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
      ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}),
    },
  }));
}

export function buildCoverageMetrics(input: {
  campaignId: string;
  segment: ProviderDiscoveryRequest["segment"];
  outcome:
    | {
        coverageFacts: ReturnType<
          typeof reconstructSettledProviderExecution
        >["coverageFacts"];
      }
    | undefined;
  updatedAt: string;
}): DiscoveryCoverageMetrics {
  const facts = input.outcome?.coverageFacts ?? {
    candidateIdentityHints: [],
    invalidRecordCount: 0,
    languagesAttempted: [],
    normalizedCandidates: 0,
    providerCalls: 0,
    providerExhausted: false,
    providerFailureCount: 0,
    queriesExecuted: 0,
    queryFamiliesAttempted: [],
    rawRecords: 0,
    sourceTypesAttempted: [],
    uniqueCandidateHints: 0,
  };
  const expectedQueries = generateWebDiscoveryQueries({
    workspaceId: "coverage",
    campaignId: input.campaignId,
    discoveryPlanId: "coverage",
    segment: input.segment,
    executionContext: {
      passNumber: initialPassNumber,
      previousExecutionIds: [],
      excludedCanonicalKeys: [],
      previousQueryFingerprints: [],
    },
    budget: { maxCalls: 10 },
  });
  return {
    campaignId: input.campaignId,
    discoverySegmentId: input.segment.id,
    archetypeId: input.segment.archetypeId,
    geographyKey: [...input.segment.geography.countryCodes].sort().join("+"),
    providerCalls: facts.providerCalls,
    queriesExecuted: facts.queriesExecuted,
    queryFamiliesAttempted: facts.queryFamiliesAttempted,
    expectedQueryFamilies: [
      ...new Set(expectedQueries.map(({ family }) => family)),
    ].sort(),
    rawRecords: facts.rawRecords,
    normalizedCandidates: facts.normalizedCandidates,
    uniqueCandidateHints: facts.uniqueCandidateHints,
    invalidRecordCount: facts.invalidRecordCount,
    sourceTypesAttempted: facts.sourceTypesAttempted,
    languagesAttempted: facts.languagesAttempted,
    expectedLocalLanguages: sortedUnique(
      expectedQueries
        .filter(({ family }) => family === "local_language")
        .map(({ language }) => language),
    ),
    ...(input.segment.targetCandidateCount
      ? { targetUniqueCandidates: input.segment.targetCandidateCount }
      : {}),
    providerFailureCount: facts.providerFailureCount,
    providerExhausted: facts.providerExhausted,
    updatedAt: input.updatedAt,
  };
}

function discoveryDeadline(context: {
  campaignRunCreatedAt: string;
  strategy: {
    stoppingPolicy: { maximumRunMinutes?: number };
  };
}) {
  const maximumRunMinutes = context.strategy.stoppingPolicy.maximumRunMinutes;
  if (!maximumRunMinutes) return undefined;
  return new Date(
    Date.parse(context.campaignRunCreatedAt) + maximumRunMinutes * 60_000,
  ).toISOString();
}

export function deadlineReached(deadlineAt: string | undefined, completedAt: string[]) {
  if (!deadlineAt || !completedAt.length) return false;
  return Math.max(...completedAt.map(Date.parse)) >= Date.parse(deadlineAt);
}

function assertPersistedSegmentIdentity(
  plannedSegmentKeys: string[],
  persistedSegmentKeys: string[],
) {
  const planned = [...plannedSegmentKeys].sort();
  const persisted = [...persistedSegmentKeys].sort();
  if (
    planned.length !== persisted.length ||
    planned.some((key, index) => key !== persisted[index])
  ) {
    throw new Error("Persisted Semantic Discovery segment identity mismatch.");
  }
}

function assertFrozenPlanContext(input: {
  plan: DiscoveryPlanV2;
  campaignId: string;
  memorySnapshotId: string;
  strategyVersionId: string;
}) {
  if (
    input.plan.campaignId !== input.campaignId ||
    input.plan.memorySnapshotId !== input.memorySnapshotId ||
    input.plan.campaignStrategyVersionId !== input.strategyVersionId
  ) {
    throw new Error("Frozen Semantic Discovery Plan does not match its Campaign Run.");
  }
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function jsonSummaryCount(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const count = Number((value as Record<string, unknown>)[key]);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function providerErrorMessages(value: Json) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const message = entry.message;
    return typeof message === "string" && message.trim() ? [message.trim()] : [];
  });
}

export async function mapWithConcurrency<T, R>(
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
