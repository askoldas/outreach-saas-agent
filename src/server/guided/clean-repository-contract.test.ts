import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("guided drafts use the clean proposal document instead of retired columns", () => {
  assert.match(repository, /proposal:/);
  assert.match(repository, /currentStep: input\.currentStep/);
  assert.match(repository, /draftData: input\.draftData/);
  assert.doesNotMatch(
    repository,
    /current_step|completed_steps|draft_data|guided_response/,
  );
});

test("guided messages and applied changes use clean aggregate audit columns", () => {
  assert.match(repository, /metadata: \{ guidedResponse: input\.response \}/);
  assert.match(repository, /source_version: sourceVersion/);
  assert.match(repository, /target_version: sourceVersion \+ 1/);
  assert.match(repository, /changes: input\.changes/);
  assert.match(repository, /applied_by: userId/);
  assert.doesNotMatch(
    repository,
    /proposal_id|entity_type|field_path|applied_value|applied_by_user_id/,
  );
});
