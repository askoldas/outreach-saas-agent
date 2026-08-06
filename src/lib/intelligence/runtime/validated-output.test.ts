import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  supportsStrictStructuredOutput,
  validateStructuredOutput,
} from "./validated-output.ts";

const schema = z
  .object({
    facts: z.array(
      z
        .object({
          factId: z.string(),
          value: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

test("structured output validation reports the exact missing contract fields", () => {
  const result = validateStructuredOutput(
    schema,
    JSON.stringify({ facts: [{ description: "Wrong provider shape" }] }),
  );
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.issue, /facts\.0\.factId/);
    assert.match(result.issue, /facts\.0\.value/);
  }
});

test("structured output validation accepts one schema-valid JSON object", () => {
  assert.deepEqual(
    validateStructuredOutput(
      schema,
      JSON.stringify({ facts: [{ factId: "fact-1", value: "Supported value" }] }),
    ),
    {
      success: true,
      data: { facts: [{ factId: "fact-1", value: "Supported value" }] },
    },
  );
});

test("strict structured output is used only when every object field is required", () => {
  assert.equal(
    supportsStrictStructuredOutput({
      type: "object",
      properties: { requiredValue: { type: "string" } },
      required: ["requiredValue"],
    }),
    true,
  );
  assert.equal(
    supportsStrictStructuredOutput({
      type: "object",
      properties: {
        requiredValue: { type: "string" },
        optionalValue: { type: "string" },
      },
      required: ["requiredValue"],
    }),
    false,
  );
});
