import assert from "node:assert/strict";
import test from "node:test";
import { AbortTaskRunError } from "@trigger.dev/sdk";
import { classifyWorkflowError, errorForTrigger } from "./errors.ts";

test("workflow errors separate retryable provider failures from validation failures", () => {
  assert.deepEqual(classifyWorkflowError(new Error("fetch failed")), {
    category: "retryable_network",
    message: "fetch failed",
    retryable: true,
  });
  assert.deepEqual(classifyWorkflowError(new Error("Candidate response is invalid")), {
    category: "validation",
    message: "Candidate response is invalid",
    retryable: false,
  });
});

test("non-retryable errors abort Trigger retries", () => {
  assert.ok(errorForTrigger(new Error("Forbidden")) instanceof AbortTaskRunError);
  const transient = new Error("request timed out");
  assert.equal(errorForTrigger(transient), transient);
});

test("serialized terminal errors preserve their workflow category", () => {
  assert.deepEqual(
    classifyWorkflowError(
      new Error("[invalid_provider_response] Provider returned malformed JSON."),
    ),
    {
      category: "invalid_provider_response",
      message: "[invalid_provider_response] Provider returned malformed JSON.",
      retryable: false,
    },
  );
});
