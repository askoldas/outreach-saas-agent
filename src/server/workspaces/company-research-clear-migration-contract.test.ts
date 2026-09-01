import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260827000800_clear_company_research_credit_data.sql",
  "utf8",
);

test("workspace cleanup removes new credit dependants before the prior chain", () => {
  const authorization = migration.indexOf(
    "delete from public.contact_enrichment_credit_authorizations",
  );
  const overview = migration.indexOf(
    "delete from public.research_market_overview_versions",
  );
  const prior = migration.indexOf(
    "perform public.clear_workspace_data_before_company_research_credits",
  );
  assert.ok(authorization > 0 && authorization < prior);
  assert.ok(overview > authorization && overview < prior);
});

test("workspace cleanup restores the current fresh-workspace credit grant", () => {
  assert.match(migration, /insert into public\.workspace_credit_accounts/);
  assert.match(migration, /values\(target_workspace_id, 120\)/);
  assert.match(migration, /on conflict \(workspace_id\) do update/);
});

test("workspace cleanup remains serialized, admin-only, and authenticated", () => {
  assert.match(migration, /is_workspace_admin\(target_workspace_id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(
    migration,
    /revoke all on function\s+public\.clear_workspace_data_before_company_research_credits\(uuid\)\s+from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\) to authenticated;/,
  );
});

