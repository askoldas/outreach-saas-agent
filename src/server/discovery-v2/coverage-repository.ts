import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  discoveryContinuationDecisionSchema,
  type SelectedDiscoveryGapAction,
} from "@/lib/discovery-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import type { Json } from "@/types/database.types";
import { z } from "zod";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const recordSchema = z.object({ id: z.string().min(1) }).passthrough();

const discoveryPlanRecordSchema = recordSchema.extend({
  workspace_id: z.string().min(1),
  campaign_run_id: z.string().min(1),
  campaign_id: z.string().min(1),
  campaign_strategy_version_id: z.string().min(1),
  memory_snapshot_id: z.string().min(1),
  compiled_snapshot_json: z.unknown(),
  content_hash: z.string().length(64),
});

export type CampaignDiscoveryPlanRecord = z.infer<typeof discoveryPlanRecordSchema>;

const discoveryPlanSegmentSchema = z
  .object({
    id: z.string().min(1),
    segment_key: z.string().min(1),
    priority: z.number().int().min(1).max(100),
  })
  .strict();

export type DiscoveryPlanSegmentRecord = z.infer<typeof discoveryPlanSegmentSchema>;

const discoveryRunRecordSchema = recordSchema.extend({
  workspace_id: z.string().min(1),
  campaign_run_id: z.string().min(1),
  discovery_plan_id: z.string().min(1),
  campaign_id: z.string().min(1),
  status: z.string().min(1),
  budget_limit_json: z.unknown(),
  usage_summary_json: z.unknown(),
  coverage_summary_json: z.unknown(),
  continuation_decision_json: z.unknown().nullable(),
});

export type CampaignDiscoveryRunRecord = z.infer<typeof discoveryRunRecordSchema>;

const discoveryPassDecisionRecordSchema = recordSchema.extend({
  workspace_id: z.string().min(1),
  discovery_run_id: z.string().min(1),
  pass_number: z.number().int().positive(),
  coverage_summary_json: z.unknown(),
  usage_summary_json: z.unknown(),
  decision_json: z.unknown(),
});

export type DiscoveryPassDecisionRecord = {
  id: string;
  workspace_id: string;
  discovery_run_id: string;
  pass_number: number;
  coverage_summary_json: unknown;
  usage_summary_json: unknown;
  decision_json: z.infer<typeof discoveryContinuationDecisionSchema>;
};

const discoveryGapRecordSchema = z
  .object({
    id: z.string().min(1),
    discovery_segment_id: z.string().min(1).nullable(),
    gap_key: z.string().min(1),
    status: z.enum(["open", "addressing", "resolved", "accepted", "blocked"]),
  })
  .strict();

const targetedSegmentRunSchema = z
  .object({
    segmentId: z.string().min(1),
    segmentRunId: z.string().min(1),
    allocatedCalls: z.number().int().positive(),
  })
  .strict();

const targetedSegmentCompletionSchema = z
  .object({
    segmentRunId: z.string().min(1),
    completedActionCount: z.number().int().positive(),
    outcomeHash: z.string().length(64),
  })
  .strict();

const discoveryQueryPlanRecordSchema = recordSchema.extend({
  workspace_id: z.string().min(1),
  discovery_segment_run_id: z.string().min(1),
  provider_key: z.string().min(1),
  adapter_version: z.string().min(1),
  request_json: z.record(z.string(), z.unknown()),
  queries_json: z.array(z.unknown()),
  content_hash: z.string().length(64),
});

export type FrozenDiscoveryQueryPlanRecord = z.infer<
  typeof discoveryQueryPlanRecordSchema
>;

export async function createCampaignDiscoveryPlan(input: {
  workspaceId: string;
  campaignRunId: string;
  plan: Json;
  contentHash: string;
}) {
  return discoveryPlanRecordSchema.parse(
    await rpc("create_campaign_discovery_plan_v2", {
      target_workspace_id: input.workspaceId,
      target_campaign_run_id: input.campaignRunId,
      target_plan: input.plan,
      target_content_hash: input.contentHash,
    }),
  );
}

export async function loadCampaignDiscoveryPlan(input: {
  workspaceId: string;
  campaignRunId: string;
}): Promise<CampaignDiscoveryPlanRecord | null> {
  const data = await rpc("load_campaign_discovery_plan_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
  });
  return data === null ? null : discoveryPlanRecordSchema.parse(data);
}

export async function startCampaignDiscoveryRun(input: {
  workspaceId: string;
  campaignRunId: string;
  planId: string;
}) {
  return recordSchema.parse(
    await rpc("start_campaign_discovery_run_v2", {
      target_workspace_id: input.workspaceId,
      target_plan_id: input.planId,
      target_campaign_run_id: input.campaignRunId,
    }),
  );
}

