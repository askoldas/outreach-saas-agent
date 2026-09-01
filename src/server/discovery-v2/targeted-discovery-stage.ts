import {
  analyzeDiscoveryGaps,
  calculateDiscoveryCoverage,
  createConfiguredDiscoveryProviderRegistry,
  decideDiscoveryContinuation,
  discoveryProviderCapabilitiesSchema,
  generateWebDiscoveryQueries,
  providerDiscoveryRequestSchema,
  webDiscoveryQuerySchema,
  type DiscoveryPlanV2,
  type ProviderDiscoveryRequest,
  type SelectedDiscoveryGapAction,
} from "@/lib/discovery-v2";
import type { StageResult } from "@/lib/workflow-v2";
import type { Json } from "@/types/database.types";
import {
  completeTargetedDiscoverySegmentPass,
  finalizeTargetedDiscoveryPass,
  freezeDiscoveryQueryPlan,
  listDiscoveryPlanSegments,
  loadCampaignDiscoveryPlan,
  loadCampaignDiscoveryRun,
  loadDiscoveryGapsByKeys,
  loadLatestDiscoveryPassDecision,
  persistDiscoverySegmentCoverageOnce,
  recordDiscoveryQueryAudit,
  startTargetedDiscoveryPass,
  type CampaignDiscoveryPlanRecord,
  type CampaignDiscoveryRunRecord,
  type DiscoveryPassDecisionRecord,
  type DiscoveryPlanSegmentRecord,
} from "./coverage-repository";
import { loadDiscoverySegmentHistory } from "./discovery-history";
import {
  buildCoverageMetrics,
  deadlineReached,
  executeInitialDiscoveryStage,
  mapWithConcurrency,
} from "./initial-discovery-stage";
import { parsePersistedFrozenDiscoveryPlan } from "./plan-discovery";
import { reconstructSettledProviderExecution } from "./provider-coverage";
import { executeAndPersistDiscoveryProvider } from "./provider-service";
import { prepareSemanticDiscoveryContext } from "./semantic-context";

const maximumResultsPerTargetedSegment = 25;
const normalizationVersion = "web-search-normalization-v3.1-source-expansion";

export async function executeSemanticDiscoveryStage(input: {
  campaignRunId: string;
  workspaceId: string;
}): Promise<StageResult> {
  await executeInitialDiscoveryStage(input);
  const context = await prepareSemanticDiscoveryContext(input);
  const planRecord = await loadCampaignDiscoveryPlan(input);
  if (!planRecord) {
    throw new Error("Semantic Discovery Plan disappeared after its initial pass.");
  }
  const plan = parsePersistedFrozenDiscoveryPlan({
    record: planRecord,
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
  });
  const discoveryRun = await loadCampaignDiscoveryRun(input);
  if (!discoveryRun || discoveryRun.discovery_plan_id !== planRecord.id) {
    throw new Error("Semantic Discovery Run does not match its frozen Plan.");
  }
  const persistedSegments = await listDiscoveryPlanSegments({
    workspaceId: input.workspaceId,
    planId: planRecord.id,
  });
  assertSegmentIdentity(plan, persistedSegments);

  let latestDecision = await loadLatestDiscoveryPassDecision({
    workspaceId: input.workspaceId,
    runId: discoveryRun.id,
  });
  if (!latestDecision) {
    throw new Error("Semantic Discovery initial pass has no durable decision.");
  }

  // One concrete search pass per Company Research cycle. Returning control here lets
  // entity resolution, research, evaluation, and newly learned market signals change
  // the next persisted search direction instead of completing a fixed query batch.
  if (latestDecision.decision_json.decision === "continue") {
    latestDecision = await executeTargetedPass({
      context,
      discoveryRun,
      latestDecision,
      persistedSegments,
      plan,
      planRecord,
      workspaceId: input.workspaceId,
    });
  }

  const refreshedRun = await loadCampaignDiscoveryRun(input);
  if (!refreshedRun) {
    throw new Error("Semantic Discovery Run disappeared after finalization.");
  }
  return finalStageResult({
    memorySnapshotId: context.memorySnapshot.id,
    planRecord,
    run: refreshedRun,
    decision: latestDecision,
  });
}

