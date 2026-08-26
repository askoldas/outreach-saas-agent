import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000500_organization_references_v2.sql",
  "utf8",
);
const repository = readFileSync("src/server/entity-resolution-v2/repository.ts", "utf8");

test("Organization References are immutable and retain exact provider lineage", () => {
  assert.match(migration, /create table public\.organization_references_v2/);
  assert.match(migration, /normalized_candidate_id uuid not null/);
  assert.match(migration, /provider_source_record_id uuid not null/);
  assert.match(migration, /provider_execution_id uuid not null/);
  assert.match(migration, /source_expansion_reference_id uuid/);
  assert.match(migration, /organization_references_v2_workspace_guard/);
  assert.match(migration, /organization_references_v2_immutable/);
  assert.match(migration, /enable row level security/);
});

test("all settled normalized candidates materialize before Entity Resolution", () => {
  assert.match(migration, /materialize_campaign_organization_references_v2/);
  assert.match(migration, /join public\.discovery_segment_runs_v2/);
  assert.match(migration, /segment_run\.discovery_run_id = discovery_run\.id/);
  assert.match(migration, /sourceRoles/);
  assert.match(migration, /matchedSegmentIds/);
  assert.match(repository, /materialize_campaign_organization_references_v2/);
  assert.match(repository, /organizationReferenceSchema\s*\.array\(\)\s*\.parse/);
  assert.match(repository, /organizationReferenceId: reference\.id/);
});

test("Entity Resolution submits every normalized candidate using its lineage identity", () => {
  assert.match(
    repository,
    /\.filter\(\(reference\) => frozenCandidateIdByReferenceId\.has\(reference\.id\)\)/,
  );
  assert.match(repository, /normalized_candidate_id/);
  assert.match(
    repository,
    /normalizedCandidateId: frozenCandidateIdByReferenceId\.get\(reference\.id\)/,
  );
  assert.doesNotMatch(repository, /\.eq\("ingestion_status", "normalized"\)/);
});

test("Organization References do not create or merge canonical organizations", () => {
  assert.doesNotMatch(migration, /insert into public\.organizations/);
  assert.doesNotMatch(migration, /insert into public\.organization_redirects/);
  assert.match(migration, /normalized_provider_candidates/);
});
