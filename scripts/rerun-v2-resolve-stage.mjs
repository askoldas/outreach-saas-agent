import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { configure, runs, tasks } from "@trigger.dev/sdk";

loadLocalEnv();
const [campaignRunId, workspaceId] = process.argv.slice(2);
const stage = process.argv[4] ?? "resolve_entities";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data: workflow, error } = await db
  .from("intelligence_workflow_runs")
  .select("id")
  .eq("workspace_id", workspaceId)
  .eq("campaign_run_id", campaignRunId)
  .single();
if (error) throw error;
configure({ accessToken: process.env.TRIGGER_SECRET_KEY });
const handle = await tasks.trigger("run-campaign-v2-stage", {
  campaignRunId,
  workspaceId,
  workflowRunId: workflow.id,
  stage,
  cycleNumber: 1,
});
console.log(`Triggered ${handle.id}.`);
for (let attempt = 0; attempt < 60; attempt += 1) {
  const run = await runs.retrieve(handle.id);
  console.log(`${new Date().toISOString()} ${run.status}`);
  if (run.status === "COMPLETED") {
    console.log(JSON.stringify(run.output ?? null));
    process.exit(0);
  }
  if (["FAILED", "CRASHED", "CANCELED", "SYSTEM_FAILURE"].includes(run.status)) {
    console.log(JSON.stringify(run.error ?? null));
    process.exit(1);
  }
  await new Promise((done) => setTimeout(done, 3_000));
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
