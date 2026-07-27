import { createServiceRoleClient } from "@/lib/supabase/service";
import { createHash } from "node:crypto";
import type { CampaignAgentPlan, CampaignAgentState } from "@/lib/campaign-agent/loop";
import {
  campaignAgentPlannerPromptVersion,
  type CampaignAgentPlannerResult,
} from "@/lib/campaign-agent/planner";

export type CampaignExecutionContext = {
  campaignId: string;
  campaignRunId: string;
  desiredCompanyCount: number;
  discoveryExecutionId: string;
  status: string;
  workspaceId: string;
};

export async function loadCampaignExecutionContext(
  campaignRunId: string,
): Promise<CampaignExecutionContext> {
  const supabase = createServiceRoleClient();
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select(
      "id,workspace_id,campaign_id,status,metadata,campaign:campaigns!inner(name,objective,preferred_outreach_language),strategy:campaign_strategy_versions!campaign_runs_strategy_version_id_fkey(strategy),snapshot:campaign_profile_snapshots!campaign_runs_profile_snapshot_id_fkey(snapshot_data)",
    )
    .eq("id", campaignRunId)
    .single();
  if (runError)
    throw new Error(`Could not load Campaign Run context: ${runError.message}`);

  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .select("id")
    .eq("workspace_id", run.workspace_id)
    .eq("campaign_run_id", run.id)
    .eq("operation", "campaign_discovery")
    .is("parent_execution_id", null)
    .order("attempt", { ascending: false })
    .limit(1)
    .single();
  if (executionError)
    throw new Error(
      `Could not load Campaign discovery execution: ${executionError.message}`,
    );

  return {
    campaignId: run.campaign_id,
    campaignRunId: run.id,
    desiredCompanyCount: positiveInteger(
      asRecord(run.metadata).desiredCompanyCount,
      asRecord(asRecord(run.strategy).strategy).targetCompanyCount,
    ),
    discoveryExecutionId: execution.id,
    status: run.status,
    workspaceId: run.workspace_id,
  };
}

export async function loadCampaignAgentPlanningContext(campaignRunId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("campaign_runs")
    .select(
      "workspace_id,campaign:campaigns!inner(id,name,objective,selected_offering_id,target_geography,initial_target_description,industries,company_characteristics,relevant_use_case,exclusions,target_volume,preferred_outreach_language),strategy:campaign_strategy_versions!campaign_runs_strategy_version_id_fkey(strategy),snapshot:campaign_profile_snapshots!campaign_runs_profile_snapshot_id_fkey(snapshot_data)",
    )
    .eq("id", campaignRunId)
    .single();
  if (error)
    throw new Error(`Could not load Campaign Agent planning context: ${error.message}`);
  const [
    { data: questions, error: questionsError },
    { data: memories, error: memoriesError },
    { data: chunks, error: chunksError },
  ] = await Promise.all([
    supabase
      .from("campaign_questions")
      .select("question,answer,answered_at")
      .eq("workspace_id", data.workspace_id)
      .eq("campaign_run_id", campaignRunId)
      .eq("status", "answered")
      .order("answered_at", { ascending: true }),
    supabase
      .from("campaign_memories")
      .select("category,statement,confidence")
      .eq("workspace_id", data.workspace_id)
      .eq("campaign_id", asRecord(data.campaign).id as string)
      .eq("approval_status", "approved")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("document_chunks")
      .select(
        "content,chunk_index,document:documents!inner(file_name,campaign_id,status)",
      )
      .eq("workspace_id", data.workspace_id)
      .eq("document.campaign_id", asRecord(data.campaign).id as string)
      .eq("document.status", "ready")
      .limit(100),
  ]);
  if (questionsError)
    throw new Error(`Could not load Campaign clarifications: ${questionsError.message}`);
  if (memoriesError)
    throw new Error(`Could not load Campaign memories: ${memoriesError.message}`);
  if (chunksError)
    throw new Error(`Could not load Campaign documents: ${chunksError.message}`);
  const campaign = asRecord(data.campaign);
  const strategy = asRecord(asRecord(data.strategy).strategy);
  return normalizeCampaignAgentPlanningContext({
    campaign,
    companyProfile: asRecord(asRecord(data.snapshot).snapshot_data),
    clarifications: (questions ?? []).map((item) => ({
      question: item.question,
      answer: stringValue(asRecord(item.answer).text),
    })),
    memories: memories ?? [],
    documents: rankDocumentChunks(chunks ?? [], [
      stringValue(campaign.objective),
      stringValue(campaign.target_geography),
      ...stringArray(campaign.industries),
      ...stringArray(strategy.companyTypes),
      ...stringArray(strategy.industries),
    ]),
    strategy,
  });
}

