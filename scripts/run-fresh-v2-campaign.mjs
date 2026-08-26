import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { configure, runs, tasks } from "@trigger.dev/sdk";

loadLocalEnv();
const [campaignId, workspaceId, desiredCountText = "25"] = process.argv.slice(2);
const desiredCount = Number(desiredCountText);
if (!campaignId || !workspaceId || !Number.isInteger(desiredCount)) {
  throw new Error(
    "Usage: node scripts/run-fresh-v2-campaign.mjs <campaign-id> <workspace-id> [desired-count]",
  );
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const triggerKey = process.env.TRIGGER_SECRET_KEY;
if (!url || !serviceKey || !triggerKey) throw new Error("Runtime configuration is missing.");

const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const { data: campaign, error: campaignError } = await db
  .from("campaigns")
  .select("external_id")
  .eq("workspace_id", workspaceId)
  .eq("id", campaignId)
  .single();
if (campaignError) throw campaignError;
const { data: campaignRun, error: runError } = await db.rpc("create_clean_campaign_run", {
  target_workspace_id: workspaceId,
  target_campaign_external_id: campaign.external_id,
  desired_company_count: desiredCount,
});
if (runError) throw runError;

configure({ accessToken: triggerKey });
const handle = await tasks.trigger(
  "execute-campaign-v2",
  { campaignRunId: campaignRun.id, workspaceId },
  {
    idempotencyKey: `execute-campaign-v2:${campaignRun.id}`,
    tags: [`workspace:${workspaceId}`, `campaign_run:${campaignRun.id}`, "diagnostic_fresh_run"],
  },
);
await db
  .from("campaign_runs")
  .update({
    dispatch_state: "dispatched",
    dispatch_updated_at: new Date().toISOString(),
    trigger_run_id: handle.id,
  })
  .eq("workspace_id", workspaceId)
  .eq("id", campaignRun.id);
console.log(`Campaign run ${campaignRun.id}; Trigger run ${handle.id}.`);

for (let attempt = 0; attempt < 240; attempt += 1) {
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
  await new Promise((done) => setTimeout(done, 5_000));
}
throw new Error(`Timed out waiting for ${handle.id}.`);

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
