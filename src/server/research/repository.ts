import { createHash } from "node:crypto";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ResearchProgress } from "@/types/domain";
import {
  dispatchCampaignRun,
  dispatchProviderExecution,
} from "@/server/trigger/dispatch";

type CampaignRunRow = {
  candidates_classified: number;
  candidates_discovered: number;
  candidates_unique: number;
  companies_evaluated: number;
  companies_discovered: number;
  companies_qualified: number;
  contacts_found: number;
  current_iteration: number;
  current_phase: string;
  error_message: string | null;
  id: string;
  metadata: Record<string, unknown>;
  progress_percentage: number;
  status: string;
};

async function createOperationalDatabaseClient() {
  return { supabase: createServiceRoleClient() };
}

export async function enqueueCampaignDiscoveryRun(input: {
  campaignId: string;
  desiredLeadCount: number;
  workspaceId: string;
}): Promise<{ runId: string }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase.rpc("create_clean_campaign_run", {
    target_workspace_id: input.workspaceId,
    target_campaign_external_id: input.campaignId,
    desired_company_count: input.desiredLeadCount,
  });
  if (error) throw new Error(`Could not create Campaign Run: ${error.message}`);
  const campaignRun = data as { id: string };
  await dispatchCampaignRun({
    campaignRunId: campaignRun.id,
    workspaceId: input.workspaceId,
  });
  return { runId: campaignRun.id };
}

