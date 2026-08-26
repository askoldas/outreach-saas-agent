import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000400_core_intelligence_artifacts_v2.sql",
  "utf8",
);

test("core intelligence artifacts use separate immutable version tables", () => {
  for (const table of [
    "commercial_intelligence_versions_v2",
    "campaign_target_model_versions_v2",
    "market_research_plan_versions_v2",
    "research_blueprint_versions_v2",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(migration, new RegExp(`create trigger ${table}_immutable`));
  }
  assert.match(migration, /reject_core_intelligence_artifact_mutation_v2/);
  assert.doesNotMatch(migration, /drop table|delete from|truncate table/i);
});

test("Market Analysis evolves in place and preserves historical rows", () => {
  assert.match(migration, /alter table public\.market_analyses/);
  assert.match(migration, /campaign_target_model_version_id uuid/);
  assert.match(migration, /commercial_intelligence_version_id uuid/);
  assert.match(migration, /supersedes_market_analysis_id uuid/);
  assert.doesNotMatch(
    migration,
    /alter column campaign_target_model_version_id set not null/i,
  );
  assert.doesNotMatch(migration, /update public\.market_analyses/i);
  assert.match(migration, /create trigger market_analyses_v2_immutable/);
  assert.match(
    migration,
    /old\.campaign_target_model_version_id is not null[\s\S]+V2 Market Analysis versions are immutable/,
  );
  assert.match(migration, /V2 Market Analysis writes require the service role/);
});

test("Market Analysis confirmation is durable, user-attributed, and immutable", () => {
  assert.match(migration, /create table public\.market_analysis_confirmations_v2/);
  assert.match(migration, /confirmed_by uuid not null references auth\.users/);
  assert.match(migration, /unique \(market_analysis_id\)/);
  assert.match(migration, /confirmed_by = auth\.uid\(\)/);
  assert.match(migration, /create trigger market_analysis_confirmations_v2_immutable/);
  assert.match(
    migration,
    /grant select, insert on public\.market_analysis_confirmations_v2 to authenticated/,
  );
});

test("artifact relationships are guarded by Campaign and workspace identity", () => {
  assert.match(migration, /assert_core_intelligence_artifact_workspace_v2/);
  assert.match(
    migration,
    /snapshot\.campaign_id = campaign\.id[\s\S]+commercial\.workspace_id = campaign\.workspace_id/,
  );
  assert.match(
    migration,
    /target\.campaign_id = analysis\.campaign_id[\s\S]+target\.workspace_id = analysis\.workspace_id/,
  );
  assert.match(migration, /using \(public\.is_workspace_member\(workspace_id\)\)/);
  assert.match(migration, /revoke all on public\.commercial_intelligence_versions_v2/);
});

test("artifact cache identities include frozen input and contract versions", () => {
  assert.match(
    migration,
    /workspace_id, company_profile_version_id, input_hash, schema_version, compiler_version/,
  );
  assert.match(
    migration,
    /workspace_id, campaign_id, input_hash, schema_version, compiler_version/,
  );
  assert.match(migration, /market_analyses_v2_cache_idx/);
});
