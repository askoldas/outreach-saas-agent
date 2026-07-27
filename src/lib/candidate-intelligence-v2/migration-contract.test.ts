import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728001300_candidate_research_intelligence.sql",
  ),
  "utf8",
);

test("WP-15 persists research, reusable versions, and campaign-scoped projections", () => {
  for (const table of [
    "candidate_research_plans",
    "candidate_research_tasks",
    "candidate_page_fetches",
    "candidate_claims",
    "candidate_intelligence_versions",
    "campaign_candidates",
    "campaign_candidate_discovery_links",
    "campaign_candidate_claims",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /source_scope in \('system_public', 'workspace_private'\)/);
  assert.match(migration, /publish_candidate_intelligence_v2/);
});

test("research persistence is tenant guarded and page fetches are reusable", () => {
  assert.match(migration, /validate_candidate_intelligence_workspace/);
  assert.match(migration, /candidate_page_fetches_reuse_idx/);
  assert.match(
    migration,
    /unique \(workspace_id, canonical_url, freshness_window_started_at\)/,
  );
  assert.match(migration, /pg_advisory_xact_lock/);
});