export async function saveCampaignAgentLearnings(
  context: CampaignExecutionContext,
  state: CampaignAgentState,
) {
  const rows = state.history.map(({ iteration, observation, plan }) => ({
    workspace_id: context.workspaceId,
    campaign_id: context.campaignId,
    campaign_run_id: context.campaignRunId,
    scope: "campaign",
    category:
      observation.acceptedCompanies > 0 ? "successful_query" : "query_performance",
    statement:
      `${observation.acceptedCompanies} new qualified companies were accepted from ` +
      `${observation.inspectedCompanies} inspected results using: ${plan.queries.join("; ")}`,
    evidence_ids: [],
    confidence: observation.inspectedCompanies >= 5 ? "medium" : "low",
    approval_status: "proposed",
    origin: `campaign_agent_iteration_${iteration}`,
    retention_class: "campaign",
  }));
  if (rows.length === 0) return;
  const { error } = await createServiceRoleClient()
    .from("campaign_memories")
    .upsert(rows, {
      onConflict: "campaign_run_id,category,origin",
      ignoreDuplicates: true,
    });
  if (error) throw new Error(`Could not save Campaign learnings: ${error.message}`);
}

export async function markCampaignAgentWaitingForInput(
  context: CampaignExecutionContext,
  input: { iteration: number; reason: string },
) {
  const supabase = createServiceRoleClient();
  const { data: existing, error: lookupError } = await supabase
    .from("campaign_questions")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("campaign_run_id", context.campaignRunId)
    .eq("question_type", `campaign_discovery_iteration_${input.iteration}`)
    .maybeSingle();
  if (lookupError)
    throw new Error(`Could not check Campaign clarification: ${lookupError.message}`);
  if (!existing) {
    const { error: questionError } = await supabase.from("campaign_questions").insert({
      workspace_id: context.workspaceId,
      campaign_run_id: context.campaignRunId,
      question_type: `campaign_discovery_iteration_${input.iteration}`,
      question:
        "The current targeting produced no new qualified companies. What should the agent change or prioritize in the next search?",
      options: [],
      status: "open",
    });
    if (questionError)
      throw new Error(`Could not save Campaign clarification: ${questionError.message}`);
  }
  const { error: runError } = await supabase
    .from("campaign_runs")
    .update({
      status: "waiting_for_input",
      current_phase: "waiting_for_input",
      current_iteration: input.iteration,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId);
  if (runError)
    throw new Error(`Could not pause Campaign for clarification: ${runError.message}`);
  await appendEventOnce(context, {
    eventType: `campaign_agent_waiting_for_input_${input.iteration}`,
    phase: "waiting_for_input",
    level: "info",
    summary: input.reason,
  });
}

export async function cancelQueuedDiscovery(context: CampaignExecutionContext) {
  const supabase = createServiceRoleClient();
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select("status")
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId)
    .single();
  if (runError)
    throw new Error(`Could not verify Campaign cancellation: ${runError.message}`);
  if (run.status !== "cancelled") return false;

  const completedAt = new Date().toISOString();
  const { error: executionError } = await supabase
    .from("provider_executions")
    .update({
      status: "cancelled",
      completed_at: completedAt,
      error_code: "campaign_cancelled",
      error_message: "Campaign execution was cancelled before discovery started.",
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.discoveryExecutionId)
    .in("status", ["pending", "running"]);
  if (executionError)
    throw new Error(`Could not cancel discovery execution: ${executionError.message}`);

  await appendEventOnce(context, {
    eventType: "campaign_execution_cancelled",
    phase: "cancelled",
    level: "info",
    summary: "Campaign execution was cancelled before discovery started.",
  });
  return true;
}

export async function pauseCampaignExecutionIfRequested(
  context: CampaignExecutionContext,
) {
  const supabase = createServiceRoleClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("status")
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignId)
    .single();
  if (campaignError)
    throw new Error(`Could not verify Campaign pause state: ${campaignError.message}`);
  if (campaign.status !== "paused" && campaign.status !== "completed") return null;

  const completed = campaign.status === "completed";

  const { error: runError } = await supabase
    .from("campaign_runs")
    .update({
      status: completed ? "cancelled" : "waiting_for_input",
      current_phase: completed ? "cancelled" : "paused",
      ...(completed ? { cancelled_at: new Date().toISOString() } : {}),
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId)
    .not("status", "in", '("completed","partially_completed","failed","cancelled")');
  if (runError) throw new Error(`Could not pause Campaign Run: ${runError.message}`);
  await appendEventOnce(context, {
    eventType: completed ? "campaign_execution_cancelled" : "campaign_execution_paused",
    phase: completed ? "cancelled" : "paused",
    level: "info",
    summary: completed
      ? "Campaign execution stopped. Completed discovery results were preserved."
      : "Campaign paused. Completed discovery results were preserved.",
  });
  return completed ? ("cancelled" as const) : ("paused" as const);
}

export async function markCampaignOrchestrationStarted(
  context: CampaignExecutionContext,
) {
  const { error } = await createServiceRoleClient()
    .from("campaign_runs")
    .update({
      dispatch_state: "running",
      dispatch_updated_at: new Date().toISOString(),
      last_dispatch_error: null,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId);
  if (error)
    throw new Error(`Could not mark Campaign dispatch running: ${error.message}`);
  await appendEventOnce(context, {
    eventType: "campaign_orchestration_started",
    phase: "discovery_queued",
    level: "info",
    summary: "Campaign execution started.",
  });
}

export async function completeCampaignDispatch(context: CampaignExecutionContext) {
  const { error } = await createServiceRoleClient()
    .from("campaign_runs")
    .update({
      dispatch_state: "completed",
      dispatch_updated_at: new Date().toISOString(),
      last_dispatch_error: null,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId);
  if (error) throw new Error(`Could not complete Campaign dispatch: ${error.message}`);
}

async function appendEventOnce(
  context: CampaignExecutionContext,
  event: {
    eventType: string;
    level: string;
    phase: string;
    summary: string;
  },
) {
  const supabase = createServiceRoleClient();
  const { data: existing, error: lookupError } = await supabase
    .from("campaign_run_events")
    .select("id")
    .eq("workspace_id", context.workspaceId)
    .eq("campaign_run_id", context.campaignRunId)
    .eq("event_type", event.eventType)
    .limit(1)
    .maybeSingle();
  if (lookupError)
    throw new Error(`Could not check Campaign event: ${lookupError.message}`);
  if (existing) return;

  const { error } = await supabase.from("campaign_run_events").insert({
    workspace_id: context.workspaceId,
    campaign_run_id: context.campaignRunId,
    event_type: event.eventType,
    phase: event.phase,
    level: event.level,
    summary: event.summary,
    details: {
      discoveryExecutionId: context.discoveryExecutionId,
      enrichmentMode: "optional_deferred",
    },
    visible_to_user: true,
  });
  if (error) throw new Error(`Could not record Campaign event: ${error.message}`);
}

export async function linkDiscoveryTriggerRun(
  context: CampaignExecutionContext,
  triggerRunId: string,
  executionId = context.discoveryExecutionId,
) {
  const { error } = await createServiceRoleClient()
    .from("provider_executions")
    .update({ provider_reference: triggerRunId })
    .eq("workspace_id", context.workspaceId)
    .eq("id", executionId);
  if (error) throw new Error(`Could not link discovery child run: ${error.message}`);
}

export async function createCampaignAgentIterationExecution(input: {
  context: CampaignExecutionContext;
  planningInputHash?: string;
  iteration: number;
  plan: CampaignAgentPlan;
}) {
  const idempotencyKey = `campaign-agent-discovery:${input.context.campaignRunId}:${input.iteration}`;
  const planHash = createHash("sha256").update(JSON.stringify(input.plan)).digest("hex");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("provider_executions")
    .upsert(
      {
        workspace_id: input.context.workspaceId,
        campaign_run_id: input.context.campaignRunId,
        parent_execution_id: input.context.discoveryExecutionId,
        agent_iteration: input.iteration,
        provider: "tavily_openrouter",
        operation: "campaign_discovery",
        idempotency_key: idempotencyKey,
        request_hash: planHash,
        status: "pending",
        metadata: {
          agentIteration: input.iteration,
          agentTool: "discover_companies",
          agentToolVersion: "v1",
          parentExecutionId: input.context.discoveryExecutionId,
          plan: input.plan,
          planHash,
          planningInputHash: input.planningInputHash ?? null,
          planRationale: input.plan.rationale,
        },
      },
      {
        onConflict: "parent_execution_id,agent_iteration",
        ignoreDuplicates: true,
      },
    )
    .select("id,status,metadata")
    .maybeSingle();
  if (error)
    throw new Error(`Could not create Campaign Agent iteration: ${error.message}`);
  if (data) return { executionId: data.id, plan: input.plan };

  const { data: existing, error: existingError } = await supabase
    .from("provider_executions")
    .select("id,metadata")
    .eq("parent_execution_id", input.context.discoveryExecutionId)
    .eq("agent_iteration", input.iteration)
    .single();
  if (existingError)
    throw new Error(`Could not load Campaign Agent iteration: ${existingError.message}`);
  const metadata = asRecord(existing.metadata);
  const persistedPlan = campaignAgentPlan(metadata.plan);
  if (persistedPlan) return { executionId: existing.id, plan: persistedPlan };
  const { error: repairError } = await supabase
    .from("provider_executions")
    .update({
      request_hash: planHash,
      metadata: {
        ...metadata,
        plan: input.plan,
        planHash,
        planningInputHash: input.planningInputHash ?? null,
      },
    })
    .eq("workspace_id", input.context.workspaceId)
    .eq("id", existing.id);
  if (repairError)
    throw new Error(`Could not persist Campaign Agent plan: ${repairError.message}`);
  return { executionId: existing.id, plan: input.plan };
}

export async function loadPersistedCampaignAgentPlan(input: {
  context: CampaignExecutionContext;
  iteration: number;
}) {
  const { data, error } = await createServiceRoleClient()
    .from("provider_executions")
    .select("metadata")
    .eq("workspace_id", input.context.workspaceId)
    .eq("parent_execution_id", input.context.discoveryExecutionId)
    .eq("agent_iteration", input.iteration)
    .maybeSingle();
  if (error)
    throw new Error(`Could not load persisted Campaign Agent plan: ${error.message}`);
  return campaignAgentPlan(asRecord(data?.metadata).plan);
}

export async function completeCampaignAgentParentExecution(
  context: CampaignExecutionContext,
  result: { acceptedCompanies: number; inspectedCompanies: number; iteration: number },
) {
  const { error } = await createServiceRoleClient()
    .from("provider_executions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: {
        orchestrationOnly: true,
        agentIterations: result.iteration,
        acceptedCompanies: result.acceptedCompanies,
        inspectedCompanies: result.inspectedCompanies,
      },
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.discoveryExecutionId)
    .in("status", ["pending", "running"]);
  if (error)
    throw new Error(`Could not complete Campaign Agent parent: ${error.message}`);
}

export async function recordCampaignAgentPlannerRequest(input: {
  context: CampaignExecutionContext;
  result: CampaignAgentPlannerResult;
}) {
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input.result.input))
    .digest("hex");
  const execution = await createCampaignAgentIterationExecution({
    context: input.context,
    planningInputHash: requestHash,
    iteration: input.result.iteration,
    plan: input.result.plan,
  });
  const executionId = execution.executionId;
  const supabase = createServiceRoleClient();
  const { data: existing, error: lookupError } = await supabase
    .from("ai_requests")
    .select("id")
    .eq("workspace_id", input.context.workspaceId)
    .eq("provider_execution_id", executionId)
    .eq("role", "campaign_planning")
    .eq("prompt_version", campaignAgentPlannerPromptVersion)
    .eq("request_hash", requestHash)
    .maybeSingle();
  if (lookupError)
    throw new Error(
      `Could not check Campaign Agent planner audit: ${lookupError.message}`,
    );
  if (existing) return;

  const modelConfigId = await resolveCampaignPlanningModelConfig(
    input.context.workspaceId,
  );
  const completedAt = new Date();
  const startedAt = new Date(completedAt.getTime() - input.result.modelCall.latencyMs);
  const { error } = await supabase.from("ai_requests").insert({
    workspace_id: input.context.workspaceId,
    campaign_run_id: input.context.campaignRunId,
    provider_execution_id: executionId,
    model_config_id: modelConfigId,
    role: "campaign_planning",
    provider: input.result.modelCall.provider,
    selected_model:
      input.result.modelCall.actualModel ?? input.result.modelCall.requestedModel,
    fallback_model: input.result.modelCall.fallbackUsed
      ? input.result.modelCall.actualModel
      : null,
    fallback_used: input.result.modelCall.fallbackUsed,
    prompt_version: campaignAgentPlannerPromptVersion,
    schema_version: "campaign-agent-plan-v1",
    request_hash: requestHash,
    status: "completed",
    input_units: input.result.modelCall.inputTokens,
    output_units: input.result.modelCall.outputTokens,
    actual_cost: input.result.modelCall.providerReportedCost ?? 0,
    currency: input.result.modelCall.providerCurrency ?? "USD",
    metadata: {
      iteration: input.result.iteration,
      providerRequestId: input.result.modelCall.providerRequestId,
      rationale: input.result.plan.rationale,
      queryCount: input.result.plan.queries.length,
    },
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
  });
  if (error)
    throw new Error(`Could not save Campaign Agent planner audit: ${error.message}`);
}

