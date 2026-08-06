import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000500_disambiguate_candidate_intelligence_version.sql",
  ),
  "utf8",
);

test("Candidate Research completion renames only its intelligence result variable", () => {
  assert.match(
    migration,
    /'public\.complete_candidate_research_member_v2\(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean\)'::regprocedure/,
  );
  assert.match(migration, /select routine\.prosrc\s+into function_source/);
  assert.match(
    migration,
    /saved_intelligence_version public\.candidate_intelligence_versions;/,
  );
  assert.match(
    migration,
    /returning \* into saved_intelligence_version;/,
  );
  assert.match(
    migration,
    /create or replace function public\.complete_candidate_research_member_v2\(/,
  );
});

test("recompiled Candidate Research completion remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.complete_candidate_research_member_v2\([\s\S]+?\) from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.complete_candidate_research_member_v2\([\s\S]+?\) to service_role;/,
  );
});