async function executeTargetedPass(input: {
  context: Awaited<ReturnType<typeof prepareSemanticDiscoveryContext>>;
  discoveryRun: CampaignDiscoveryRunRecord;
  latestDecision: DiscoveryPassDecisionRecord;
  persistedSegments: DiscoveryPlanSegmentRecord[];
  plan: DiscoveryPlanV2;
  planRecord: CampaignDiscoveryPlanRecord;
  workspaceId: string;
}): Promise<DiscoveryPassDecisionRecord> {
  const passNumber = input.latestDecision.pass_number + 1;
  if (passNumber > input.plan.stoppingPolicy.maximumDiscoveryPasses) {
    throw new Error("Targeted Discovery attempted to exceed its frozen pass ceiling.");
  }
  const actionPlans = input.latestDecision.decision_json.selectedActionPlans;
  if (!actionPlans.length) {
    throw new Error("Targeted Discovery continuation has no frozen action-plan details.");
  }

  const gapRows = await loadDiscoveryGapsByKeys({
    workspaceId: input.workspaceId,
    runId: input.discoveryRun.id,
    gapKeys: actionPlans.map(({ gapId }) => gapId),
  });
  const gapByKey = new Map(gapRows.map((gap) => [gap.gap_key, gap] as const));
  if (
    new Set(actionPlans.map(({ gapId }) => gapId)).size !== gapByKey.size ||
    gapRows.some(({ status }) => !["open", "addressing"].includes(status))
  ) {
    throw new Error("Targeted Discovery continuation references stale gaps.");
  }

  const actionsBySegmentId = new Map<string, SelectedDiscoveryGapAction[]>();
  for (const action of actionPlans) {
    const gap = gapByKey.get(action.gapId);
    if (!gap?.discovery_segment_id) {
      throw new Error(
        `Targeted Discovery gap "${action.gapId}" has no executable Segment.`,
      );
    }
    const existing = actionsBySegmentId.get(gap.discovery_segment_id) ?? [];
    existing.push(action);
    actionsBySegmentId.set(gap.discovery_segment_id, existing);
  }
  const segmentByDatabaseId = new Map(
    input.persistedSegments.map((segment) => [segment.id, segment] as const),
  );
  const planSegmentByKey = new Map(
    input.plan.segments.map((segment) => [segment.id, segment] as const),
  );
  const batches = [...actionsBySegmentId.entries()]
    .map(([segmentId, actions]) => {
      const persistedSegment = segmentByDatabaseId.get(segmentId);
      const segment = persistedSegment
        ? planSegmentByKey.get(persistedSegment.segment_key)
        : undefined;
      if (!persistedSegment || !segment) {
        throw new Error("Targeted Discovery action references an unknown Segment.");
      }
      return {
        segment,
        persistedSegment,
        actions: [...actions].sort(compareSelectedActions),
      };
    })
    .sort(
      (left, right) =>
        left.persistedSegment.priority - right.persistedSegment.priority ||
        compareText(
          left.persistedSegment.segment_key,
          right.persistedSegment.segment_key,
        ),
    );

  const priorHistories = await loadAllSegmentHistories({
    workspaceId: input.workspaceId,
    runId: input.discoveryRun.id,
    persistedSegments: input.persistedSegments,
    maximumPassNumber: passNumber - 1,
  });
  const priorProviderCalls = totalProviderCalls(priorHistories);
  const priorPlausibleCandidateHints = globalPlausibleCandidateHints(priorHistories);
  const remainingBeforePass = Math.max(
    0,
    input.plan.budgetPolicy.maximumProviderCalls - priorProviderCalls,
  );
  const allocatedCalls = batches.reduce(
    (total, batch) =>
      total +
      batch.actions.reduce((batchTotal, action) => {
        return batchTotal + (action.maxCalls ?? 1);
      }, 0),
    0,
  );
  if (allocatedCalls > remainingBeforePass) {
    throw new Error("Targeted Discovery actions exceed the remaining call budget.");
  }

  const segmentRuns = await startTargetedDiscoveryPass({
    workspaceId: input.workspaceId,
    runId: input.discoveryRun.id,
    passNumber,
    batches: batches.map((batch) => ({
      segmentId: batch.persistedSegment.id,
      actions: batch.actions,
    })),
  });
  const segmentRunById = new Map(
    segmentRuns.map((segmentRun) => [segmentRun.segmentId, segmentRun] as const),
  );
  const registry = createConfiguredDiscoveryProviderRegistry();
  const registeredProviderById = new Map(
    registry.list().map((provider) => [provider.id, provider] as const),
  );
  const routeBySegment = new Map(
    input.plan.routes.map((route) => [route.segmentId, route] as const),
  );
  const frozenCapabilityByProvider = new Map(
    input.plan.providerCapabilities.map(
      (capability) => [capability.providerId, capability] as const,
    ),
  );

  const outcomes = await mapWithConcurrency(batches, 2, async (batch) => {
    const durablePass = segmentRunById.get(batch.persistedSegment.id);
    if (!durablePass) {
      throw new Error(
        `Targeted Discovery Segment "${batch.segment.id}" has no durable pass.`,
      );
    }
    const history = priorHistories.get(batch.persistedSegment.id);
    if (!history) {
      throw new Error(
        `Targeted Discovery Segment "${batch.segment.id}" lost its history.`,
      );
    }
    const providerId = selectTargetedProvider({
      route: routeBySegment.get(batch.segment.id),
      previousProviderIds: history.previousProviderIds,
      actions: batch.actions,
    });
    const frozenCapabilities = frozenCapabilityByProvider.get(providerId);
    if (!frozenCapabilities) {
      throw new Error(
        `Targeted Discovery provider "${providerId}" has no frozen capabilities.`,
      );
    }
    const request = targetedRequest({
      workspaceId: input.workspaceId,
      campaignId: input.context.campaignInternalId,
      discoveryPlanId: input.planRecord.id,
      segment: batch.segment,
      actions: batch.actions,
      passNumber,
      history,
      deadlineAt: input.plan.budgetPolicy.deadlineAt,
    });
    const proposedQueries =
      providerId === "web_search" ? generateWebDiscoveryQueries(request) : [];
    const queryPlan = await freezeDiscoveryQueryPlan({
      workspaceId: input.workspaceId,
      segmentRunId: durablePass.segmentRunId,
      providerId,
      providerVersion: frozenCapabilities.providerVersion,
      request,
      queries: proposedQueries,
    });
    const frozenRequest = providerDiscoveryRequestSchema.parse(queryPlan.request_json);
    const queries = webDiscoveryQuerySchema.array().parse(queryPlan.queries_json);
    const result = await executeAndPersistDiscoveryProvider({
      campaignRunId: input.context.campaignRunId,
      provider: registeredProviderById.get(providerId),
      providerId,
      providerVersion: frozenCapabilities.providerVersion,
      frozenCapabilities: discoveryProviderCapabilitiesSchema.parse(
        frozenCapabilities.capabilities,
      ),
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
      segmentRunId: durablePass.segmentRunId,
      queries: reconstructed.queryAuditRecords as unknown as Json,
    });
    return {
      cached: result.cached,
      completedAt: result.summary.completedAt,
      coverageFacts: reconstructed.coverageFacts,
      executionId: result.summary.executionId,
      persistedSegmentId: batch.persistedSegment.id,
      segmentId: batch.segment.id,
      segmentRunId: durablePass.segmentRunId,
    };
  });

  const currentHistories = await loadAllSegmentHistories({
    workspaceId: input.workspaceId,
    runId: input.discoveryRun.id,
    persistedSegments: input.persistedSegments,
    maximumPassNumber: passNumber,
  });
  const totalCalls = totalProviderCalls(currentHistories);
  const remainingCalls = Math.max(
    0,
    input.plan.budgetPolicy.maximumProviderCalls - totalCalls,
  );
  const coverageResults = input.plan.segments.map((segment) => {
    const persistedSegment = input.persistedSegments.find(
      ({ segment_key }) => segment_key === segment.id,
    );
    if (!persistedSegment) {
      throw new Error(`Semantic Discovery Segment "${segment.id}" is not persisted.`);
    }
    const history = currentHistories.get(persistedSegment.id);
    if (!history) {
      throw new Error(`Semantic Discovery Segment "${segment.id}" has no history.`);
    }
    const metrics = buildCoverageMetrics({
      campaignId: input.context.campaignInternalId,
      segment,
      outcome: { coverageFacts: history.coverageFacts },
      updatedAt: history.completedAt ?? input.context.campaignRunCreatedAt,
    });
    const coverage = calculateDiscoveryCoverage(metrics);
    const gaps = analyzeDiscoveryGaps({
      cell: coverage,
      metrics,
      remainingCallBudget: remainingCalls,
    });
    return { coverage, gaps, persistedSegment, segment };
  });
  const coverageByPersistedSegmentId = new Map(
    coverageResults.map((result) => [result.persistedSegment.id, result] as const),
  );
  const outcomeByPersistedSegmentId = new Map(
    outcomes.map((outcome) => [outcome.persistedSegmentId, outcome] as const),
  );

  const coverageSnapshots = await mapWithConcurrency(batches, 4, async (batch) => {
    const result = coverageByPersistedSegmentId.get(batch.persistedSegment.id);
    const outcome = outcomeByPersistedSegmentId.get(batch.persistedSegment.id);
    const durablePass = segmentRunById.get(batch.persistedSegment.id);
    if (!result || !outcome || !durablePass) {
      throw new Error(`Targeted Discovery Segment "${batch.segment.id}" cannot settle.`);
    }
    const snapshot = await persistDiscoverySegmentCoverageOnce({
      workspaceId: input.workspaceId,
      runId: input.discoveryRun.id,
      segmentRunId: durablePass.segmentRunId,
      coverage: result.coverage as unknown as Json,
      gaps: result.gaps as unknown as Json,
    });
    await completeTargetedDiscoverySegmentPass({
      workspaceId: input.workspaceId,
      segmentRunId: durablePass.segmentRunId,
      outcome: {
        executionIds: [outcome.executionId],
        providerCalls: outcome.coverageFacts.providerCalls,
        remainingGapIds: result.gaps.map(({ id }) => id).sort(compareText),
      },
    });
    return {
      coverageSnapshotId: snapshot.id,
      segmentId: batch.segment.id,
      segmentRunId: durablePass.segmentRunId,
    };
  });

  const plausibleCandidateHints = globalPlausibleCandidateHints(currentHistories);
  const passProviderCalls = Math.max(0, totalCalls - priorProviderCalls);
  const passUniqueCandidates = Math.max(
    0,
    plausibleCandidateHints.size - priorPlausibleCandidateHints.size,
  );
  const marginalUniqueYieldPerCall =
    passProviderCalls > 0 ? passUniqueCandidates / passProviderCalls : 0;
  const priorLowYieldPasses = jsonInteger(
    input.latestDecision.coverage_summary_json,
    "consecutiveLowYieldPasses",
  );
  const consecutiveLowYieldPasses =
    passProviderCalls === 0 || marginalUniqueYieldPerCall < 0.5
      ? priorLowYieldPasses + 1
      : 0;
  const fatalProviderFailure =
    outcomes.length > 0 &&
    outcomes.every(
      ({ coverageFacts }) =>
        coverageFacts.rawRecords === 0 && coverageFacts.providerFailureCount > 0,
    );
  const gaps = coverageResults.flatMap((result) => result.gaps);
  const decision = decideDiscoveryContinuation({
    cells: coverageResults.map(({ coverage }) => coverage),
    gaps,
    remainingCalls,
    deadlineReached: deadlineReached(
      input.plan.budgetPolicy.deadlineAt,
      outcomes.map(({ completedAt }) => completedAt),
    ),
    userState: "running",
    fatalProviderFailure,
    passNumber,
    maximumPasses: input.plan.stoppingPolicy.maximumDiscoveryPasses,
    consecutiveLowYieldPasses,
    maximumConsecutiveLowYieldPasses: 2,
  });
  const usageSummary = buildUsageSummary(currentHistories);
  const coverageSummary = {
    schemaVersion: 3,
    passNumber,
    cells: coverageResults.map(({ coverage }) => coverage),
    gaps,
    passProviderCalls,
    passUniqueCandidates,
    marginalUniqueYieldPerCall,
    consecutiveLowYieldPasses,
  };
  await finalizeTargetedDiscoveryPass({
    workspaceId: input.workspaceId,
    runId: input.discoveryRun.id,
    passNumber,
    expectedSegmentRunIds: coverageSnapshots.map(({ segmentRunId }) => segmentRunId),
    coverageSummary: coverageSummary as unknown as Json,
    usageSummary: usageSummary as unknown as Json,
    decision: decision as unknown as Json,
  });
  const persistedDecision = await loadLatestDiscoveryPassDecision({
    workspaceId: input.workspaceId,
    runId: input.discoveryRun.id,
  });
  if (!persistedDecision || persistedDecision.pass_number !== passNumber) {
    throw new Error("Targeted Discovery pass decision was not durably persisted.");
  }
  return persistedDecision;
}

