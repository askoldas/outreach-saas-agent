import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726000800_sync_classification_model_config.sql",
  import.meta.url,
);

test("classification model audit config matches the economical code registry", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /role = 'search_result_classification'/);
  assert.match(migration, /model_id = 'openai\/gpt-5-mini'/);
  assert.match(migration, /workspace_id is null/);
  assert.doesNotMatch(migration, /delete from|truncate/i);
});
