import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260813000800_fix_discovery_source_workspace_guard_v2.sql",
  "utf8",
);

test("source guard accesses child-only fields inside a table-specific branch", () => {
  assert.match(
    sql,
    /if tg_table_name = 'discovery_source_organization_references_v2' then[\s\S]*new\.source_expansion_id[\s\S]*end if;/,
  );
  assert.doesNotMatch(
    sql,
    /tg_table_name = 'discovery_source_organization_references_v2' and not exists/,
  );
});

test("source guard retains parent, execution, campaign, and workspace consistency", () => {
  assert.match(sql, /source_record\.workspace_id = new\.workspace_id/);
  assert.match(sql, /source_record\.campaign_id = new\.campaign_id/);
  assert.match(sql, /execution\.workspace_id = new\.workspace_id/);
  assert.match(sql, /expansion\.provider_source_record_id = new\.provider_source_record_id/);
});
