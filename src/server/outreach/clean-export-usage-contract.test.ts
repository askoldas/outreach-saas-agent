import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("exports resolve clean Campaign IDs and use the clean payload schema", () => {
  const section = repository.slice(
    repository.indexOf("export async function createExportRecord"),
    repository.indexOf("export async function recordUsageEvent"),
  );
  assert.match(section, /\.from\("campaigns"\)|resolveCampaign/);
  assert.match(section, /campaign_id: campaign\.id/);
  assert.match(section, /payload: input\.rows/);
  assert.match(section, /company_research_csv/);
  assert.doesNotMatch(section, /campaign_external_id: input|payload_json/);
});

test("usage accounting writes immutable clean ledger entries", () => {
  const section = repository.slice(
    repository.indexOf("export async function recordUsageEvent"),
  );
  assert.match(section, /\.from\("usage_ledger"\)/);
  assert.match(section, /entry_type: "estimate"/);
  assert.match(section, /entry_type: "settlement"/);
  assert.match(section, /idempotency_key/);
  assert.doesNotMatch(section, /\.from\("usage_events"\)/);
});
