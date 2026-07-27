import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

test("agent iteration execution persists exact plan and both replay hashes", () => {
  const service = source("../campaign-execution/service.ts");

  assert.match(service, /plan:\s*input\.plan/);
  assert.match(service, /planHash/);
  assert.match(service, /planningInputHash/);
  assert.match(service, /loadPersistedCampaignAgentPlan/);
  assert.match(service, /campaignAgentPlan\(metadata\.plan\)/);
});

test("planner retries reuse persisted plans before making an AI request", () => {
  const planner = source("../../lib/campaign-agent/planner.ts");
  const parent = source("../../trigger/execute-campaign.ts");

  assert.ok(
    planner.indexOf("const persistedPlan") <
      planner.indexOf("const result = await generateTextResult"),
  );
  assert.match(parent, /loadPersistedCampaignAgentPlan\(\{ context, iteration \}\)/);
  assert.match(parent, /plan:\s*iterationExecution\.plan/);
  assert.match(parent, /providerExecutionId:\s*iterationExecution\.executionId/);
});
