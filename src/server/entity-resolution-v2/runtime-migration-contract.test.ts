import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728002200_retry_safe_entity_resolution_stage.sql",
  ),
  "utf8",
);
const repository = readFileSync(
  join(process.cwd(), "src/server/entity-resolution-v2/repository.ts"),
  "utf8",
);
const stage = readFileSync(
  join(process.cwd(), "src/server/entity-resolution-v2/stage-service.ts"),
  "utf8",
);

test("resolution freezes one content-bound batch per Campaign Run and rules version", () => {
  assert.match(migration, /create table public\.entity_resolution_batches_v2/);
  assert.match(migration, /unique \(campaign_run_id, rules_version\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /Entity Resolution batch input changed after it was frozen/);
  assert.match(repository, /hashCanonical\(/);
  assert.match(repository, /ENTITY_RESOLUTION_RUNTIME_RULES_VERSION/);
});

test("candidate intake is scoped through the exact settled Discovery Run", () => {
  assert.match(
    migration,
    /join public\.discovery_segment_runs_v2 segment_run[\s\S]+segment_run\.discovery_run_id = discovery_run\.id/,
  );
  assert.match(migration, /candidate set does not match the frozen Discovery Run/);
  assert.match(migration, /source_record\.ingestion_status = 'normalized'/);
});

test("preliminary grouping never becomes a silent weak canonical merge", () => {
  assert.match(migration, /create table public\.discovery_candidate_groups_v2/);
  assert.match(
    migration,
    /grouping_basis in \('domain', 'name_country', 'name', 'candidate'\)/,
  );
  assert.match(
    migration,
    /Name, country, or an ambiguous domain suggests a possible match but cannot auto-link/,
  );
  assert.match(migration, /decision_action := 'defer_review'/);
  assert.doesNotMatch(migration, /decision_action := 'merge'/);
});

test("resolved organizations receive source lineage and campaign projections atomically", () => {
  assert.match(migration, /resolve_organization_redirect_v2/);
  assert.match(migration, /insert into public\.organization_source_links/);
  assert.match(migration, /insert into public\.campaign_candidates/);
  assert.match(migration, /insert into public\.campaign_candidate_discovery_links/);
  assert.match(migration, /buying_organization_id/);
  assert.match(stage, /stageScope: "canonical_organization_resolution"/);
});

test("runtime RPCs are service-role only and ambiguity remains visible", () => {
  assert.match(
    migration,
    /revoke all on function public\.resolve_campaign_entities_v2[\s\S]+from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.resolve_campaign_entities_v2[\s\S]+to service_role/,
  );
  assert.match(stage, /summary\.needsReview > 0 \? "partial" : "completed"/);
  assert.match(migration, /result_write_mode = 'canonical'[\s\S]+shadow_mode = false/);
});