function targetedRequest(input: {
  workspaceId: string;
  campaignId: string;
  discoveryPlanId: string;
  segment: ProviderDiscoveryRequest["segment"];
  actions: SelectedDiscoveryGapAction[];
  passNumber: number;
  history: Awaited<ReturnType<typeof loadDiscoverySegmentHistory>>;
  deadlineAt?: string;
}) {
  const maxCalls = input.actions.reduce(
    (total, action) => total + (action.maxCalls ?? 1),
    0,
  );
  return providerDiscoveryRequestSchema.parse({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    discoveryPlanId: input.discoveryPlanId,
    segment: input.segment,
    executionContext: {
      passNumber: input.passNumber,
      gapId: input.actions[0]?.gapId,
      previousExecutionIds: input.history.executionIds,
      excludedCanonicalKeys: input.history.coverageFacts.candidateIdentityHints,
      previousQueryFingerprints: input.history.previousQueryFingerprints,
      targetedActions: input.actions,
    },
    budget: {
      maxCalls,
      maxResults: maximumResultsPerTargetedSegment,
      ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}),
    },
  });
}

function selectTargetedProvider(input: {
  route: DiscoveryPlanV2["routes"][number] | undefined;
  previousProviderIds: string[];
  actions: SelectedDiscoveryGapAction[];
}) {
  if (!input.route?.providers.length) {
    throw new Error("Targeted Discovery Segment has no frozen provider route.");
  }
  const activateAlternative = input.actions.some(
    ({ type }) => type === "activate_provider",
  );
  const alternative = activateAlternative
    ? input.route.providers.find(
        ({ providerId }) => !input.previousProviderIds.includes(providerId),
      )
    : undefined;
  return (alternative ?? input.route.providers[0])!.providerId;
}

