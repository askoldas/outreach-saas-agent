import { createServiceRoleClient } from "@/lib/supabase/service";
import { fingerprintJson } from "@/lib/workflow-v2/fingerprint";
import type { Json } from "@/types/database.types";
import { z } from "zod";
import type { CampaignResearchBudget } from "@/lib/research-budget-v2/contracts";
import type { AdaptiveResearchDecision } from "@/lib/adaptive-research-v2/contracts";
import { nextConsecutiveLowYieldWaves } from "@/lib/adaptive-research-v2/controller";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export type WorkflowTaskRecord = {
  attempt_count: number;
  id: string;
  input_fingerprint: string;
  output_reference_json: Json | null;
  status: string;
  task_type: string;
  workflow_run_id: string;
  workspace_id: string;
};

export type CampaignWorkflowRecord = {
  campaign_run_id: string;
  id: string;
  status: string;
  trigger_run_id: string | null;
  workspace_id: string;
};

const workflowControlSchema = z.object({
  state: z.enum(["run", "paused", "cancelled", "terminal"]),
  workflowRunId: z.string().uuid(),
  campaignRunId: z.string().uuid(),
  commandId: z.string().uuid().nullable(),
});

export async function ensureCampaignWorkflow(input: {
  campaignRunId: string;
  inputReference: Json;
  workspaceId: string;
}) {
  return rpcRecord("ensure_campaign_workflow_v2", {
    target_campaign_run_id: input.campaignRunId,
    target_input_reference: input.inputReference,
    target_workspace_id: input.workspaceId,
  });
}

export async function ensureCampaignResearchCycle(input: {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber: number;
  budget: CampaignResearchBudget;
  continuationOfCycleId?: string;
}) {
  return rpcRecord("ensure_campaign_research_cycle_v2", {
    target_campaign_run_id: input.campaignRunId,
    target_workspace_id: input.workspaceId,
    target_cycle_number: input.cycleNumber,
    target_budget: input.budget,
    target_continuation_of_cycle_id: input.continuationOfCycleId ?? null,
  });
}

const continuationReservationSchema = z.object({
  id: z.string().uuid(),
  cycleNumber: z.number().int().positive(),
  continuationOfCycleId: z.string().uuid(),
  requestedAction: z.enum([
    "research_existing_pool",
    "discover_more",
    "expand_source_pages",
    "stop_budget",
  ]),
});

export async function reserveCampaignResearchContinuation(input: {
  campaignRunId: string;
  workspaceId: string;
  budget: CampaignResearchBudget;
}) {
  return continuationReservationSchema.parse(
    await rpcRecord("reserve_campaign_research_continuation_v2", {
      target_campaign_run_id: input.campaignRunId,
      target_workspace_id: input.workspaceId,
      target_budget: input.budget,
    }),
  );
}

export async function finalizeCampaignResearchCycle(input: {
  cycleId: string;
  workspaceId: string;
  usage: Record<string, number>;
  decision: AdaptiveResearchDecision;
}) {
  return rpcRecord("finalize_campaign_research_cycle_v2", {
    target_cycle_id: input.cycleId,
    target_workspace_id: input.workspaceId,
    target_usage: input.usage,
    target_decision: input.decision,
  });
}

