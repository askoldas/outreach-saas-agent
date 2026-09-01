import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260901000200_restore_evolving_market_overview.sql",
  "utf8",
);

test("Market Overview repair recreates the complete idempotent schema boundary", () => {
  assert.match(
    migration,
    /create table if not exists public\.research_market_overview_versions/,
  );
  assert.match(migration, /create index if not exists/);
  assert.match(migration, /drop policy if exists/);
  assert.match(
    migration,
    /create or replace function public\.persist_research_market_overview/,
  );
  assert.match(
    migration,
    /create or replace function public\.get_latest_research_market_overview/,
  );
  assert.match(migration, /notify pgrst, 'reload schema'/);
});

test("Market Overview repair preserves tenant and service-role boundaries", () => {
  assert.match(migration, /is_workspace_member\(target_workspace_id\)/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(
    migration,
    /grant execute on function[\s\S]*get_latest_research_market_overview[\s\S]*to authenticated, service_role/,
  );
  assert.match(
    migration,
    /persist_research_market_overview[\s\S]*to service_role/,
  );
});

