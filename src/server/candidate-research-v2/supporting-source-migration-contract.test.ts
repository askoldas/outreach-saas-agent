import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260904000200_candidate_supporting_research_sources.sql",
  import.meta.url,
);

test("supporting Candidate Research sources have distinct retry-safe provenance", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /persist_candidate_supporting_source_v2/);
  assert.match(migration, /'supporting_search'/);
  assert.match(migration, /'fetch_external_source'/);
  assert.match(migration, /target_provider_request_id/);
  assert.match(migration, /manual_source_label/);
  assert.match(migration, /target_published_at/);
  assert.match(migration, /candidate_research_artifact_supporting_source_idx/);
});

test("supporting-source persistence remains service-only and tenant guarded", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /workspace_id = target_workspace_id/);
  assert.match(
    migration,
    /revoke all on function public\.persist_candidate_supporting_source_v2[\s\S]*authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.persist_candidate_supporting_source_v2[\s\S]*to service_role/,
  );
});
