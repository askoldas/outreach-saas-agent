import assert from "node:assert/strict";
import test from "node:test";
import {
  completionReasonForAdaptiveAction,
  completionReasonForWorkflowError,
} from "./terminal-reason.ts";

test("adaptive terminal decisions map to outcome language", () => {
  assert.equal(
    completionReasonForAdaptiveAction("stop_target_reached"),
    "target_reached",
  );
  assert.equal(completionReasonForAdaptiveAction("stop_budget"), "internal_cost_guard");
  for (const action of [
    "stop_saturation",
    "stop_low_yield",
    "stop_no_actionable_work",
  ] as const) {
    assert.equal(completionReasonForAdaptiveAction(action), "market_exhausted");
  }
  assert.equal(completionReasonForAdaptiveAction("pause"), null);
  assert.equal(completionReasonForAdaptiveAction("discover_more"), null);
});

test("provider exhaustion is distinct from technical failure and user stop", () => {
  assert.equal(
    completionReasonForWorkflowError(
      new Error("Provider rate limit returned status 429"),
    ),
    "provider_failure",
  );
  assert.equal(
    completionReasonForWorkflowError(new Error("Invariant violated in persistence")),
    "technical_failure",
  );
  assert.equal(
    completionReasonForWorkflowError(new Error("Campaign cancelled by user")),
    "user_stopped",
  );
});