export async function failCampaignOrchestration(
  context: CampaignExecutionContext,
  failure: unknown,
) {
  const { data: currentRun, error: currentRunError } = await createServiceRoleClient()
    .from("campaign_runs")
    .select("status")
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId)
    .single();
  if (currentRunError)
    throw new Error(
      `Could not inspect Campaign failure state: ${currentRunError.message}`,
    );
  if (currentRun.status === "cancelled") return;
  const message =
    failure instanceof Error
      ? failure.message.slice(0, 2_000)
      : "Campaign orchestration failed.";
  const failedAt = new Date().toISOString();
  const supabase = createServiceRoleClient();
  const [{ error: parentError }, { error: childrenError }, { error: runError }] =
    await Promise.all([
      supabase
        .from("provider_executions")
        .update({
          status: "failed",
          completed_at: failedAt,
          error_code: "campaign_orchestration_failed",
          error_message: message,
          dispatch_state: "failed",
          dispatch_updated_at: failedAt,
          last_dispatch_error: message,
        })
        .eq("workspace_id", context.workspaceId)
        .eq("id", context.discoveryExecutionId)
        .in("status", ["pending", "running"]),
      supabase
        .from("provider_executions")
        .update({
          status: "failed",
          completed_at: failedAt,
          error_code: "campaign_orchestration_aborted",
          error_message: message,
          dispatch_state: "failed",
          dispatch_updated_at: failedAt,
          last_dispatch_error: message,
        })
        .eq("workspace_id", context.workspaceId)
        .eq("parent_execution_id", context.discoveryExecutionId)
        .in("status", ["pending", "running"]),
      supabase
        .from("campaign_runs")
        .update({
          status: "failed",
          current_phase: "failed",
          failed_at: failedAt,
          error_code: "campaign_orchestration_failed",
          error_message: message,
          dispatch_state: "failed",
          dispatch_updated_at: failedAt,
          last_dispatch_error: message,
        })
        .eq("workspace_id", context.workspaceId)
        .eq("id", context.campaignRunId),
    ]);
  if (parentError || childrenError || runError)
    throw new Error(
      `Could not persist Campaign orchestration failure: ${
        parentError?.message ?? childrenError?.message ?? runError?.message
      }`,
    );
  await appendEventOnce(context, {
    eventType: "campaign_orchestration_failed",
    phase: "failed",
    level: "error",
    summary: "Campaign execution failed after all permitted attempts.",
  });
}

