import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations-legacy/20260719000700_add_company_profile_analysis.sql",
    import.meta.url,
  ),
  "utf8",
);

test("analyzed profile versions retain run and prompt provenance", () => {
  assert.match(migration, /analysis_run_id uuid references public\.research_runs/i);
  assert.match(migration, /prompt_version text/i);
  assert.match(migration, /'website_analysis'/i);
});

test("analyzed profile save is restricted to service role and analysis runs", () => {
  assert.match(migration, /campaign_id = 'company-profile'/i);
  assert.match(migration, /revoke all.*authenticated/is);
  assert.match(migration, /grant execute.*service_role/is);
});
