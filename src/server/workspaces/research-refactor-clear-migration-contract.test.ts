import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = new URL(
  "../../../supabase/migrations/20260904000600_restore_workspace_clear_after_research_refactor.sql",
  import.meta.url,
);

test("workspace clear removes research-refactor leaves before the prior chain", async () => {
  const sql = await readFile(migration, "utf8");
  const triageAt = sql.indexOf("delete from public.candidate_triage_decisions_v2");
  const corpusAt = sql.indexOf("delete from public.market_research_executions_v2");
  const delegateAt = sql.indexOf(
    "perform public.clear_workspace_data_before_research_refactor_cleanup",
  );
  assert.ok(triageAt >= 0 && corpusAt >= 0);
  assert.ok(triageAt < delegateAt && corpusAt < delegateAt);
  assert.match(sql, /to_regclass\('public\.candidate_triage_decisions_v2'\)/);
  assert.match(sql, /to_regclass\('public\.market_research_executions_v2'\)/);
});

test("workspace clear has a bounded extended timeout and remains admin-only", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /set statement_timeout = '120s'/);
  assert.match(sql, /public\.is_workspace_admin\(target_workspace_id\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(
    sql,
    /revoke all on function public\.clear_workspace_data\(uuid\) from public, anon;/,
  );
  assert.match(
    sql,
    /grant execute on function public\.clear_workspace_data\(uuid\) to authenticated;/,
  );
});

test("the cleanup repair is safe to rerun after a partial application", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /to_regprocedure\([\s\S]*clear_workspace_data_before_research_refactor_cleanup/);
  assert.match(sql, /create or replace function public\.clear_workspace_data/);
});
