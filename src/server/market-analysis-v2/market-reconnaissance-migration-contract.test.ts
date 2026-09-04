import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260904000100_market_research_evidence_corpus.sql",
  "utf8",
);

test("market evidence corpus is run-scoped, tenant guarded, and immutable", () => {
  assert.match(migration, /create table public\.market_research_executions_v2/);
  assert.match(migration, /campaign_run_id uuid not null/);
  assert.match(migration, /campaign_target_model_version_id uuid not null/);
  assert.match(migration, /unique \(workspace_id, campaign_run_id, request_hash\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /writes require the service role/);
  assert.match(migration, /market_research_executions_v2_immutable/);
});
