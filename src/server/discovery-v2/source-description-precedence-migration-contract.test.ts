import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260814000100_fix_discovery_source_description_json_precedence_v2.sql",
  "utf8",
);

test("source description avoids ambiguous JSON operator precedence", () => {
  assert.match(sql, /pg_get_functiondef/);
  assert.match(
    sql,
    /concat\('Discovered through ', organization->>'discoverySourceUrl'\)/,
  );
  assert.match(sql, /revised_definition = function_definition/);
});

test("corrected expansion persistence remains service-only", () => {
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
});
