import assert from "node:assert/strict";
import test from "node:test";
import { parseGeneratedDraft } from "./draft-generation.ts";

test("parses a schema-shaped grounded draft", () => {
  const result = parseGeneratedDraft(
    '```json\n{"subject":"A relevant introduction","body":"Hello, this is grounded.","sellerClaims":["Claim"],"evidenceUsed":["Evidence"],"warnings":[]}\n```',
  );
  assert.equal(result.subject, "A relevant introduction");
  assert.deepEqual(result.evidenceUsed, ["Evidence"]);
});

test("rejects incomplete draft output", () => {
  assert.throws(() => parseGeneratedDraft('{"subject":"Hello"}'), /invalid body/);
});
