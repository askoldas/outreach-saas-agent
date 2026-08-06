import assert from "node:assert/strict";
import test from "node:test";
import {
  outreachDraftTaskDefinition,
  parseGeneratedDraft,
} from "./draft-generation.ts";

test("parses a schema-shaped grounded draft", () => {
  const result = parseGeneratedDraft(
    '```json\n{"subject":"A relevant introduction","body":"Hello, this is grounded.","sellerClaims":["Claim"],"evidenceUsed":["Evidence"],"warnings":[]}\n```',
  );
  assert.equal(result.subject, "A relevant introduction");
  assert.deepEqual(result.evidenceUsed, ["Evidence"]);
});

test("rejects incomplete draft output", () => {
  assert.throws(() => parseGeneratedDraft('{"subject":"Hello"}'));
});

test("outreach generation is a bounded shared-runtime task", () => {
  assert.equal(outreachDraftTaskDefinition.taskId, "outreach.grounded_draft");
  assert.equal(outreachDraftTaskDefinition.maxCompletionTokens, 2_000);
  assert.equal(outreachDraftTaskDefinition.allowsRepair, true);
  assert.equal(outreachDraftTaskDefinition.allowsFallback, true);
  assert.match(outreachDraftTaskDefinition.promptVersion, /shared-runtime/);
});