export async function loadCampaignDiscoveryRun(input: {
  workspaceId: string;
  campaignRunId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("discovery_runs_v2")
    .select(
      "id,workspace_id,campaign_run_id,discovery_plan_id,campaign_id,status,budget_limit_json,usage_summary_json,coverage_summary_json,continuation_decision_json",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Semantic Discovery Run: ${error.message}`);
  return data === null ? null : discoveryRunRecordSchema.parse(data);
}

export async function loadLatestDiscoveryPassDecision(input: {
  workspaceId: string;
  runId: string;
}): Promise<DiscoveryPassDecisionRecord | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("discovery_pass_decisions_v2")
    .select(
      "id,workspace_id,discovery_run_id,pass_number,coverage_summary_json,usage_summary_json,decision_json",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("discovery_run_id", input.runId)
    .order("pass_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load Discovery pass decision: ${error.message}`);
  if (!data) return null;
  const parsed = discoveryPassDecisionRecordSchema.parse(data);
  let decision = discoveryContinuationDecisionSchema.parse(parsed.decision_json);
  if (decision.decision === "continue" && !decision.selectedActionPlans.length) {
    decision = discoveryContinuationDecisionSchema.parse({
      ...decision,
      selectedActionPlans: await loadLegacySelectedActionPlans({
        workspaceId: input.workspaceId,
        runId: input.runId,
        selectedGapIds: decision.selectedGapIds,
        selectedActions: decision.selectedActions,
      }),
    });
  }
  return {
    ...parsed,
    decision_json: decision,
  };
}

export async function loadDiscoveryGapsByKeys(input: {
  workspaceId: string;
  runId: string;
  gapKeys: string[];
}) {
  if (!input.gapKeys.length) return [];
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("discovery_gaps_v2")
    .select("id,discovery_segment_id,gap_key,status")
    .eq("workspace_id", input.workspaceId)
    .eq("discovery_run_id", input.runId)
    .in("gap_key", sortedUnique(input.gapKeys));
  if (error) throw new Error(`Could not load Discovery gaps: ${error.message}`);
  return z.array(discoveryGapRecordSchema).parse(data ?? []);
}

export async function startTargetedDiscoveryPass(input: {
  workspaceId: string;
  runId: string;
  passNumber: number;
  batches: Array<{
    segmentId: string;
    actions: SelectedDiscoveryGapAction[];
  }>;
}) {
  return z.array(targetedSegmentRunSchema).parse(
    await rpc("start_targeted_discovery_pass_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_pass_number: input.passNumber,
      target_batches: input.batches,
    }),
  );
}

export async function completeTargetedDiscoverySegmentPass(input: {
  workspaceId: string;
  segmentRunId: string;
  outcome: Json;
}) {
  return targetedSegmentCompletionSchema.parse(
    await rpc("complete_targeted_discovery_segment_pass_v2", {
      target_workspace_id: input.workspaceId,
      target_segment_run_id: input.segmentRunId,
      target_outcome: input.outcome,
    }),
  );
}

export async function freezeDiscoveryQueryPlan(input: {
  workspaceId: string;
  segmentRunId: string;
  providerId: string;
  providerVersion: string;
  request: unknown;
  queries: unknown;
}) {
  const request = z.record(z.string(), z.unknown()).parse(input.request);
  const queries = z.array(z.unknown()).parse(input.queries);
  const record = discoveryQueryPlanRecordSchema.parse(
    await rpc("freeze_discovery_query_plan_v2", {
      target_workspace_id: input.workspaceId,
      target_segment_run_id: input.segmentRunId,
      target_provider_key: input.providerId,
      target_adapter_version: input.providerVersion,
      target_request: request,
      target_queries: queries,
      target_content_hash: hashCanonical({
        providerId: input.providerId,
        providerVersion: input.providerVersion,
        request,
        queries,
      }),
    }),
  );
  const frozenHash = hashCanonical({
    providerId: record.provider_key,
    providerVersion: record.adapter_version,
    request: record.request_json,
    queries: record.queries_json,
  });
  if (
    record.workspace_id !== input.workspaceId ||
    record.discovery_segment_run_id !== input.segmentRunId ||
    record.provider_key !== input.providerId ||
    record.adapter_version !== input.providerVersion ||
    record.content_hash !== frozenHash
  ) {
    throw new Error("Frozen Semantic Discovery query plan identity mismatch.");
  }
  return record;
}

export async function listDiscoveryPlanSegments(input: {
  workspaceId: string;
  planId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("discovery_segments_v2")
    .select("id,segment_key,priority")
    .eq("workspace_id", input.workspaceId)
    .eq("discovery_plan_id", input.planId)
    .order("priority", { ascending: true })
    .order("segment_key", { ascending: true });
  if (error)
    throw new Error(`Could not load Semantic Discovery segments: ${error.message}`);
  return z.array(discoveryPlanSegmentSchema).parse(data ?? []);
}

export async function startDiscoverySegmentPassOnce(input: {
  workspaceId: string;
  runId: string;
  segmentId: string;
  passNumber: number;
  gapKeys: string[];
}) {
  return recordSchema.parse(
    await rpc("start_discovery_segment_pass_once_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_segment_id: input.segmentId,
      target_pass_number: input.passNumber,
      target_gap_keys: input.gapKeys,
    }),
  );
}

