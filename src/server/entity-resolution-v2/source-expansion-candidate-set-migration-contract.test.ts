import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000200_align_entity_resolution_with_source_expansion_v2.sql",
  "utf8",
);

test("frozen Entity Resolution removes its obsolete source ingestion-status filter", () => {
  assert.match(
    migration,
    /resolve_campaign_entities_before_retry_safe_reuse_v2\(uuid,uuid,text,text,jsonb\)/,
  );
  assert.match(
    migration,
    /replace\([\s\S]*provider_source\.ingestion_status = 'normalized'/,
  );
  assert.match(migration, /revised_definition = function_definition/);
  assert.match(migration, /source-status guard did not match its expected contract/);
});

test("the public resolver remains service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.resolve_campaign_entities_v2[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.resolve_campaign_entities_v2[\s\S]*to service_role/,
  );
});
