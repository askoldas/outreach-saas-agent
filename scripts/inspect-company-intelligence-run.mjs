import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadLocalEnvironment();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service configuration is missing");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const workspace = await resolveWorkspace(process.argv[2]);
const workspaceId = workspace.id;
const report = {
  inspectedAt: new Date().toISOString(),
  workspace,
  settings: await optionalQuery("workspace_intelligence_settings", () =>
    supabase
      .from("workspace_intelligence_settings")
      .select(
        "workspace_id,profile_version,campaign_workflow,shadow_mode,enabled_providers,result_write_mode,created_at,updated_at",
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ),
  profile: await optionalQuery("company_profiles", () =>
    supabase
      .from("company_profiles")
      .select("id,current_version_id,current_v3_draft_id,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ),
};

const draftId = report.profile.data?.current_v3_draft_id ?? null;
if (draftId) {
  Object.assign(report, {
    draft: await optionalQuery("company_profile_drafts", () =>
      supabase
        .from("company_profile_drafts")
        .select(
          "id,state,input_hash,contract_version,created_by_run_id,created_at,updated_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("id", draftId)
        .maybeSingle(),
    ),
    stages: await optionalQuery("profile_task_runs", () =>
      supabase
        .from("profile_task_runs")
        .select(
          "id,task_id,status,attempt_count,started_at,completed_at,error_code,error_message,prompt_version,schema_version,created_at,updated_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("profile_draft_id", draftId)
        .order("created_at", { ascending: true }),
    ),
    sourceExecutions: await optionalQuery("provider_executions", () =>
      supabase
        .from("provider_executions")
        .select(
          "id,provider,operation,status,dispatch_state,attempt,error_code,error_message,last_dispatch_error,trigger_run_id,started_at,completed_at,created_at,updated_at,metadata",
        )
        .eq("workspace_id", workspaceId)
        .eq("operation", "company_profile_source_collection")
        .contains("metadata", { profileDraftId: draftId })
        .order("created_at", { ascending: true }),
    ),
    changeEvents: await optionalQuery("profile_change_events", () =>
      supabase
        .from("profile_change_events")
        .select("event_type,actor_type,details_json,created_at")
        .eq("workspace_id", workspaceId)
        .eq("profile_draft_id", draftId)
        .order("created_at", { ascending: true }),
    ),
    aiRequests: await optionalQuery("ai_requests", () =>
      supabase
        .from("ai_requests")
        .select(
          "id,role,status,selected_model,fallback_model,fallback_used,input_units,output_units,actual_cost,error_code,error_message,started_at,completed_at,metadata",
        )
        .eq("workspace_id", workspaceId)
        .contains("metadata", { profileDraftId: draftId })
        .order("started_at", { ascending: true }),
    ),
    attemptTelemetry: await optionalQuery("intelligence_ai_attempts", () =>
      supabase
        .from("intelligence_ai_attempts")
        .select(
          "task_id,attempt,attempt_kind,output_mode,status,requested_model,actual_model,error_code,error_message,validation_issue,started_at,completed_at,metadata",
        )
        .eq("workspace_id", workspaceId)
        .contains("metadata", { profileDraftId: draftId })
        .order("started_at", { ascending: true }),
    ),
  });
}

report.diagnosis = diagnose(report);
console.log(JSON.stringify(report, null, 2));

function loadLocalEnvironment() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function resolveWorkspace(requestedId) {
  let query = supabase
    .from("workspaces")
    .select("id,name,website_url,status,created_at,updated_at");
  query = requestedId
    ? query.eq("id", requestedId).limit(1)
    : query.order("created_at", { ascending: false }).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load workspace: ${error.message}`);
  if (!data) {
    throw new Error(
      requestedId
        ? `Workspace ${requestedId} was not found.`
        : "No workspace was found. Pass a workspace ID explicitly.",
    );
  }
  return data;
}

async function optionalQuery(label, execute) {
  try {
    const { data, error } = await execute();
    return error
      ? { data: null, error: `${label}: ${error.message}` }
      : { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: `${label}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function diagnose(value) {
  const findings = [];
  if (!value.workspace.website_url) {
    findings.push({
      severity: "blocking",
      code: "website_missing",
      message: "The workspace has no company website URL.",
    });
  }
  if (value.settings?.error) {
    findings.push({
      severity: "blocking",
      code: "settings_schema_missing",
      message:
        "Workspace Intelligence settings could not be read. Check migration 20260728000100_intelligence_v2_versioning_and_rollout.sql.",
      detail: value.settings.error,
    });
  } else if (!value.settings?.data) {
    findings.push({
      severity: "repairable",
      code: "settings_row_missing",
      message: "The workspace has no Intelligence settings row.",
    });
  }
  if (value.profile?.error) {
    findings.push({
      severity: "blocking",
      code: "profile_container_schema_error",
      message: "The Company Profile container could not be read.",
      detail: value.profile.error,
    });
  } else if (!value.profile?.data) {
    findings.push({
      severity: "repairable",
      code: "profile_container_missing",
      message: "The workspace has no Company Profile container.",
    });
  } else if (!value.profile.data.current_v3_draft_id) {
    findings.push({
      severity: "blocking",
      code: "draft_not_created",
      message:
        "No Company Intelligence draft exists. Check the native draft RPC and Trigger dispatch from the web application.",
    });
  }

  const draft = value.draft?.data;
  const stages = value.stages?.data ?? [];
  const sourceExecutions = value.sourceExecutions?.data ?? [];
  if (draft?.state === "failed") {
    const failedStage = stages.find((stage) => stage.status === "failed");
    const failedSource = sourceExecutions.find((execution) => execution.status === "failed");
    findings.push({
      severity: "blocking",
      code: failedStage
        ? "profile_stage_failed"
        : failedSource
          ? "source_collection_failed"
          : "profile_workflow_failed",
      message:
        failedStage?.error_message ??
        failedSource?.error_message ??
        latestWorkflowFailure(value.changeEvents?.data) ??
        "The profile workflow failed without a recorded stage error.",
      stage: failedStage?.task_id ?? null,
    });
  }
  if (draft?.state === "building" && stages.length === 0) {
    findings.push({
      severity: "blocking",
      code: "trigger_not_started",
      message:
        "The draft is building but no stage run exists. Verify TRIGGER_SECRET_KEY and deploy the current Trigger tasks.",
      triggerRunId: draft.created_by_run_id,
    });
  }
  const failedStage = stages.find((stage) => stage.status === "failed");
  if (failedStage && draft?.state !== "failed") {
    findings.push({
      severity: "blocking",
      code: "profile_stage_failed",
      message: failedStage.error_message,
      stage: failedStage.task_id,
    });
  }
  if (value.attemptTelemetry?.error) {
    findings.push({
      severity: "non_blocking_after_fix",
      code: "attempt_telemetry_unavailable",
      message:
        "The optional AI attempt ledger is unavailable. Apply migration 20260803000400_intelligence_ai_attempt_ledger.sql; the profile workflow should not depend on it after the fix.",
      detail: value.attemptTelemetry.error,
    });
  }
  if (!findings.length) {
    findings.push({
      severity: "ok",
      code: "no_obvious_blocker",
      message:
        "No obvious database or workflow blocker was detected. Inspect the latest Trigger run and the first non-completed stage.",
    });
  }
  return findings;
}

function latestWorkflowFailure(events = []) {
  return [...events]
    .reverse()
    .find((event) => event.event_type === "workflow_failed")?.details_json
    ?.errorMessage;
}