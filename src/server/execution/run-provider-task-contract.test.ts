import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const boundary = readFileSync(new URL("./run-provider-task.ts", import.meta.url), "utf8");
const attempt = readFileSync(new URL("./provider-attempt.ts", import.meta.url), "utf8");

const durableTasks = [
  {
    file: "analyze-company-profile.ts",
    operation: "company_profile_analysis",
  },
  {
    file: "discover-campaign-companies.ts",
    operation: "campaign_discovery",
  },
  {
    file: "enrich-company-contacts.ts",
    operation: "contact_enrichment",
  },
  {
    file: "generate-outreach-draft.ts",
    operation: "draft_generation",
  },
];

test("attempt failures are diagnostic and terminal failure is a separate transition", () => {
  assert.match(boundary, /recordAttemptFailure/);
  assert.match(boundary, /attemptFailures/);
  assert.match(boundary, /context\.attempt\.number/);
  assert.match(boundary, /executeProviderAttempt/);
  assert.match(attempt, /errorForTrigger\(error\)/);
  assert.match(boundary, /export async function finalizeProviderTaskFailure/);
  assert.match(boundary, /\.in\("status", \["pending", "running"\]\)/);
});

test("terminal discovery failure closes the customer-visible Campaign Run once", () => {
  assert.match(boundary, /operation === "campaign_discovery"/);
  assert.match(boundary, /\.from\("campaign_runs"\)/);
  assert.match(boundary, /\.from\("campaign_run_events"\)/);
  assert.match(boundary, /terminal_\$\{operation\}_failure/);
  assert.match(boundary, /current_phase: "failed"/);
});

test("every durable provider task delegates terminal failure to Trigger onFailure", () => {
  for (const { file, operation } of durableTasks) {
    const source = readFileSync(
      new URL(`../../trigger/${file}`, import.meta.url),
      "utf8",
    );
    assert.match(source, /runProviderTask\(/);
    assert.match(source, /,\s*ctx,\s*/);
    assert.match(source, /onFailure:/);
    assert.match(source, /finalizeProviderTaskFailure/);
    assert.match(source, new RegExp(`"${operation}"`));
  }
});

test("service-level task attempts rethrow without terminalizing the execution", () => {
  for (const file of [
    "../company-profile/analysis-service.ts",
    "../campaign-discovery/service.ts",
    "../contact-enrichment/service.ts",
    "../draft-generation/service.ts",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /} catch \(error\) {\s*throw error;\s*}\s*}/);
  }
});
