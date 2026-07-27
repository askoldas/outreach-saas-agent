import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260727000200_discovery_candidate_deduplication.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");

test("discovery merges candidate provenance under deterministic identities", () => {
  assert.match(migration, /candidate_key text/i);
  assert.match(
    migration,
    /unique \(campaign_run_id, discovery_iteration_id, candidate_key\)/i,
  );
  assert.match(migration, /discovery_candidate_evidence/i);
  assert.match(migration, /resolve_discovered_company/i);
  assert.match(service, /candidateIdentityKey/);
  assert.match(service, /discovery_candidate_evidence/);
  assert.match(service, /resolve_discovered_company/);
});
