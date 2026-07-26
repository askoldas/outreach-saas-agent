import { createHash } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ResearchProgress } from "@/types/domain";
import type { analyzeCompanyProfileTask } from "@/trigger/analyze-company-profile";
import type { enrichCompanyContactsTask } from "@/trigger/enrich-company-contacts";
import type { generateOutreachDraftTask } from "@/trigger/generate-outreach-draft";
import type { executeCampaignTask } from "@/trigger/execute-campaign";

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
  const idempotencyKey = `campaign-discovery:${campaignRun.id}`;
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        campaignRunId: campaignRun.id,
        desiredCompanyCount: input.desiredLeadCount,
      }),
    )
    .digest("hex");
  const { error: executionError } = await supabase.from("provider_executions").insert({
    workspace_id: input.workspaceId,
    campaign_run_id: campaignRun.id,
    provider: "tavily_openrouter",
    operation: "campaign_discovery",
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    status: "pending",
    metadata: { desiredCompanyCount: input.desiredLeadCount },
  });
  if (executionError)
    throw new Error(
      `Could not create Campaign discovery execution: ${executionError.message}`,
    );
  const handle = await tasks.trigger<typeof executeCampaignTask>(
    "execute-campaign",
    { campaignRunId: campaignRun.id },
    {
      idempotencyKey: `execute-campaign:${campaignRun.id}`,
      tags: [`workspace:${input.workspaceId}`, `campaign_run:${campaignRun.id}`],
    },
  );
  const { error: runReferenceError } = await supabase
    .from("campaign_runs")
    .update({ trigger_run_id: handle.id })
    .eq("workspace_id", input.workspaceId)
    .eq("id", campaignRun.id);
  if (runReferenceError)
    throw new Error(`Could not link Campaign Run: ${runReferenceError.message}`);
  return { runId: campaignRun.id };
}

