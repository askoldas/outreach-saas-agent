import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000300_intelligence_claims_and_evidence.sql",
  "utf8",
);

test("WP-03 creates the shared evidence, claim, link, and conflict stores", () => {
  for (const table of [
    "evidence_items",
    "intelligence_claims",
    "claim_evidence_links",
    "claim_conflicts",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(migration, new RegExp(`is_workspace_(member|admin)\\(workspace_id\\)`));
  }
});

test("evidence has exactly one source and source workspace guards", () => {
  assert.match(migration, /num_nonnulls\(/);
  assert.match(migration, /validate_evidence_source_workspace/);
  assert.match(migration, /Company source must belong to the evidence workspace/);
  assert.match(migration, /Document chunk must belong to the evidence workspace/);
  assert.match(migration, /Provider execution must belong to the evidence workspace/);
});

test("claims and links are append-only and persisted atomically", () => {
  assert.match(migration, /prevent_evidence_claim_mutation/);
  assert.match(migration, /create_intelligence_claim_with_evidence/);
  assert.match(migration, /security definer/);
  assert.match(
    migration,
    /revoke insert, update, delete on public\.intelligence_claims from authenticated/,
  );
  assert.match(migration, /Explicit facts require supporting evidence/);
});

test("conflicts preserve both claims and validate tenant and subject identity", () => {
  assert.match(migration, /first_claim_id uuid not null/);
  assert.match(migration, /second_claim_id uuid not null/);
  assert.match(migration, /validate_claim_conflict_workspace/);
  assert.match(
    migration,
    /Conflicting claims must share workspace, subject, and claim key/,
  );
  assert.match(migration, /Winning claim must be a member of the conflict/);
  assert.match(migration, /claim_conflicts_pair_idx/);
  assert.match(migration, /Claim conflict identity is immutable/);
  assert.match(migration, /Resolved claim conflicts are immutable/);
});

test("WP-03 does not invent a legacy claim backfill", () => {
  assert.doesNotMatch(migration, /insert into public\.evidence_items\s+select/i);
  assert.doesNotMatch(migration, /insert into public\.intelligence_claims\s+select/i);
});
