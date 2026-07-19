import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ResearchProgress } from "@/types/domain";

type ResearchRunRow = {
  id: string;
  status: ResearchProgress["status"];
  progress: number;
  current_step: string;
  error_message: string | null;
};

type ResearchTaskRow = {
  status: "cancelled" | "completed" | "failed" | "pending" | "retrying" | "running";
};

export async function enqueueCampaignDiscoveryRun(input: {
  campaignId: string;
  desiredLeadCount: number;
  workspaceId: string;
}): Promise<{ runId: string }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .insert({
      campaign_id: input.campaignId,
      current_step: "Queued lead discovery",
      progress: 0,
      status: "pending",
      workspace_id: input.workspaceId,
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(`Could not create research run: ${runError.message}`);
  }

  const runId = (run as { id: string }).id;
  const { error: taskError } = await supabase.from("research_tasks").insert({
    campaign_id: input.campaignId,
    max_attempts: 3,
    payload_json: {
      desiredLeadCount: input.desiredLeadCount,
    },
    run_id: runId,
    status: "pending",
    task_type: "search_web",
    workspace_id: input.workspaceId,
  });

  if (taskError) {
    throw new Error(`Could not enqueue research task: ${taskError.message}`);
  }

  return { runId };
}

export async function enqueueLeadContactEnrichmentRun(input: {
  leadId: string;
  workspaceId: string;
}): Promise<{ runId: string }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,external_id,campaign_id,company,website,description,summary")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.leadId)
    .single();

  if (leadError) {
    throw new Error(`Could not load lead for contact research: ${leadError.message}`);
  }

  const leadRow = lead as {
    campaign_id: string | null;
    company: string;
    description: string;
    external_id: string;
    id: string;
    summary: string;
    website: string;
  };
  const campaignId = leadRow.campaign_id || "manual-lead-research";
  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .insert({
      campaign_id: campaignId,
      current_step: "Queued contact enrichment",
      progress: 0,
      status: "pending",
      workspace_id: input.workspaceId,
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(`Could not create contact enrichment run: ${runError.message}`);
  }

  const runId = (run as { id: string }).id;
  const { error: taskError } = await supabase.from("research_tasks").insert({
    campaign_id: campaignId,
    max_attempts: 2,
    payload_json: {
      leadDatabaseId: leadRow.id,
      leadExternalId: leadRow.external_id,
      source: {
        content: [leadRow.description, leadRow.summary].filter(Boolean).join("\n"),
        query: "manual lead contact enrichment",
        title: leadRow.company,
        url: leadRow.website,
      },
      website: leadRow.website,
    },
    run_id: runId,
    status: "pending",
    task_type: "enrich_contacts",
    workspace_id: input.workspaceId,
  });

  if (taskError) {
    throw new Error(`Could not enqueue contact enrichment task: ${taskError.message}`);
  }

  const { error: outreachStateError } = await supabase
    .from("lead_outreach_states")
    .upsert(
      {
        workspace_id: input.workspaceId,
        lead_id: leadRow.id,
        enrichment_status: "queued",
        enrichment_run_id: runId,
        last_error: null,
      },
      { onConflict: "lead_id" },
    );
  if (outreachStateError)
    throw new Error(`Could not record enrichment state: ${outreachStateError.message}`);

  return { runId };
}