async function loadAllSegmentHistories(input: {
  workspaceId: string;
  runId: string;
  persistedSegments: DiscoveryPlanSegmentRecord[];
  maximumPassNumber: number;
}) {
  const histories = await mapWithConcurrency(
    input.persistedSegments,
    4,
    async (segment) => ({
      segmentId: segment.id,
      history: await loadDiscoverySegmentHistory({
        workspaceId: input.workspaceId,
        runId: input.runId,
        segmentId: segment.id,
        maximumPassNumber: input.maximumPassNumber,
      }),
    }),
  );
  return new Map(
    histories.map(({ segmentId, history }) => [segmentId, history] as const),
  );
}

function buildUsageSummary(
  histories: Awaited<ReturnType<typeof loadAllSegmentHistories>>,
) {
  const values = [...histories.values()];
  const providerRecordsRetrieved = values.reduce(
    (total, history) => total + history.coverageFacts.rawRecords,
    0,
  );
  const normalizedProviderCandidates = values.reduce(
    (total, history) => total + history.coverageFacts.normalizedCandidates,
    0,
  );
  const uniqueCandidateGroups = globalPlausibleCandidateHints(histories).size;
  const invalidEntities = values.reduce(
    (total, history) => total + history.coverageFacts.invalidRecordCount,
    0,
  );
  return {
    providerCalls: totalProviderCalls(histories),
    providerRecordsRetrieved,
    normalizedProviderCandidates,
    uniqueCandidateGroups,
    canonicalOrganizations: 0,
    candidatesPrefiltered: values.reduce(
      (total, history) => total + history.coverageFacts.plausibleCandidateCount,
      0,
    ),
    candidatesResearched: 0,
    candidatesEvaluated: 0,
    eligibleCandidates: 0,
    recommendedCandidates: 0,
    conditionalCandidates: 0,
    researchNeededCandidates: 0,
    rejectedCandidates: 0,
    excludedCandidates: 0,
    invalidEntities,
    duplicatesOrMergedEntities: Math.max(
      0,
      normalizedProviderCandidates - uniqueCandidateGroups,
    ),
  };
}

