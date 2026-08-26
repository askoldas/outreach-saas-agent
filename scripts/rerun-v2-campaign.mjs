import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configure, runs, tasks } from "@trigger.dev/sdk";

loadLocalEnv();
const [campaignRunId, workspaceId] = process.argv.slice(2);
if (!campaignRunId || !workspaceId) {
  throw new Error("Usage: node scripts/rerun-v2-campaign.mjs <campaign-run-id> <workspace-id>");
}
if (!process.env.TRIGGER_SECRET_KEY) throw new Error("TRIGGER_SECRET_KEY is missing.");
configure({ accessToken: process.env.TRIGGER_SECRET_KEY });

const handle = await tasks.trigger(
  "execute-campaign-v2",
  { campaignRunId, workspaceId },
  {
    idempotencyKey: `execute-campaign-v2-diagnostic:${campaignRunId}:${Date.now()}`,
    tags: [`workspace:${workspaceId}`, `campaign_run:${campaignRunId}`, "diagnostic_rerun"],
  },
);
console.log(`Triggered ${handle.id}.`);

for (let attempt = 0; attempt < 120; attempt += 1) {
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