export async function enqueueCampaignAgentResume(input: {
  campaignRunId: string;
  questionId: string;
  workspaceId: string;
}) {
  return tasks.trigger<typeof executeCampaignTask>(
    "execute-campaign",
    { campaignRunId: input.campaignRunId },
    {
      idempotencyKey: `execute-campaign-resume:${input.campaignRunId}:${input.questionId}`,
      tags: [
        `workspace:${input.workspaceId}`,
        `campaign_run:${input.campaignRunId}`,
        `campaign_question:${input.questionId}`,
      ],
    },
  );
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
  await tasks.trigger<typeof executeCampaignTask>(
    "execute-campaign",
    { campaignRunId: run.id },
    {
      idempotencyKey: `execute-campaign-resume:${run.id}:${run.current_iteration}`,
      tags: [
        `workspace:${input.workspaceId}`,
        `campaign_run:${run.id}`,
        "campaign_resume",
      ],
    },
  );
  return { runId: run.id };
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
    .select("id,status,attempt")
    .eq("workspace_id", input.workspaceId)
    .eq("operation", "contact_enrichment")
    .eq("idempotency_key", idempotencyKey)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError)
    throw new Error(
      `Could not check contact enrichment execution: ${previousError.message}`,
    );
  if (previous && ["pending", "running", "completed"].includes(previous.status))
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

  const attempt = (previous?.attempt ?? 0) + 1;
  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .insert({
      workspace_id: input.workspaceId,
      campaign_run_id: campaignRun?.id ?? null,
      provider: "tavily",
      operation: "contact_enrichment",
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status: "pending",
      attempt,
      metadata: {
        campaignCompanyId: input.leadId,
        contactEnrichmentId: enrichment.id,
      },
    })
    .select("id")
    .single();
  if (executionError)
    throw new Error(`Could not create contact execution: ${executionError.message}`);

  const runId = execution.id;
  const handle = await tasks.trigger<typeof enrichCompanyContactsTask>(
    "enrich-company-contacts",
    { providerExecutionId: runId },
    {
      idempotencyKey: `${idempotencyKey}:attempt:${attempt}`,
      tags: [`workspace:${input.workspaceId}`, `campaign_company:${input.leadId}`],
    },
  );
  const { error: referenceError } = await supabase
    .from("provider_executions")
    .update({ provider_reference: handle.id })
    .eq("workspace_id", input.workspaceId)
    .eq("id", runId);
  if (referenceError)
    throw new Error(`Could not link Trigger.dev run: ${referenceError.message}`);
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
      .select("id,status,attempt")
      .eq("workspace_id", input.workspaceId)
      .eq("operation", "draft_generation")
      .eq("idempotency_key", idempotencyKey)
      .order("attempt", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousError)
      throw new Error(`Could not check draft execution: ${previousError.message}`);
    if (previous && ["pending", "running", "completed"].includes(previous.status)) {
      executionIds.push(previous.id);
      continue;
    }

    const attempt = (previous?.attempt ?? 0) + 1;
    const { data: execution, error: executionError } = await supabase
      .from("provider_executions")
      .insert({
        workspace_id: input.workspaceId,
        campaign_run_id: campaignRun.id,
        provider: "openrouter",
        operation: "draft_generation",
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        status: "pending",
        attempt,
        metadata: {
          campaignId: campaign.id,
          campaignCompanyId: recipient.campaign_company_id,
          campaignContactId: recipient.id,
          profileSnapshotId: campaignRun.profile_snapshot_id,
          strategyVersionId: campaignRun.strategy_version_id,
        },
      })
      .select("id")
      .single();
    if (executionError)
      throw new Error(`Could not create draft execution: ${executionError.message}`);

    const handle = await tasks.trigger<typeof generateOutreachDraftTask>(
      "generate-outreach-draft",
      { providerExecutionId: execution.id },
      {
        idempotencyKey: `${idempotencyKey}:attempt:${attempt}`,
        tags: [
          `workspace:${input.workspaceId}`,
          `campaign_run:${campaignRun.id}`,
          `campaign_company:${recipient.campaign_company_id}`,
        ],
      },
    );
    const { error: referenceError } = await supabase
      .from("provider_executions")
      .update({ provider_reference: handle.id })
      .eq("workspace_id", input.workspaceId)
      .eq("id", execution.id);
    if (referenceError)
      throw new Error(`Could not link Trigger.dev draft: ${referenceError.message}`);
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
    .select("id,status,attempt")
    .eq("workspace_id", input.workspaceId)
    .eq("operation", "company_profile_analysis")
    .eq("idempotency_key", idempotencyKey)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError)
    throw new Error(
      `Could not check Company Profile analysis execution: ${previousError.message}`,
    );
  if (previous && ["pending", "running", "completed"].includes(previous.status))
    return { runId: previous.id };

  const attempt = (previous?.attempt ?? 0) + 1;
  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .insert({
      workspace_id: input.workspaceId,
      provider: "tavily_openrouter",
      operation: "company_profile_analysis",
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status: "pending",
      attempt,
      metadata: {
        profileVersionId: input.profileVersionId,
        website: input.website,
      },
    })
    .select("id")
    .single();
  if (executionError)
    throw new Error(
      `Could not create Company Profile analysis execution: ${executionError.message}`,
    );

  const runId = (execution as { id: string }).id;
  const handle = await tasks.trigger<typeof analyzeCompanyProfileTask>(
    "analyze-company-profile",
    { providerExecutionId: runId },
    {
      idempotencyKey: `${idempotencyKey}:attempt:${attempt}`,
      tags: [
        `workspace:${input.workspaceId}`,
        `profile_version:${input.profileVersionId}`,
      ],
    },
  );
  const { error: referenceError } = await supabase
    .from("provider_executions")
    .update({ provider_reference: handle.id })
    .eq("workspace_id", input.workspaceId)
    .eq("id", runId);
  if (referenceError)
    throw new Error(`Could not link Trigger.dev run: ${referenceError.message}`);

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