export async function markOptionalEnrichmentGate(context: CampaignExecutionContext) {
  const supabase = createServiceRoleClient();
  const { data: run, error: loadError } = await supabase
    .from("campaign_runs")
    .select("companies_qualified,status")
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId)
    .single();
  if (loadError)
    throw new Error(`Could not load Campaign Run completion state: ${loadError.message}`);
  if (run.status === "cancelled") return;
  const targetReached = run.companies_qualified >= context.desiredCompanyCount;
  const { error: runError } = await supabase
    .from("campaign_runs")
    .update({
      status: targetReached ? "completed" : "partially_completed",
      current_phase: "ready_for_review",
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq("workspace_id", context.workspaceId)
    .eq("id", context.campaignRunId);
  if (runError) throw new Error(`Could not finalize Campaign Run: ${runError.message}`);
  await appendEventOnce(context, {
    eventType: "optional_enrichment_deferred",
    phase: "ready_for_review",
    level: "info",
    summary:
      "Discovery and qualification completed. Contact enrichment is optional and currently deferred.",
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function campaignAgentPlan(value: unknown): CampaignAgentPlan | null {
  const row = asRecord(value);
  const queries = Array.isArray(row.queries)
    ? row.queries.filter(
        (query): query is string => typeof query === "string" && Boolean(query.trim()),
      )
    : [];
  const resultsPerQuery = Number(row.resultsPerQuery);
  const rationale = stringValue(row.rationale);
  if (
    !queries.length ||
    !Number.isInteger(resultsPerQuery) ||
    resultsPerQuery < 1 ||
    !rationale
  )
    return null;
  return { queries, rationale, resultsPerQuery };
}

function positiveInteger(primary: unknown, fallback: unknown) {
  const value = Number(primary ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : 25;
}

async function resolveCampaignPlanningModelConfig(workspaceId: string) {
  const { data, error } = await createServiceRoleClient()
    .from("ai_model_configs")
    .select("id,workspace_id")
    .eq("role", "campaign_planning")
    .eq("enabled", true)
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("workspace_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  if (error)
    throw new Error(`Could not resolve Campaign planning model: ${error.message}`);
  return data.id;
}

function normalizeCampaignAgentPlanningContext(input: {
  campaign: Record<string, unknown>;
  clarifications: Array<{ answer: string; question: string }>;
  memories: Array<{ category: string; confidence: string; statement: string }>;
  documents: Array<{ content: string; fileName: string }>;
  companyProfile: Record<string, unknown>;
  strategy: Record<string, unknown>;
}) {
  const offerings = Array.isArray(input.companyProfile.offerings)
    ? input.companyProfile.offerings.map(asRecord)
    : [];
  const selectedOfferingId = stringValue(input.campaign.selected_offering_id);
  const selectedOffering =
    offerings.find((offering) => stringValue(offering.id) === selectedOfferingId) ?? null;
  return {
    campaign: {
      name: stringValue(input.campaign.name),
      objective: stringValue(input.campaign.objective),
      targetGeography: stringValue(input.campaign.target_geography),
      targetDescription: stringValue(input.campaign.initial_target_description),
      industries: stringArray(input.campaign.industries),
      companyCharacteristics: stringArray(input.campaign.company_characteristics),
      relevantUseCase: stringValue(input.campaign.relevant_use_case),
      exclusions: stringArray(input.campaign.exclusions),
      targetVolume: input.campaign.target_volume,
      discoveryLanguages: stringArray(input.strategy.searchLanguages),
      selectedOfferingId,
    },
    clarifications: input.clarifications.filter((item) => item.answer),
    approvedMemories: input.memories,
    relevantDocuments: input.documents,
    companyProfile: {
      companyName: stringValue(input.companyProfile.companyName),
      shortOverview: stringValue(input.companyProfile.shortOverview),
      selectedOffering,
      prospectingMarkets: stringArray(input.companyProfile.prospectingMarkets),
    },
    strategy: input.strategy,
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function rankDocumentChunks(
  chunks: Array<{
    chunk_index: number;
    content: string;
    document: { file_name: string } | Array<{ file_name: string }>;
  }>,
  terms: string[],
) {
  const tokens = uniqueTokens(terms.join(" "));
  return chunks
    .map((chunk) => {
      const normalized = chunk.content.toLowerCase();
      const document = Array.isArray(chunk.document) ? chunk.document[0] : chunk.document;
      return {
        content: chunk.content.slice(0, 1_500),
        fileName: document?.file_name ?? "Campaign material",
        score: tokens.reduce(
          (total, token) => total + (normalized.includes(token) ? 1 : 0),
          0,
        ),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map(({ content, fileName }) => ({ content, fileName }));
}

function uniqueTokens(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4),
    ),
  ];
}
