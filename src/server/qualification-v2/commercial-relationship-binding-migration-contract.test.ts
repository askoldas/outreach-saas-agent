import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000800_bind_qualification_relationship_assessments_v2.sql",
  "utf8",
);
const companyBindingMigration = readFileSync(
  "supabase/migrations/20260824001000_bind_qualification_company_intelligence_v2.sql",
  "utf8",
);
const repository = readFileSync("src/server/qualification-v2/repository.ts", "utf8");

test("Qualification relationship bindings are exact, guarded, and replay safe", () => {
  assert.match(migration, /commercial_relationship_assessment_version_id uuid/i);
  assert.match(migration, /bind_qualification_relationship_assessments_v2/i);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/i);
  assert.match(migration, /source_candidate_intelligence_version_id/i);
  assert.match(migration, /binding changed after freeze/i);
  assert.match(migration, /status = 'pending'/i);
  assert.match(migration, /revoke all on function/i);
});

test("Qualification binds and loads exact Company Intelligence before compatibility fallback", () => {
  assert.match(companyBindingMigration, /company_intelligence_version_id uuid/i);
  assert.match(
    companyBindingMigration,
    /company_intelligence_version_id = assessment\.company_intelligence_version_id/i,
  );
  assert.match(
    companyBindingMigration,
    /Core Intelligence binding changed after freeze/i,
  );
  assert.match(companyBindingMigration, /status = 'pending'/i);
  assert.match(repository, /loadCompanyIntelligenceVersion/);
  assert.match(repository, /coreBindings\.companyIntelligenceVersionId/);
  assert.match(repository, /:\s*await loadCompanyIntelligenceForCandidateSource/);
});