export async function loadAdaptiveResearchSnapshot(input: {
  campaignRunId: string;
  workspaceId: string;
  startedAt: string;
  cycleId: string;
}) {
  const supabase = createServiceRoleClient();
  const run = await loadCampaignV2Run(input);
  const [
    providers,
    discoveryProviders,
    ai,
    candidates,
    researchBatch,
    allResearchBatches,
    qualificationBatch,
    expansions,
    discoveryRun,
    researchCycles,
  ] = await Promise.all([
    supabase
      .from("provider_executions")
      .select("input_units,output_units")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .gte("created_at", input.startedAt),
    supabase
      .from("discovery_provider_executions")
      .select("id,result_count")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", run.campaign_id)
      .gte("started_at", input.startedAt),
    supabase
      .from("ai_requests")
      .select("input_units,output_units,actual_cost")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .gte("created_at", input.startedAt),
    supabase
      .from("campaign_candidates")
      .select("id,created_at")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", run.campaign_id),
    supabase
      .from("candidate_research_batches_v2")
      .select("id,completed_count")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .eq("research_cycle_id", input.cycleId)
      .maybeSingle(),
    supabase
      .from("candidate_research_batches_v2")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId),
    supabase
      .from("candidate_qualification_batches_v2")
      .select("completed_count,output_reference_json")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .eq("research_cycle_id", input.cycleId)
      .maybeSingle(),
    supabase
      .from("discovery_source_expansions_v2")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", run.campaign_id)
      .eq("status", "partial"),
    supabase
      .from("discovery_runs_v2")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("campaign_research_cycles_v2")
      .select("id,cycle_number")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .order("cycle_number", { ascending: false }),
  ]);
  for (const result of [
    providers,
    discoveryProviders,
    ai,
    candidates,
    researchBatch,
    allResearchBatches,
    qualificationBatch,
    expansions,
    discoveryRun,
    researchCycles,
  ]) {
    if (result.error)
      throw new Error(`Could not load adaptive research usage: ${result.error.message}`);
  }
  const batchIds = (allResearchBatches.data ?? []).map(({ id }) => id);
  const currentBatchId = researchBatch.data?.id;
  const { data: researchedMembers, error: memberError } = batchIds.length
    ? await supabase
        .from("candidate_research_batch_members_v2")
        .select("id,campaign_candidate_id,candidate_research_batch_id")
        .eq("workspace_id", input.workspaceId)
        .in("candidate_research_batch_id", batchIds)
    : { data: [], error: null };
  if (memberError)
    throw new Error(`Could not load researched candidates: ${memberError.message}`);
  const researchedCandidateIds = new Set(
    (researchedMembers ?? []).map(({ campaign_candidate_id: id }) => id),
  );
  const currentMemberIds = (researchedMembers ?? [])
    .filter(({ candidate_research_batch_id: id }) => id === currentBatchId)
    .map(({ id }) => id);
  const { data: memberSources, error: sourceLinkError } = currentMemberIds.length
    ? await supabase
        .from("candidate_research_member_sources_v2")
        .select("source_artifact_id")
        .eq("workspace_id", input.workspaceId)
        .in("candidate_research_member_id", currentMemberIds)
    : { data: [], error: null };
  if (sourceLinkError)
    throw new Error(`Could not load research source links: ${sourceLinkError.message}`);
  const artifactIds = [
    ...new Set((memberSources ?? []).map(({ source_artifact_id: id }) => id)),
  ];
  const { data: sourceArtifacts, error: artifactError } = artifactIds.length
    ? await supabase
        .from("candidate_research_source_artifacts_v2")
        .select("candidate_page_fetch_id")
        .eq("workspace_id", input.workspaceId)
        .in("id", artifactIds)
    : { data: [], error: null };
  if (artifactError)
    throw new Error(`Could not load research source artifacts: ${artifactError.message}`);
  const { count: actionableDiscoveryGaps, error: gapError } = discoveryRun.data
    ? await supabase
        .from("discovery_gaps_v2")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .eq("discovery_run_id", discoveryRun.data.id)
        .in("status", ["open", "addressing"])
    : { count: 0, error: null };
  if (gapError)
    throw new Error(`Could not load actionable discovery gaps: ${gapError.message}`);
  const priorCycleId = (researchCycles.data ?? []).find(
    ({ id }) => id !== input.cycleId,
  )?.id;
  const { data: priorDecision, error: priorDecisionError } = priorCycleId
    ? await supabase
        .from("campaign_research_cycle_decisions_v2")
        .select("decision_json")
        .eq("workspace_id", input.workspaceId)
        .eq("research_cycle_id", priorCycleId)
        .order("decision_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  if (priorDecisionError)
    throw new Error(`Could not load prior research yield: ${priorDecisionError.message}`);
  const aiRows = ai.data ?? [];
  const providerRows = providers.data ?? [];
  const candidateRows = candidates.data ?? [];
  const qualification = qualificationBatch.data?.output_reference_json as Record<
    string,
    Json
  > | null;
  const laneCounts = (qualification?.laneCounts ?? {}) as Record<string, Json>;
  const researched = researchBatch.data?.completed_count ?? 0;
  const reviewReady =
    Number(laneCounts.recommended ?? 0) + Number(laneCounts.conditional ?? 0);
  const priorDecisionJson = (priorDecision?.decision_json ?? {}) as Record<string, Json>;
  const consecutiveLowYieldWaves = nextConsecutiveLowYieldWaves({
    previous: Number(priorDecisionJson.consecutiveLowYieldWaves ?? 0),
    researched,
    reviewReady,
  });
  const remainingCandidateIds = candidateRows
    .map(({ id }) => id)
    .filter((id) => !researchedCandidateIds.has(id));
  const strongUnresearchedCandidates = await countStrongUnresearchedCandidates({
    campaignId: run.campaign_id,
    campaignCandidateIds: remainingCandidateIds,
    supabase,
    workspaceId: input.workspaceId,
  });
  return {
    usage: {
      providerCalls: providerRows.length + (discoveryProviders.data?.length ?? 0),
      providerRecords:
        providerRows.reduce((sum, row) => sum + Number(row.output_units ?? 0), 0) +
        (discoveryProviders.data ?? []).reduce((sum, row) => sum + row.result_count, 0),
      aiInputTokens: aiRows.reduce((sum, row) => sum + Number(row.input_units ?? 0), 0),
      aiOutputTokens: aiRows.reduce((sum, row) => sum + Number(row.output_units ?? 0), 0),
      aiCostUsd: aiRows.reduce((sum, row) => sum + Number(row.actual_cost ?? 0), 0),
      pagesFetched: new Set(
        (sourceArtifacts ?? []).flatMap(({ candidate_page_fetch_id: id }) =>
          id ? [id] : [],
        ),
      ).size,
      uniqueOrganizations: candidateRows.filter(
        ({ created_at }) => created_at >= input.startedAt,
      ).length,
      deepResearchCandidates: researched,
      qualifiedCandidates: qualificationBatch.data?.completed_count ?? 0,
      runtimeMinutes: Math.max(0, (Date.now() - Date.parse(input.startedAt)) / 60_000),
    },
    lanes: {
      recommended: Number(laneCounts.recommended ?? 0),
      conditional: Number(laneCounts.conditional ?? 0),
      requiresResearch: Number(laneCounts.requires_research ?? 0),
      rejected: Number(laneCounts.rejected ?? 0),
      excluded: Number(laneCounts.excluded ?? 0),
    },
    remainingPlausibleCandidates: remainingCandidateIds.length,
    strongUnresearchedCandidates,
    actionableDiscoveryGaps: actionableDiscoveryGaps ?? 0,
    consecutiveLowYieldWaves,
    unexpandedSourcePages: expansions.data?.length ?? 0,
  };
}