export async function enqueueCampaignDraftGenerationRun(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<{ runId: string; taskCount: number }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("company_profile_version_id,current_strategy_version_id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignId)
    .single();
  if (campaignError)
    throw new Error(
      `Could not load campaign for draft generation: ${campaignError.message}`,
    );
  const context = campaign as {
    company_profile_version_id: string | null;
    current_strategy_version_id: string | null;
  };
  if (!context.company_profile_version_id || !context.current_strategy_version_id)
    throw new Error(
      "Save the Company Profile and Campaign Strategy before generating drafts.",
    );

  const { data: leads, error: leadError } = await supabase
    .from("leads")
    .select(
      "id,external_id,status,lead_outreach_states(selected_contact_route_id,selection_status)",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .in("status", ["approved", "draft_ready"]);
  if (leadError)
    throw new Error(`Could not load selected draft recipients: ${leadError.message}`);
  const selected = (leads ?? []).flatMap((lead) => {
    const row = lead as {
      id: string;
      external_id: string;
      lead_outreach_states:
        | { selected_contact_route_id: string | null; selection_status: string }
        | Array<{ selected_contact_route_id: string | null; selection_status: string }>
        | null;
    };
    const state = Array.isArray(row.lead_outreach_states)
      ? row.lead_outreach_states[0]
      : row.lead_outreach_states;
    return state?.selection_status === "accepted" && state.selected_contact_route_id
      ? [{ ...row, selectedContactRouteId: state.selected_contact_route_id }]
      : [];
  });
  if (selected.length === 0)
    throw new Error("Accept at least one recipient selection before generating drafts.");

  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .insert({
      campaign_id: input.campaignId,
      current_step: "Queued draft generation",
      progress: 0,
      status: "pending",
      workspace_id: input.workspaceId,
    })
    .select("id")
    .single();
  if (runError)
    throw new Error(`Could not create draft generation run: ${runError.message}`);
  const runId = (run as { id: string }).id;
  const { error: taskError } = await supabase.from("research_tasks").insert(
    selected.map((lead) => ({
      campaign_id: input.campaignId,
      max_attempts: 2,
      payload_json: {
        leadDatabaseId: lead.id,
        leadExternalId: lead.external_id,
        selectedContactRouteId: lead.selectedContactRouteId,
        companyProfileVersionId: context.company_profile_version_id,
        strategyVersionId: context.current_strategy_version_id,
      },
      run_id: runId,
      status: "pending",
      task_type: "generate_draft",
      workspace_id: input.workspaceId,
    })),
  );
  if (taskError)
    throw new Error(`Could not enqueue draft generation: ${taskError.message}`);
  return { runId, taskCount: selected.length };
}

export async function enqueueCompanyProfileAnalysisRun(input: {
  workspaceId: string;
  profileVersionId: string;
  website: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .insert({
      workspace_id: input.workspaceId,
      campaign_id: "company-profile",
      current_step: "Queued website analysis",
      progress: 0,
      status: "pending",
    })
    .select("id")
    .single();
  if (runError)
    throw new Error(`Could not create Company Profile analysis run: ${runError.message}`);
  const runId = (run as { id: string }).id;
  const { error } = await supabase.from("research_tasks").insert({
    workspace_id: input.workspaceId,
    run_id: runId,
    campaign_id: "company-profile",
    task_type: "analyze_company_profile",
    status: "pending",
    max_attempts: 2,
    payload_json: { profileVersionId: input.profileVersionId, website: input.website },
  });
  if (error)
    throw new Error(`Could not queue Company Profile analysis: ${error.message}`);
  return { runId };
}

export async function getCampaignResearchProgress(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<ResearchProgress | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: run, error: runError } = await supabase
    .from("research_runs")
    .select("id,status,progress,current_step,error_message")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) {
    throw new Error(`Could not load research run progress: ${runError.message}`);
  }

  if (!run) {
    return null;
  }

  const runRow = run as ResearchRunRow;
  const { data: tasks, error: tasksError } = await supabase
    .from("research_tasks")
    .select("status")
    .eq("workspace_id", input.workspaceId)
    .eq("run_id", runRow.id);

  if (tasksError) {
    throw new Error(`Could not load research task progress: ${tasksError.message}`);
  }

  const taskRows = (tasks ?? []) as ResearchTaskRow[];

  return {
    completedTasks: taskRows.filter((task) => task.status === "completed").length,
    currentStep: runRow.current_step,
    failedTasks: taskRows.filter((task) => task.status === "failed").length,
    lastError: runRow.error_message ?? "",
    progress: runRow.progress,
    runId: runRow.id,
    status: runRow.status,
    totalTasks: taskRows.length,
  };
}
