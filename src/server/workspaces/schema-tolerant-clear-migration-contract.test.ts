import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260901000100_make_company_research_cleanup_schema_tolerant.sql",
  "utf8",
);

test("workspace cleanup tolerates absent optional Company Research tables", () => {
  for (const table of [
    "contact_enrichment_credit_authorizations",
    "research_market_overview_versions",
    "workspace_credit_accounts",
  ]) {
    assert.match(migration, new RegExp(`to_regclass\\('public\\.${table}'\\)`));
  }
  assert.match(
    migration,
    /execute\s+'delete from public\.contact_enrichment_credit_authorizations/,
  );
  assert.match(
    migration,
    /execute\s+'delete from public\.research_market_overview_versions/,
  );
});

test("schema-tolerant cleanup still delegates to the strict core chain", () => {
  assert.match(
    migration,
    /perform public\.clear_workspace_data_before_company_research_credits/,
  );
  assert.match(migration, /is_workspace_admin\(target_workspace_id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\) to authenticated;/,
  );
});