async function countStrongUnresearchedCandidates(input: {
  campaignId: string;
  campaignCandidateIds: string[];
  supabase: ReturnType<typeof createServiceRoleClient>;
  workspaceId: string;
}) {
  if (!input.campaignCandidateIds.length) return 0;
  const { data: links, error: linkError } = await input.supabase
    .from("campaign_candidate_discovery_links")
    .select("campaign_candidate_id,provider_source_record_id")
    .eq("workspace_id", input.workspaceId)
    .in("campaign_candidate_id", input.campaignCandidateIds);
  if (linkError)
    throw new Error(
      `Could not load remaining candidate provenance: ${linkError.message}`,
    );
  const sourceIds = [
    ...new Set(
      (links ?? []).flatMap(({ provider_source_record_id: id }) => (id ? [id] : [])),
    ),
  ];
  if (!sourceIds.length) return 0;
  const { data: classifications, error } = await input.supabase
    .from("provider_candidate_preclassifications_v2")
    .select("provider_source_record_id,disposition,confidence")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .in("provider_source_record_id", sourceIds);
  if (error)
    throw new Error(`Could not load remaining candidate priorities: ${error.message}`);
  const strongSourceIds = new Set(
    (classifications ?? [])
      .filter(
        ({ confidence, disposition }) =>
          (disposition === "candidate" && Number(confidence) >= 0.6) ||
          (disposition === "needs_review" && Number(confidence) >= 0.75),
      )
      .map(({ provider_source_record_id: id }) => id),
  );
  return new Set(
    (links ?? [])
      .filter(({ provider_source_record_id: id }) => id && strongSourceIds.has(id))
      .map(({ campaign_candidate_id: id }) => id),
  ).size;
}

