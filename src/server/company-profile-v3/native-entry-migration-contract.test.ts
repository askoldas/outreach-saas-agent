import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729000200_native_company_intelligence_v3_entry.sql",
  "utf8",
);
const digestRepair = readFileSync(
  "supabase/migrations/20260729000500_fix_native_profile_digest_search_path.sql",
  "utf8",
);

test("native V3 entry RPC requires a first-party website source snapshot", () => {
  assert.match(migration, /create_native_company_profile_v3_draft/);
  assert.match(migration, /company-profile-source-set\/v1/);
  assert.match(migration, /official_website/);
  assert.match(migration, /base_version_id,[\s\S]*null,/);
  assert.match(migration, /source_set_hash/);
  assert.match(migration, /current_v3_draft_id = result\.id/);
});

test("native Company Intelligence source hashing resolves Supabase pgcrypto", () => {
  assert.match(
    digestRepair,
    /alter function public\.create_native_company_profile_v3_draft\([\s\S]*uuid,\s*text,\s*jsonb,\s*uuid[\s\S]*\)/i,
  );
  assert.match(digestRepair, /set search_path = public,\s*extensions/i);
});

test("adapter-era profile writers lose canonical execution privileges", () => {
  assert.match(
    migration,
    /revoke all on function public\.create_company_profile_v3_draft[\s\S]*from authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on function public\.save_clean_company_profile_version[\s\S]*from authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on function public\.save_analyzed_company_profile_version[\s\S]*from authenticated, service_role/,
  );
});

test("new profile versions must carry a compiled native V3 snapshot", () => {
  assert.match(migration, /require_native_company_intelligence_v3_version/);
  assert.match(migration, /company_profile_versions_require_native_v3/);
  assert.match(migration, /commercialSynthesis/);
  assert.match(migration, /'\{offerings,offerings\}'/);
  assert.match(
    migration,
    /Canonical Company Profile versions must come from native Company Intelligence V3/,
  );
});
