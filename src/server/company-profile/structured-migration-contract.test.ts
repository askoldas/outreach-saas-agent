import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260723000200_create_structured_company_profiles.sql",
  import.meta.url,
);
const projectionFixUrl = new URL(
  "../../../supabase/migrations/20260723000300_fix_company_profile_json_projection.sql",
  import.meta.url,
);
const explicitAnalysisRpcUrl = new URL(
  "../../../supabase/migrations/20260723000400_make_analyzed_profile_rpc_explicit.sql",
  import.meta.url,
);
const promptVersionFixUrl = new URL(
  "../../../supabase/migrations/20260723000600_fix_company_profile_prompt_version_column.sql",
  import.meta.url,
);

test("structured profile migration persists facts, questions, readiness, and publishing", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  for (const column of [
    "structured_profile jsonb",
    "extracted_facts jsonb",
    "review_questions jsonb",
    "profile_status text",
    "readiness_score int",
    "published_at timestamptz",
  ]) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(migration, /save_structured_company_profile_version/i);
  assert.match(migration, /schemaVersion/i);
  assert.match(migration, /is_workspace_admin/i);
});

test("campaigns can select an offering without mutating the master profile", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /selected_offering_id text/i);
  assert.match(migration, /offering_overrides jsonb/i);
  assert.match(migration, /campaign_profile_snapshots/i);
});

test("JSON compatibility projections qualify every expanded value column", async () => {
  const migration = await readFile(projectionFixUrl, "utf8");
  for (const alias of [
    "customer_type",
    "market",
    "language",
    "claim",
    "constraint_item",
  ]) {
    assert.match(migration, new RegExp(`${alias}\\.value`));
    assert.match(migration, new RegExp(`as ${alias}\\(value\\)`));
  }
  assert.match(migration, /save_structured_company_profile_version/i);
  assert.match(migration, /save_analyzed_company_profile_version/i);
});

test("analyzed profile persistence uses explicit validated payload arguments", async () => {
  const migration = await readFile(explicitAnalysisRpcUrl, "utf8");
  assert.match(migration, /save_analyzed_company_profile_version_v2/i);
  assert.match(migration, /structured_profile_data jsonb/i);
  assert.match(migration, /facts_data jsonb/i);
  assert.match(migration, /questions_data jsonb/i);
  assert.match(migration, /schemaVersion %/i);
  assert.match(migration, /grant execute .* to service_role/is);
});

test("analyzed profile persistence targets the existing prompt_version column", async () => {
  const migration = await readFile(promptVersionFixUrl, "utf8");
  assert.match(migration, /pg_get_functiondef/i);
  assert.match(migration, /analysis_prompt_version/);
  assert.match(migration, /prompt_version/);
  assert.match(migration, /grant execute .* to service_role/is);
});