export async function claimWorkflowTask(input: {
  idempotencyKey: string;
  inputReference: Json;
  parentTaskRunId?: string;
  taskType: string;
  triggerRunId?: string;
  workflowRunId: string;
  workspaceId: string;
}) {
  return rpcTaskRecord("claim_intelligence_task_v2", {
    target_idempotency_key: input.idempotencyKey,
    target_input_fingerprint: fingerprintJson(input.inputReference),
    target_input_reference: input.inputReference,
    target_parent_task_run_id: input.parentTaskRunId ?? null,
    target_task_type: input.taskType,
    target_trigger_run_id: input.triggerRunId ?? null,
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function completeWorkflowTask(input: {
  metrics?: Json;
  outputReference: Json;
  status?: "completed" | "partial" | "blocked" | "skipped";
  taskRunId: string;
  workspaceId: string;
}) {
  return rpcTaskRecord("complete_intelligence_task_v2", {
    target_metrics: input.metrics ?? {},
    target_output_reference: input.outputReference,
    target_status: input.status ?? "completed",
    target_task_run_id: input.taskRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function failWorkflowTaskAttempt(input: {
  errorCode: string;
  errorDetails: Json;
  retryable: boolean;
  taskRunId: string;
  workspaceId: string;
}) {
  return rpcTaskRecord("fail_intelligence_task_attempt_v2", {
    target_error_code: input.errorCode,
    target_error_details: input.errorDetails,
    target_retryable: input.retryable,
    target_task_run_id: input.taskRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function saveWorkflowCheckpoint(input: {
  checkpointKey: string;
  payload: Json;
  workflowRunId: string;
  workspaceId: string;
}) {
  return rpcRecord("save_workflow_checkpoint_v2", {
    target_checkpoint_key: input.checkpointKey,
    target_payload: input.payload,
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function loadCompletedCheckpointKeys(input: {
  workflowRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("workflow_checkpoints")
    .select("checkpoint_key")
    .eq("workspace_id", input.workspaceId)
    .eq("workflow_run_id", input.workflowRunId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load V2 workflow checkpoints: ${error.message}`);
  return [...new Set((data ?? []).map(({ checkpoint_key }) => checkpoint_key))];
}

export async function loadCampaignV2Run(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("campaign_runs")
    .select(
      "id,campaign_id,profile_snapshot_id,strategy_version_id,workflow_version,status",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.campaignRunId)
    .single();
  if (error) throw new Error(`Could not load V2 Campaign Run: ${error.message}`);
  if (data.workflow_version !== "v2")
    throw new Error("V2 workflow cannot execute a non-V2 Campaign Run.");
  return data;
}

export async function consumeWorkflowControl(input: {
  workflowRunId: string;
  workspaceId: string;
}) {
  const value = await rpcRecord("consume_campaign_workflow_control_v2", {
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  });
  return workflowControlSchema.parse(value);
}

export async function loadWorkflowCandidateProgress(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data: batch, error: batchError } = await supabase
    .from("candidate_qualification_batches_v2")
    .select("id,candidate_count,blocked_count")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .maybeSingle();
  if (batchError)
    throw new Error(`Could not reconcile V2 Candidate progress: ${batchError.message}`);
  return {
    failedCandidateCount: batch?.blocked_count ?? 0,
    totalCandidateCount: batch?.candidate_count ?? 0,
  };
}

export async function updateCampaignWorkflow(input: {
  errorSummary?: Json | null;
  outputReference?: Json;
  progressSummary?: Json;
  status:
    | "queued"
    | "initializing"
    | "discovering"
    | "resolving_entities"
    | "evaluating_candidates"
    | "ranking"
    | "ready_for_review"
    | "paused"
    | "cancelled"
    | "completed"
    | "completed_partial"
    | "failed";
  triggerRunId?: string;
  workflowRunId: string;
  workspaceId: string;
}) {
  const workflow = (await rpcRecord("settle_campaign_workflow_v2", {
    target_error_summary: input.errorSummary ?? null,
    target_output_reference: input.outputReference ?? null,
    target_progress_summary: input.progressSummary ?? null,
    target_status: input.status,
    target_trigger_run_id: input.triggerRunId ?? null,
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  })) as unknown as CampaignWorkflowRecord;
  if (input.status === "failed") {
    const { error } = await createServiceRoleClient()
      .from("intelligence_task_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_code: "workflow_failed",
      })
      .eq("workspace_id", input.workspaceId)
      .eq("workflow_run_id", input.workflowRunId)
      .in("status", ["pending", "claimed", "running", "retry_wait", "blocked"]);
    if (error) throw new Error(`Could not settle failed V2 child runs: ${error.message}`);
  }
  return workflow;
}

async function rpcTaskRecord(name: string, args: Record<string, unknown>) {
  const record = await rpcRecord(name, args);
  return record as WorkflowTaskRecord;
}

async function rpcRecord(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error) throw new Error(`V2 workflow persistence failed: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error(`${name} returned an invalid record.`);
  return data as Record<string, Json>;
}
