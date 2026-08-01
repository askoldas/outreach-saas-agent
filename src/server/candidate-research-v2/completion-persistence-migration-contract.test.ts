import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000600_repair_candidate_research_completion_persistence.sql",
  ),
  "utf8",
);

test("Candidate Research completion resolves pgcrypto from extensions", () => {
  assert.match(
    migration,
    /create or replace function public\.complete_candidate_research_member_v2\(/,
  );
  assert.match(migration, /set search_path = public, extensions/);
});

test("unknown Candidate claims persist a SQL null value", () => {
  assert.match(
    migration,
    /case when claim_status = ''unknown'' then null else claim_item->''value'' end,/,
  );
});

test("repaired Candidate Research completion remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.complete_candidate_research_member_v2\([\s\S]+?\) from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.complete_candidate_research_member_v2\([\s\S]+?\) to service_role;/,
  );
});
