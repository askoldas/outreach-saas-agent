import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260723000700_create_ai_guided_workflows.sql",
    import.meta.url,
  ),
  "utf8",
);
const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("guided drafts, conversations, messages, and applied changes are tenant scoped", () => {
  for (const table of [
    "ai_guided_drafts",
    "ai_conversations",
    "ai_messages",
    "ai_applied_changes",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /clear_guided_workflow_data_with_profile/);
});

test("AI-applied changes retain version, source, actor, and undo metadata", () => {
  for (const field of [
    "base_version int",
    "source text",
    "applied_by_user_id uuid",
    "applied_at timestamptz",
    "undone_at timestamptz",
  ])
    assert.match(migration, new RegExp(field));
});

test("campaign setup remains usable before the optional guided migration is applied", () => {
  assert.match(repository, /PGRST205/);
  assert.match(repository, /return null/);
  assert.match(repository, /id: "session-only"/);
});