export async function persistDiscoverySegmentCoverageOnce(input: {
  workspaceId: string;
  runId: string;
  segmentRunId: string;
  coverage: Json;
  gaps: Json;
}) {
  return recordSchema.parse(
    await rpc("persist_discovery_segment_coverage_once_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_segment_run_id: input.segmentRunId,
      target_coverage: input.coverage,
      target_gaps: input.gaps,
    }),
  );
}

export async function finalizeDiscoveryPass(input: {
  workspaceId: string;
  runId: string;
  passNumber: number;
  expectedSegmentRunIds: string[];
  coverageSummary: Json;
  usageSummary: Json;
  decision: Json;
}) {
  return recordSchema.parse(
    await rpc("finalize_discovery_pass_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_pass_number: input.passNumber,
      target_expected_segment_run_ids: input.expectedSegmentRunIds,
      target_coverage_summary: input.coverageSummary,
      target_usage_summary: input.usageSummary,
      target_decision: input.decision,
    }),
  );
}

export async function finalizeTargetedDiscoveryPass(input: {
  workspaceId: string;
  runId: string;
  passNumber: number;
  expectedSegmentRunIds: string[];
  coverageSummary: Json;
  usageSummary: Json;
  decision: Json;
}) {
  return recordSchema.parse(
    await rpc("finalize_targeted_discovery_pass_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_pass_number: input.passNumber,
      target_expected_segment_run_ids: input.expectedSegmentRunIds,
      target_coverage_summary: input.coverageSummary,
      target_usage_summary: input.usageSummary,
      target_decision: input.decision,
    }),
  );
}

export async function recordDiscoveryQueryAudit(input: {
  workspaceId: string;
  providerExecutionId: string;
  segmentRunId: string;
  queries: Json;
}) {
  const data = await rpc("record_discovery_query_audit_v2", {
    target_workspace_id: input.workspaceId,
    target_provider_execution_id: input.providerExecutionId,
    target_segment_run_id: input.segmentRunId,
    target_queries: input.queries,
  });
  const count = Number(data);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Discovery query audit returned an invalid settlement count.");
  }
  return count;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error) throw new Error(`Semantic Discovery persistence failed: ${error.message}`);
  return data;
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

async function loadLegacySelectedActionPlans(input: {
  workspaceId: string;
  runId: string;
  selectedGapIds: string[];
  selectedActions: string[];
}): Promise<SelectedDiscoveryGapAction[]> {
  const supabase = createServiceRoleClient();
  const { data: gaps, error: gapError } = await supabase
    .from("discovery_gaps_v2")
    .select("id,gap_key")
    .eq("workspace_id", input.workspaceId)
    .eq("discovery_run_id", input.runId)
    .in("gap_key", input.selectedGapIds);
  if (gapError) {
    throw new Error(`Could not hydrate legacy Discovery gaps: ${gapError.message}`);
  }
  const gapIdByKey = new Map((gaps ?? []).map((gap) => [gap.gap_key, gap.id]));
  if (gapIdByKey.size !== new Set(input.selectedGapIds).size) {
    throw new Error("Legacy Discovery continuation references an unknown gap.");
  }
  const { data: actions, error: actionError } = await supabase
    .from("discovery_gap_actions_v2")
    .select(
      "discovery_gap_id,action_type,reason,expected_improvement,max_calls,max_estimated_cost_minor,created_at,id",
    )
    .eq("workspace_id", input.workspaceId)
    .in("discovery_gap_id", [...gapIdByKey.values()])
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (actionError) {
    throw new Error(
      `Could not hydrate legacy Discovery gap actions: ${actionError.message}`,
    );
  }
  const remainingTypes = new Map<string, number>();
  for (const actionType of input.selectedActions) {
    remainingTypes.set(actionType, (remainingTypes.get(actionType) ?? 0) + 1);
  }
  const plans: SelectedDiscoveryGapAction[] = [];
  for (const gapKey of input.selectedGapIds) {
    const databaseGapId = gapIdByKey.get(gapKey);
    const action = (actions ?? []).find(
      (candidate) =>
        candidate.discovery_gap_id === databaseGapId &&
        (remainingTypes.get(candidate.action_type) ?? 0) > 0,
    );
    if (!action) {
      throw new Error(
        "Legacy Discovery continuation cannot reconstruct its selected action.",
      );
    }
    remainingTypes.set(
      action.action_type,
      (remainingTypes.get(action.action_type) ?? 0) - 1,
    );
    plans.push({
      gapId: gapKey,
      type: action.action_type as SelectedDiscoveryGapAction["type"],
      reason: action.reason,
      expectedImprovement: action.expected_improvement,
      maxCalls: action.max_calls ?? 1,
      ...(action.max_estimated_cost_minor === null
        ? {}
        : {
            maxEstimatedCostMinor: Number(action.max_estimated_cost_minor),
          }),
    });
  }
  if ([...remainingTypes.values()].some((count) => count !== 0)) {
    throw new Error("Legacy Discovery continuation action mapping is incomplete.");
  }
  return plans;
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
