import { createHash } from "node:crypto";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ResearchProgress } from "@/types/domain";
import {
  cancelTriggerRuns,
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

export async function enqueueCampaignAgentResume(input: {
  campaignRunId: string;
  questionId: string;
  workspaceId: string;
}) {
  return dispatchCampaignRun({
    campaignRunId: input.campaignRunId,
    idempotencyKey: `execute-campaign-resume:${input.campaignRunId}:${input.questionId}`,
    tags: [`campaign_question:${input.questionId}`],
    workspaceId: input.workspaceId,
  });
}

export async function resumePausedCampaignRun(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<{ runId: string } | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignId)
    .single();
  if (campaignError)
    throw new Error(`Could not resolve paused Campaign: ${campaignError.message}`);
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select("id,current_iteration,status,current_phase")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaign.id)
    .eq("status", "waiting_for_input")
    .eq("current_phase", "paused")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError)
    throw new Error(`Could not load paused Campaign Run: ${runError.message}`);
  if (!run) return null;
  const { error: stateError } = await supabase
    .from("campaign_runs")
    .update({
      status: "planning",
      current_phase: "discovery_planning",
      error_code: null,
      error_message: null,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", run.id);
  if (stateError) throw new Error(`Could not resume Campaign Run: ${stateError.message}`);
  await dispatchCampaignRun({
    campaignRunId: run.id,
    idempotencyKey: `execute-campaign-resume:${run.id}:${run.current_iteration}`,
    tags: ["campaign_resume"],
    workspaceId: input.workspaceId,
  });
  return { runId: run.id };
}

export async function stopActiveCampaignRun(input: {
  campaignId: string;
  workspaceId: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignId)
    .single();
  if (campaignError)
    throw new Error(`Could not resolve Campaign to stop: ${campaignError.message}`);
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select("id,trigger_run_id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", campaign.id)
    .not("status", "in", '("completed","partially_completed","failed","cancelled")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError)
    throw new Error(`Could not load active Campaign Run: ${runError.message}`);
  if (!run) return { cancelledTriggerRuns: 0, runId: null };

  const stoppedAt = new Date().toISOString();
  const { data: executions, error: executionLoadError } = await supabase
    .from("provider_executions")
    .select("id,trigger_run_id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", run.id)
    .in("status", ["pending", "running"]);
  if (executionLoadError)
    throw new Error(
      `Could not load active provider executions: ${executionLoadError.message}`,
    );
  const [{ error: runUpdateError }, { error: executionUpdateError }] = await Promise.all([
    supabase
      .from("campaign_runs")
      .update({
        status: "cancelled",
        current_phase: "cancelled",
        cancelled_at: stoppedAt,
        error_code: "campaign_cancelled",
        error_message: "Campaign stopped by the user.",
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", run.id),
    supabase
      .from("provider_executions")
      .update({
        status: "cancelled",
        completed_at: stoppedAt,
        error_code: "campaign_cancelled",
        error_message: "Campaign stopped by the user.",
      })
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", run.id)
      .in("status", ["pending", "running"]),
  ]);
  if (runUpdateError || executionUpdateError) {
    throw new Error(
      `Could not persist Campaign cancellation: ${
        runUpdateError?.message ?? executionUpdateError?.message
      }`,
    );
  }

  const cancellation = await cancelTriggerRuns([
    run.trigger_run_id ?? "",
    ...(executions ?? []).map((item) => item.trigger_run_id ?? ""),
  ]);
  if (cancellation.failures.length) {
    const { error } = await supabase
      .from("campaign_runs")
      .update({
        last_dispatch_error: cancellation.failures
          .map((item) => `${item.runId}: ${item.message}`)
          .join("; ")
          .slice(0, 2_000),
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", run.id);
    if (error)
      throw new Error(`Could not record Trigger cancellation result: ${error.message}`);
  }
  return { cancelledTriggerRuns: cancellation.cancelled, runId: run.id };
}

export async function enqueueLeadContactEnrichmentRun(input: {
  leadId: string;
  workspaceId: string;
}): Promise<{ runId: string }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
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
  const { supabase } = await createAuthenticatedDatabaseClient();
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

export async function enqueueCompanyProfileAnalysisRun(input: {
  workspaceId: string;
  profileVersionId: string;
  website: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const idempotencyKey = `company-profile-analysis:${input.profileVersionId}`;
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ profileVersionId: input.profileVersionId }))
    .digest("hex");
  const { data: previous, error: previousError } = await supabase
    .from("provider_executions")
    .select("id,status,dispatch_state")
    .eq("workspace_id", input.workspaceId)
    .eq("operation", "company_profile_analysis")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (previousError)
    throw new Error(
      `Could not check Company Profile analysis execution: ${previousError.message}`,
    );
  if (
    previous &&
    ["pending", "running", "completed"].includes(previous.status) &&
    !["created", "dispatch_failed"].includes(previous.dispatch_state)
  )
    return { runId: previous.id };

  const executionValues = {
    workspace_id: input.workspaceId,
    provider: "tavily_openrouter",
    operation: "company_profile_analysis",
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    status: "pending",
    dispatch_state: "created",
    error_code: null,
    error_message: null,
    completed_at: null,
    metadata: {
      profileVersionId: input.profileVersionId,
      website: input.website,
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
    throw new Error(
      `Could not create Company Profile analysis execution: ${executionError.message}`,
    );

  const runId = execution.id;
  await dispatchProviderExecution({
    providerExecutionId: runId,
    workspaceId: input.workspaceId,
  });

  return { runId };
}

export async function getCampaignResearchProgress(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<ResearchProgress | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  if (input.campaignId === "company-profile") {
    const { data, error } = await supabase
      .from("provider_executions")
      .select("id,status,error_message")
      .eq("workspace_id", input.workspaceId)
      .eq("operation", "company_profile_analysis")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new Error(`Could not load profile analysis progress: ${error.message}`);
    if (!data) return null;
    const status = data.status as ResearchProgress["status"];
    return {
      completedTasks: status === "completed" ? 1 : 0,
      currentStep:
        status === "pending"
          ? "Queued website analysis"
          : status === "running"
            ? "Analyzing company website"
            : status === "completed"
              ? "Company Profile analysis completed"
              : "Company Profile analysis failed",
      failedTasks: status === "failed" ? 1 : 0,
      lastError: data.error_message ?? "",
      progress: status === "completed" ? 100 : status === "running" ? 50 : 0,
      runId: data.id,
      status,
      totalTasks: 1,
    };
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
  const desired = positiveInteger(runRow.metadata.desiredCompanyCount);
  const completed =
    runRow.status === "completed" || runRow.status === "partially_completed"
      ? desired
      : Math.min(runRow.companies_qualified, desired);

  return {
    candidatesDiscovered: runRow.candidates_discovered,
    candidatesUnique: runRow.candidates_unique,
    candidatesClassified: runRow.candidates_classified,
    companiesEvaluated: runRow.companies_evaluated,
    companiesQualified: runRow.companies_qualified,
    currentIteration: runRow.current_iteration,
    completedTasks: completed,
    currentStep: campaignPhaseLabel(runRow.current_phase),
    failedTasks: status === "failed" ? 1 : 0,
    lastError: runRow.error_message ?? "",
    progress: runRow.progress_percentage,
    runId: runRow.id,
    status,
    totalTasks: desired,
  };
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function toResearchProgressStatus(status: string): ResearchProgress["status"] {
  if (status === "queued" || status === "draft") return "pending";
  if (status === "completed" || status === "partially_completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "running";
}

function campaignPhaseLabel(phase: string) {
  const labels: Record<string, string> = {
    discovery_queued: "Queued company discovery",
    market_analysis: "Analyzing the selected market",
    discovery_planning: "Building discovery paths",
    discovering: "Discovering companies",
    evaluating: "Classifying candidates",
    qualifying: "Evaluating promising companies",
    paused: "Campaign paused",
    ready_for_review: "Qualified companies ready for review",
    waiting_for_enrichment_approval: "Waiting for enrichment approval",
    waiting_for_input: "Waiting for your targeting clarification",
    enriching: "Finding company contacts",
    preparing_outreach: "Preparing outreach drafts",
    completed: "Campaign run completed",
  };
  return labels[phase] ?? phase.replaceAll("_", " ");
}
