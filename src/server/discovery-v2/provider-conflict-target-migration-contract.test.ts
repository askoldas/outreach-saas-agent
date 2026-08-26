import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260813000700_fix_discovery_provider_conflict_target_v2.sql",
  "utf8",
);

test("provider persistence targets the source-expansion uniqueness contract", () => {
  assert.match(sql, /pg_get_functiondef/);
  assert.match(
    sql,
    /on conflict \(provider_source_record_id, normalization_version, candidate_reference_key\) do nothing/,
  );
  assert.match(sql, /revised_definition = function_definition/);
});

test("recompiled persistence remains service-only", () => {
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
});
