import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260730001100_retry_safe_entity_resolution_reuse.sql",
);
const preparation = source(
  "src/server/entity-resolution-v2/candidate-preparation.ts",
);
const stage = source("src/server/entity-resolution-v2/stage-service.ts");

test("entity resolution reuses only one exact compatible organization with lineage", () => {
  assert.match(
    migration,
    /company\.normalized_name = candidate_normalized_name/,
  );
  assert.match(
    migration,
    /upper\(coalesce\(company\.country, ''\)\) = candidate_country/,
  );
  assert.match(
    migration,
    /company\.organization_type = candidate_type/,
  );
  assert.match(
    migration,
    /historical_link\.link_status = 'active'/,
  );
  assert.match(
    migration,
    /if cardinality\(compatible_match_ids\) <> 1 then\s+continue;/,
  );
});

test("conflicting domains and active links remain reviewable instead of auto-linked", () => {
  assert.match(migration, /conflicting_active_link\.organization_id <> company\.id/);
  assert.match(
    migration,
    /conflicting_domain\.normalized_domain <> candidate_domain/,
  );
  assert.match(
    migration,
    /conflicting_domain\.verification_status in \(\s*'source_confirmed',\s*'verified'\s*\)/,
  );
});

test("retry reuse remains service-role only and delegates to the frozen resolver", () => {
  assert.match(migration, /if auth\.role\(\) <> 'service_role' then/);
  assert.match(
    migration,
    /revoke all on function\s+public\.resolve_campaign_entities_before_retry_safe_reuse_v2[\s\S]+service_role;/,
  );
  assert.match(
    migration,
    /return public\.resolve_campaign_entities_before_retry_safe_reuse_v2\(/,
  );
  assert.match(
    migration,
    /grant execute on function public\.resolve_campaign_entities_v2[\s\S]+to service_role;/,
  );
});

test("new rules do not replay stale V2.2 decisions and zero-result runs fail visibly", () => {
  assert.match(preparation, /entity-resolution-v2\.4/);
  assert.match(
    stage,
    /summary\.candidateCount > 0 && summary\.campaignCandidateCount === 0/,
  );
  assert.match(stage, /refusing to complete an empty Campaign Run/);
});