export async function enqueueLeadContactEnrichmentRun(input: {
  leadId: string;
  workspaceId: string;
}): Promise<{ runId: string }> {
  const { supabase } = await createOperationalDatabaseClient();
  const { data: association, error: associationError } = await supabase
    .from("campaign_companies")
    .select("id,company_id,campaign_id")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.leadId)
    .single();
  if (associationError)
    throw new Error(
      `Could not load company for contact research: ${associationError.message}`,
    );

  const { data: campaignRun, error: campaignRunError } = await supabase
    .from("campaign_runs")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", association.campaign_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (campaignRunError)
    throw new Error(`Could not resolve Campaign Run: ${campaignRunError.message}`);

  const idempotencyKey = `contact-enrichment:${input.leadId}:${campaignRun?.id ?? "manual"}`;
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ campaignCompanyId: input.leadId }))
    .digest("hex");
  const { data: previous, error: previousError } = await supabase
    .from("provider_executions")
    .select("id,status,dispatch_state")
    .eq("workspace_id", input.workspaceId)
    .eq("operation", "contact_enrichment")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (previousError)
    throw new Error(
      `Could not check contact enrichment execution: ${previousError.message}`,
    );
  if (
    previous &&
    ["pending", "running", "completed"].includes(previous.status) &&
    !["created", "dispatch_failed"].includes(previous.dispatch_state)
  )
    return { runId: previous.id };

  const { data: enrichment, error: enrichmentError } = await supabase
    .from("contact_enrichments")
    .upsert(
      {
        workspace_id: input.workspaceId,
        company_id: association.company_id,
        campaign_run_id: campaignRun?.id ?? null,
        provider: "tavily",
        status: "pending",
        idempotency_key: idempotencyKey,
      },
      { onConflict: "workspace_id,idempotency_key" },
    )
    .select("id")
    .single();
  if (enrichmentError)
    throw new Error(`Could not create contact enrichment: ${enrichmentError.message}`);

  const executionValues = {
    workspace_id: input.workspaceId,
    campaign_run_id: campaignRun?.id ?? null,
    provider: "tavily",
    operation: "contact_enrichment",
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    status: "pending",
    dispatch_state: "created",
    error_code: null,
    error_message: null,
    completed_at: null,
    metadata: {
      campaignCompanyId: input.leadId,
      contactEnrichmentId: enrichment.id,
    },
  };
  const executionQuery = previous
    ? supabase
        .from("provider_executions")
        .update(executionValues)
        .eq("workspace_id", input.workspaceId)
        .eq("id", previous.id)
    : supabase.from("provider_executions").insert(executionValues);
  const { data: execution, error: executionError } = await executionQuery
    .select("id")
    .single();
  if (executionError)
    throw new Error(`Could not create contact execution: ${executionError.message}`);

  const runId = execution.id;
  await dispatchProviderExecution({
    providerExecutionId: runId,
    workspaceId: input.workspaceId,
  });
  if (campaignRun?.id) {
    const { error: runStateError } = await supabase
      .from("campaign_runs")
      .update({
        status: "enriching",
        current_phase: "enriching",
        progress_percentage: 90,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", campaignRun.id);
    if (runStateError)
      throw new Error(
        `Could not update Campaign enrichment phase: ${runStateError.message}`,
      );
  }

  return { runId };
}

export async function enqueueCampaignDraftGenerationRun(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<{ runId: string; taskCount: number }> {
  const { supabase } = await createOperationalDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,current_strategy_version_id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignId)
    .single();
  if (campaignError)
    throw new Error(
      `Could not load campaign for draft generation: ${campaignError.message}`,
    );
  if (!campaign.current_strategy_version_id)
    throw new Error(
      "Save the Company Profile and Campaign Strategy before generating drafts.",
    );

  const { data: campaignRun, error: campaignRunError } = await supabase
    .from("campaign_runs")
    .select("id,profile_snapshot_id,strategy_version_id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (campaignRunError)
    throw new Error(`Could not load frozen Campaign Run: ${campaignRunError.message}`);

  const { data: selected, error: selectedError } = await supabase
    .from("campaign_contacts")
    .select(
      "id,campaign_company_id,campaign_company:campaign_companies!inner(campaign_id,status)",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("selection_status", "selected")
    .eq("campaign_company.campaign_id", campaign.id)
    .in("campaign_company.status", ["approved", "draft_ready"]);
  if (selectedError)
    throw new Error(`Could not load selected draft recipients: ${selectedError.message}`);
  if (selected.length === 0)
    throw new Error("Accept at least one recipient selection before generating drafts.");

  const { error: runStateError } = await supabase
    .from("campaign_runs")
    .update({
      status: "preparing_outreach",
      current_phase: "preparing_outreach",
      progress_percentage: 95,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", campaignRun.id);
  if (runStateError)
    throw new Error(`Could not update Campaign draft phase: ${runStateError.message}`);

  const executionIds: string[] = [];
  for (const recipient of selected) {
    const idempotencyKey = `draft-generation:${campaignRun.id}:${recipient.campaign_company_id}:${recipient.id}`;
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          campaignRunId: campaignRun.id,
          campaignCompanyId: recipient.campaign_company_id,
          campaignContactId: recipient.id,
        }),
      )
      .digest("hex");
    const { data: previous, error: previousError } = await supabase
      .from("provider_executions")
      .select("id,status,dispatch_state")
      .eq("workspace_id", input.workspaceId)
      .eq("operation", "draft_generation")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (previousError)
      throw new Error(`Could not check draft execution: ${previousError.message}`);
    if (
      previous &&
      ["pending", "running", "completed"].includes(previous.status) &&
      !["created", "dispatch_failed"].includes(previous.dispatch_state)
    ) {
      executionIds.push(previous.id);
      continue;
    }

    const executionValues = {
      workspace_id: input.workspaceId,
      campaign_run_id: campaignRun.id,
      provider: "openrouter",
      operation: "draft_generation",
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status: "pending",
      dispatch_state: "created",
      error_code: null,
      error_message: null,
      completed_at: null,
      metadata: {
        campaignId: campaign.id,
        campaignCompanyId: recipient.campaign_company_id,
        campaignContactId: recipient.id,
        profileSnapshotId: campaignRun.profile_snapshot_id,
        strategyVersionId: campaignRun.strategy_version_id,
      },
    };
    const executionQuery = previous
      ? supabase
          .from("provider_executions")
          .update(executionValues)
          .eq("workspace_id", input.workspaceId)
          .eq("id", previous.id)
      : supabase.from("provider_executions").insert(executionValues);
    const { data: execution, error: executionError } = await executionQuery
      .select("id")
      .single();
    if (executionError)
      throw new Error(`Could not create draft execution: ${executionError.message}`);

    await dispatchProviderExecution({
      providerExecutionId: execution.id,
      workspaceId: input.workspaceId,
    });
    executionIds.push(execution.id);
  }

  return {
    runId: executionIds[0] ?? campaignRun.id,
    taskCount: executionIds.length,
  };
}

export async function getCampaignResearchProgress(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<ResearchProgress | null> {
  const { supabase } = await createOperationalDatabaseClient();
  if (input.campaignId === "company-profile") {
    return getNativeCompanyProfileProgress(input.workspaceId, supabase);
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignId)
    .maybeSingle();
  if (campaignError)
    throw new Error(`Could not load Campaign progress context: ${campaignError.message}`);
  if (!campaign) return null;

  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select(
      "id,status,current_phase,current_iteration,progress_percentage,candidates_discovered,candidates_unique,candidates_classified,companies_evaluated,companies_discovered,companies_qualified,contacts_found,error_message,metadata",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    throw new Error(`Could not load Campaign Run progress: ${runError.message}`);
  }

  if (!run) {
    return null;
  }

  const runRow = run as CampaignRunRow;
  const status = toResearchProgressStatus(runRow.status);
  const totalTasks = 100;
  const liveResearch = await loadLiveCandidateResearchProgress({
    campaignRunId: runRow.id,
    currentPhase: runRow.current_phase,
    supabase,
    workspaceId: input.workspaceId,
  });
  const projectedProgress = liveResearch
    ? Math.max(
        runRow.progress_percentage,
        Math.min(
          66,
          50 + Math.round((liveResearch.completed / liveResearch.total) * 17),
        ),
      )
    : runRow.progress_percentage;
  const completedTasks = Math.max(0, Math.min(100, projectedProgress));

  return {
    candidatesDiscovered: runRow.candidates_discovered,
    candidatesUnique: runRow.candidates_unique,
    candidatesClassified: runRow.candidates_classified,
    companiesEvaluated: Math.max(
      runRow.companies_evaluated,
      liveResearch?.completed ?? 0,
    ),
    companiesQualified: runRow.companies_qualified,
    currentIteration: runRow.current_iteration,
    completedTasks,
    currentStep: liveResearch
      ? `Researching candidates (${liveResearch.completed}/${liveResearch.total})`
      : campaignPhaseLabel(runRow.current_phase),
    failedTasks: status === "failed" ? 1 : 0,
    lastError: runRow.error_message ?? "",
    progress: projectedProgress,
    runId: runRow.id,
    status,
    totalTasks,
  };
}

async function loadLiveCandidateResearchProgress(input: {
  campaignRunId: string;
  currentPhase: string;
  supabase: ReturnType<typeof createServiceRoleClient>;
  workspaceId: string;
}) {
  if (input.currentPhase !== "evaluating_candidates") return null;
  const { data: batch, error: batchError } = await input.supabase
    .from("candidate_research_batches_v2")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .maybeSingle();
  if (batchError)
    throw new Error(`Could not load live Candidate Research batch: ${batchError.message}`);
  if (!batch) return null;
  const { data: members, error: memberError } = await input.supabase
    .from("candidate_research_batch_members_v2")
    .select("status")
    .eq("workspace_id", input.workspaceId)
    .eq("candidate_research_batch_id", batch.id);
  if (memberError)
    throw new Error(
      `Could not load live Candidate Research members: ${memberError.message}`,
    );
  const total = members?.length ?? 0;
  if (!total) return null;
  return {
    completed: members!.filter(({ status: memberStatus }) =>
      ["completed", "blocked"].includes(memberStatus),
    ).length,
    total,
  };
}

async function getNativeCompanyProfileProgress(
  workspaceId: string,
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<ResearchProgress | null> {
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("current_v3_draft_id")
    .eq("workspace_id", workspaceId)
    .single();
  if (profileError)
    throw new Error(
      `Could not load native profile analysis context: ${profileError.message}`,
    );
  if (!profile.current_v3_draft_id) return null;

  const draftId = profile.current_v3_draft_id;
  const [
    { data: draft, error: draftError },
    { data: taskRuns, error: taskError },
    { data: failureEvent, error: eventError },
  ] = await Promise.all([
    supabase
      .from("company_profile_drafts")
      .select("id,state,created_by_run_id")
      .eq("workspace_id", workspaceId)
      .eq("id", draftId)
      .single(),
    supabase
      .from("profile_task_runs")
      .select("task_id,status,error_message,created_at")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .order("created_at", { ascending: true }),
    supabase
      .from("profile_change_events")
      .select("details_json")
      .eq("workspace_id", workspaceId)
      .eq("profile_draft_id", draftId)
      .eq("event_type", "workflow_failed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const loadError = draftError ?? taskError ?? eventError;
  if (loadError)
    throw new Error(`Could not load native profile progress: ${loadError.message}`);
  if (!draft)
    throw new Error("Could not load the current native Company Intelligence draft.");

  const stages = taskRuns ?? [];
  const latestStageByTask = new Map(
    stages.map((stage) => [stage.task_id, stage] as const),
  );
  const latestStages = profileV3StageOrder.flatMap((taskId) => {
    const stage = latestStageByTask.get(taskId);
    return stage ? [stage] : [];
  });
  const completedStageCount = latestStages.filter(
    ({ status }) => status === "completed",
  ).length;
  const failedStageCount = latestStages.filter(({ status }) => status === "failed").length;
  const failedTask = [...latestStages]
    .reverse()
    .find(({ status }) => status === "failed");
  const activeTask = [...latestStages]
    .reverse()
    .find(({ status }) => ["pending", "running"].includes(status));
  const terminal = ["needs_input", "ready_for_review", "approved"].includes(draft.state);
  const status: ResearchProgress["status"] =
    draft.state === "failed"
      ? "failed"
      : draft.state === "abandoned"
        ? "cancelled"
        : draft.state === "needs_input"
          ? "waiting_for_input"
          : terminal
            ? "completed"
            : draft.created_by_run_id
              ? "running"
              : "pending";
  const completedTasks = terminal ? profileV3StageOrder.length : completedStageCount;
  const progress =
    status === "completed" || status === "waiting_for_input"
      ? 100
      : status === "failed"
        ? Math.round((completedTasks / profileV3StageOrder.length) * 100)
        : Math.max(5, Math.round((completedTasks / profileV3StageOrder.length) * 100));
  const failureDetails = objectValue(failureEvent?.details_json);
  const lastError =
    status === "failed"
      ? (failedTask?.error_message ?? stringValue(failureDetails.errorMessage) ?? "")
      : "";

  return {
    completedTasks,
    currentStep:
      status === "completed"
        ? "Company Intelligence review is ready"
        : status === "waiting_for_input"
          ? "Company Intelligence needs your review"
          : status === "failed"
            ? "Company Intelligence analysis failed"
            : activeTask
              ? (profileV3StageLabels[activeTask.task_id] ?? activeTask.task_id)
              : completedTasks
                ? "Finalizing Company Intelligence"
                : "Collecting official website evidence",
    failedTasks: status === "failed" ? Math.max(1, failedStageCount) : 0,
    lastError,
    progress,
    runId: draft.created_by_run_id ?? draft.id,
    status,
    totalTasks: profileV3StageOrder.length,
  };
}

const profileV3StageOrder = [
  "profile.fact_extraction",
  "profile.commercial_synthesis",
  "profile.offering_decomposition",
  "profile.buyer_logic",
  "profile.clarification",
  "profile.consistency_audit",
] as const;

const profileV3StageLabels: Record<string, string> = {
  "profile.fact_extraction": "Extracting official website facts",
  "profile.commercial_synthesis": "Synthesizing the commercial model",
  "profile.offering_decomposition": "Structuring campaign-worthy offerings",
  "profile.buyer_logic": "Building offering-specific buyer logic",
  "profile.clarification": "Preparing focused clarification questions",
  "profile.consistency_audit": "Auditing evidence and consistency",
};

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toResearchProgressStatus(status: string): ResearchProgress["status"] {
  if (status === "queued" || status === "draft") return "pending";
  if (status === "completed" || status === "partially_completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "waiting_for_input") return "waiting_for_input";
  return "running";
}

function campaignPhaseLabel(phase: string) {
  const labels: Record<string, string> = {
    discovery_queued: "Queued market exploration",
    market_analysis: "Analyzing the selected market",
    discovery_planning: "Building discovery paths",
    discovering: "Exploring market sources",
    evaluating: "Resolving plausible organizations",
    qualifying: "Researching and evaluating candidates",
    paused: "Campaign paused",
    ready_for_review: "Research results ready for review",
    waiting_for_enrichment_approval: "Waiting for enrichment approval",
    waiting_for_input: "Waiting for your targeting clarification",
    enriching: "Finding company contacts",
    preparing_outreach: "Preparing outreach drafts",
    completed: "Campaign run completed",
  };
  return labels[phase] ?? phase.replaceAll("_", " ");
}
