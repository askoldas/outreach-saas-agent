import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000900_scoped_intelligence_memory.sql",
  "utf8",
);

test("WP-10 creates scoped memory, audit, correction, and promotion persistence", () => {
  for (const table of [
    "intelligence_memories",
    "memory_evidence_links",
    "campaign_memory_snapshots",
    "memory_application_events",
    "memory_promotion_proposals",
    "intelligence_conflicts",
    "user_corrections",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /intelligence_memories_scope_guard/i);
  assert.match(migration, /Cross-workspace Intelligence Memory association/i);
  assert.match(migration, /enable row level security/i);
});

test("legacy memory is read-only and cannot become globally applicable", () => {
  assert.match(migration, /applicability_known boolean not null default true/i);
  assert.match(migration, /memory\.statement, '\{\}'::jsonb, false/i);
  assert.match(
    migration,
    /revoke insert, update, delete on public\.campaign_memories from authenticated/i,
  );
  assert.match(
    migration,
    /revoke insert, update, delete on public\.workspace_memories from authenticated/i,
  );
});

test("corrections remain campaign scoped unless promotion is explicitly accepted", () => {
  assert.match(migration, /chosen_scope text not null default 'campaign'/i);
  assert.match(
    migration,
    /target_workspace_id, 'campaign', target_campaign_id, 'correction'/i,
  );
  assert.match(migration, /target_proposed_offering_id is not null or recurrence >= 3/i);
  assert.match(migration, /status = 'pending'/i);
  assert.match(migration, /if target_decision = 'accepted' then/i);
  assert.match(migration, /'memory_promotion'/i);
});

test("campaign memory is frozen and every application can be audited", () => {
  assert.match(
    migration,
    /create or replace function public\.create_campaign_memory_snapshot/i,
  );
  assert.match(
    migration,
    /content_hash text not null check \(length\(content_hash\) = 64\)/i,
  );
  assert.match(migration, /precedence_result_json jsonb not null/i);
  assert.match(
    migration,
    /result in \('applied', 'overridden', 'ignored', 'conflicted'\)/i,
  );
});
