import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repair = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000200_fix_organization_graph_trigger_record_fields.sql",
  ),
  "utf8",
);

test("organization graph guard accesses source-link fields only in its table branch", () => {
  assert.match(
    repair,
    /create or replace function public\.validate_organization_graph_workspace\(\)/,
  );
  assert.match(
    repair,
    /if tg_table_name = 'organization_source_links' then\s+if not exists \(\s+select 1\s+from public\.provider_source_records\s+where id = new\.provider_source_record_id/,
  );
  assert.doesNotMatch(
    repair,
    /tg_table_name = 'organization_source_links' and not exists/,
  );
});

test("organization graph guard retains tenant checks for every supported row shape", () => {
  for (const tableName of [
    "organization_aliases",
    "organization_identifiers",
    "organization_locations",
    "organization_source_links",
    "organization_relationships",
    "organization_buying_hypotheses",
    "organization_merge_events",
    "entity_resolution_cases",
    "entity_match_assessments",
    "entity_resolution_decisions",
    "organization_split_events",
  ]) {
    assert.match(repair, new RegExp(`'${tableName}'`));
  }
  assert.match(
    repair,
    /expected_workspace_id is null\s+or expected_workspace_id <> new\.workspace_id/,
  );
});
