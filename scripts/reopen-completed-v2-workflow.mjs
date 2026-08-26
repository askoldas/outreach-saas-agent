import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadLocalEnv();
const [campaignRunId, workspaceId] = process.argv.slice(2);
if (!campaignRunId || !workspaceId) {
  throw new Error("Usage: node scripts/reopen-completed-v2-workflow.mjs <campaign-run-id> <workspace-id>");
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const [workflowResult, campaignRunResult, qualificationResult, rankResult] =
  await Promise.all([
    db
      .from("intelligence_workflow_runs")
      .select("id,status")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", campaignRunId)
      .single(),
    db
      .from("campaign_runs")
      .select("id,campaign_id,status")
      .eq("workspace_id", workspaceId)
      .eq("id", campaignRunId)
      .single(),
    db
      .from("candidate_qualification_batches_v2")
      .select("status,candidate_count,completed_count,blocked_count")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", campaignRunId)
      .single(),
    db
      .from("candidate_rank_snapshots")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("campaign_run_id", campaignRunId)
      .limit(1)
      .maybeSingle(),
  ]);
for (const result of [workflowResult, campaignRunResult, qualificationResult, rankResult]) {
  if (result.error) throw result.error;
}
const workflow = workflowResult.data;
const campaignRun = campaignRunResult.data;
const qualification = qualificationResult.data;
if (workflow.status !== "failed" || campaignRun.status !== "failed") {
  throw new Error("Only a failed workflow and campaign run can be reopened.");
}
if (
  qualification.status !== "completed" ||
  qualification.blocked_count !== 0 ||
  qualification.completed_count !== qualification.candidate_count ||
  !rankResult.data?.id
) {
  throw new Error("The workflow cannot be reopened until qualification and ranking are complete.");
}

const { error: workflowError } = await db
  .from("intelligence_workflow_runs")
  .update({
    status: "queued",
    completed_at: null,
    error_summary_json: null,
  })
  .eq("workspace_id", workspaceId)
  .eq("id", workflow.id)
  .eq("status", "failed");
if (workflowError) throw workflowError;
const { error: runError } = await db
  .from("campaign_runs")
  .update({
    status: "queued",
    current_phase: "queued",
    failed_at: null,
    completed_at: null,
    error_code: null,
    error_message: null,
  })
  .eq("workspace_id", workspaceId)
  .eq("id", campaignRunId)
  .eq("status", "failed");
if (runError) throw runError;
const { error: campaignError } = await db
  .from("campaigns")
  .update({ status: "active" })
  .eq("workspace_id", workspaceId)
  .eq("id", campaignRun.campaign_id);
if (campaignError) throw campaignError;
console.log(`Reopened workflow ${workflow.id} after verifying complete artifacts.`);

function loadLocalEnv() {
  const contents = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [name, ...parts] = trimmed.split("=");
    if (!name || process.env[name]) continue;
    process.env[name] = parts.join("=").replace(/^['"]|['"]$/g, "");
  }
}
