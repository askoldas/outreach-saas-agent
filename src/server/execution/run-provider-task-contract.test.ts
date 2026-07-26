import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const boundary = readFileSync(new URL("./run-provider-task.ts", import.meta.url), "utf8");

test("unhandled Trigger failures become durable provider execution failures", () => {
  assert.match(boundary, /\.from\("provider_executions"\)/);
  assert.match(boundary, /status: "failed"/);
  assert.match(boundary, /error_message: message/);
  assert.match(boundary, /\.neq\("status", "completed"\)/);
});

test("discovery startup failures also close the customer-visible Campaign Run", () => {
  assert.match(boundary, /operation !== "campaign_discovery"/);
  assert.match(boundary, /\.from\("campaign_runs"\)/);
  assert.match(boundary, /\.from\("campaign_run_events"\)/);
  assert.match(boundary, /current_phase: "failed"/);
});

test("every paid Trigger task uses the shared failure boundary", () => {
  for (const task of [
    "analyze-company-profile.ts",
    "discover-campaign-companies.ts",
    "enrich-company-contacts.ts",
    "generate-outreach-draft.ts",
  ]) {
    const source = readFileSync(
      new URL(`../../trigger/${task}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /runProviderTask\(/);
  }
});
