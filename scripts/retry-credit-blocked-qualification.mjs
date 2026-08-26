import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { configure, runs, tasks } from "@trigger.dev/sdk";

loadLocalEnv();
const [campaignRunId, workspaceId] = process.argv.slice(2);
if (!campaignRunId || !workspaceId) {
  throw new Error("Usage: node scripts/retry-credit-blocked-qualification.mjs <campaign-run-id> <workspace-id>");
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data: batch, error: batchError } = await db
  .from("candidate_qualification_batches_v2")
  .select("id")
  .eq("workspace_id", workspaceId)
  .eq("campaign_run_id", campaignRunId)
  .single();
if (batchError) throw batchError;

const { data: members, error: membersError } = await db
  .from("candidate_qualification_batch_members_v2")
  .select("id,candidate_evaluation_version_id,error_message,status")
  .eq("workspace_id", workspaceId)
  .eq("candidate_qualification_batch_id", batch.id);
if (membersError) throw membersError;

const retryable = (members ?? []).filter((member) =>
  member.status === "queued" ||
  (member.status === "blocked" &&
    (member.error_message?.includes("OpenRouter generation failed with status 402") ||
      member.error_message === "Unknown Qualification V2 failure")),
);
if (!retryable.length) {
  console.log("No credit-blocked qualification members require retry.");
  console.log(
    JSON.stringify(
      (members ?? []).map((member) => ({
        error: member.error_message,
        status: member.status,
      })),
    ),
  );
  await finalizeBatch();
  process.exit(0);
}

const memberIds = retryable.map((member) => member.id);
const evaluationIds = retryable.map(
  (member) => member.candidate_evaluation_version_id,
);
const { error: evaluationError } = await db
  .from("candidate_evaluation_versions")
  .update({ status: "pending" })
  .eq("workspace_id", workspaceId)
  .in("id", evaluationIds);
if (evaluationError) throw evaluationError;

const { error: memberError } = await db
  .from("candidate_qualification_batch_members_v2")
  .update({
    status: "queued",
    error_code: null,
    error_message: null,
    output_reference_json: null,
    completed_at: null,
  })
  .eq("workspace_id", workspaceId)
  .in("id", memberIds);
if (memberError) throw memberError;

const { error: updateBatchError } = await db
  .from("candidate_qualification_batches_v2")
  .update({
    status: "running",
    completed_at: null,
  })
  .eq("workspace_id", workspaceId)
  .eq("id", batch.id);
if (updateBatchError) throw updateBatchError;

console.log(`Queued ${retryable.length} credit-blocked qualification members.`);

configure({ accessToken: process.env.TRIGGER_SECRET_KEY });
for (let offset = 0; offset < retryable.length; offset += 2) {
  const group = retryable.slice(offset, offset + 2);
  const handles = await Promise.all(
    group.map((member) =>
      tasks.trigger(
        "qualify-campaign-candidate-v2",
        {
          campaignRunId,
          memberId: member.id,
          workspaceId,
        },
        {
          idempotencyKey: `credit-retry:${member.id}:${Date.now()}`,
          tags: [
            `workspace:${workspaceId}`,
            `campaign_run:${campaignRunId}`,
            `candidate_qualification_member:${member.id}`,
          ],
        },
      ),
    ),
  );
  const pending = new Set(handles.map((handle) => handle.id));
  while (pending.size) {
    for (const runId of [...pending]) {
      const run = await runs.retrieve(runId);
      if (run.status === "COMPLETED") {
        console.log(`${runId} completed.`);
        pending.delete(runId);
      } else if (
        ["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE"].includes(run.status)
      ) {
        throw new Error(`${runId} failed: ${run.error?.message ?? run.status}`);
      }
    }
    if (pending.size) await new Promise((done) => setTimeout(done, 3_000));
  }
}
console.log(`Completed ${retryable.length} qualification retries.`);
await finalizeBatch();

async function finalizeBatch() {
  const { data, error } = await db.rpc("finalize_candidate_qualification_batch_v2", {
    target_workspace_id: workspaceId,
    target_batch_id: batch.id,
  });
  if (error) throw error;
  console.log(JSON.stringify(data));
}

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