function totalProviderCalls(
  histories: Awaited<ReturnType<typeof loadAllSegmentHistories>>,
) {
  return [...histories.values()].reduce(
    (total, history) => total + history.coverageFacts.providerCalls,
    0,
  );
}

function globalPlausibleCandidateHints(
  histories: Awaited<ReturnType<typeof loadAllSegmentHistories>>,
) {
  return new Set(
    [...histories.values()].flatMap(
      ({ coverageFacts }) => coverageFacts.plausibleCandidateIdentityHints,
    ),
  );
}

function finalStageResult(input: {
  memorySnapshotId: string;
  planRecord: CampaignDiscoveryPlanRecord;
  run: CampaignDiscoveryRunRecord;
  decision: DiscoveryPassDecisionRecord;
}): StageResult {
  const decisionKind = input.decision.decision_json.decision;
  const usage = jsonRecord(input.run.usage_summary_json);
  const normalizedCandidateCount = recordNumber(usage, "normalizedProviderCandidates");
  if (decisionKind === "stop" && normalizedCandidateCount === 0) {
    if (input.decision.decision_json.reasonCode === "fatal_provider_failure") {
      throw new Error(
        `Semantic Discovery provider failed before returning source records. ${input.decision.decision_json.rationale}`,
      );
    }
    throw new Error(
      "Semantic Discovery completed without normalized candidates. Review the provider records and normalization diagnostics.",
    );
  }
  return {
    stage: "discover",
    // A persisted continuation decision is progress, not a workflow blocker.
    // Resolution and evaluation must run before the adaptive controller decides
    // whether the next cycle should search the remaining gaps.
    status: decisionKind === "stop" ? "completed" : "partial",
    outputReferences: {
      memorySnapshotId: input.memorySnapshotId,
      discoveryPlanId: input.planRecord.id,
      discoveryRunId: input.run.id,
      passNumber: input.decision.pass_number,
      continuationDecision: input.decision.decision_json,
      coverageSummary: input.run.coverage_summary_json,
      usageSummary: input.run.usage_summary_json,
      stageScope:
        input.decision.pass_number > 1
          ? "semantic_discovery_with_targeted_gaps"
          : "initial_semantic_breadth",
    },
    progressDelta: {
      discoveryPasses: input.decision.pass_number,
      normalizedCandidates: normalizedCandidateCount,
      providerCalls: recordNumber(usage, "providerCalls"),
      providerRecords: recordNumber(usage, "providerRecordsRetrieved"),
      uniqueCandidateGroups: recordNumber(usage, "uniqueCandidateGroups"),
    },
    usageEventIds: [],
  };
}

function assertSegmentIdentity(
  plan: DiscoveryPlanV2,
  persistedSegments: DiscoveryPlanSegmentRecord[],
) {
  const planned = plan.segments.map(({ id }) => id).sort(compareText);
  const persisted = persistedSegments
    .map(({ segment_key }) => segment_key)
    .sort(compareText);
  if (
    planned.length !== persisted.length ||
    planned.some((segmentKey, index) => segmentKey !== persisted[index])
  ) {
    throw new Error("Persisted Semantic Discovery segment identity mismatch.");
  }
}

function compareSelectedActions(
  left: SelectedDiscoveryGapAction,
  right: SelectedDiscoveryGapAction,
) {
  return compareText(left.gapId, right.gapId) || compareText(left.type, right.type);
}

function jsonInteger(value: unknown, key: string) {
  const record = jsonRecord(value);
  return Math.max(0, Math.floor(recordNumber(record, key)));
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordNumber(record: Record<string, unknown>, key: string) {
  const value = Number(record[key]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
