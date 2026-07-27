import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

test("editable campaign lead notes are loaded and persisted", () => {
  const cleanRepository = source("./clean-repository.ts");
  const repository = source("./repository.ts");
  const actions = source("./actions.ts");
  const review = source("../../features/leads/CampaignLeadReview.tsx");

  assert.match(cleanRepository, /\buser_notes\b/);
  assert.match(cleanRepository, /userNotes:\s*row\.user_notes/);
  assert.match(repository, /\.update\(\{\s*user_notes:/);
  assert.match(repository, /\.eq\("workspace_id",\s*workspaceId\)/);
  assert.match(actions, /updateLeadNotesAction/);
  assert.match(review, /defaultValue=\{lead\.userNotes\}/);
  assert.match(review, />\s*Save notes\s*</);
  assert.doesNotMatch(review, /notes are not persisted/i);
});
