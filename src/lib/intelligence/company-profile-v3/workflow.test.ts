import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileV3DraftState, runProfileV3Workflow } from "./workflow.ts";

test("profile workflow completes ordered stages and reports cached resume work", async () => {
  const calls: string[] = [];
  const result = await runProfileV3Workflow({
    stageIds: ["extract", "synthesize", "audit"],
    runStage: async (stageId) => {
      calls.push(stageId);
      return {
        taskRunId: `run-${stageId}`,
        cached: stageId === "extract",
      };
    },
    finalize: async () => ({ state: "ready_for_review" as const }),
  });

  assert.deepEqual(calls, ["extract", "synthesize", "audit"]);
  assert.deepEqual(result.taskRunIds, ["run-extract", "run-synthesize", "run-audit"]);
  assert.deepEqual(result.cachedStageIds, ["extract"]);
  assert.equal(result.state, "ready_for_review");
});

test("profile workflow stops at a terminal child failure and does not finalize", async () => {
  const calls: string[] = [];
  let finalized = false;
  await assert.rejects(
    runProfileV3Workflow({
      stageIds: ["extract", "synthesize", "audit"],
      runStage: async (stageId) => {
        calls.push(stageId);
        if (stageId === "synthesize") throw new Error("invalid provider output");
        return { taskRunId: `run-${stageId}`, cached: false };
      },
      finalize: async () => {
        finalized = true;
        return { state: "ready_for_review" as const };
      },
    }),
    /invalid provider output/,
  );
  assert.deepEqual(calls, ["extract", "synthesize"]);
  assert.equal(finalized, false);
});

test("clarification needs never gate review readiness", () => {
  assert.equal(
    resolveProfileV3DraftState({
      publishRecommendation: "ready",
    }),
    "ready_for_review",
  );
  assert.equal(
    resolveProfileV3DraftState({
      publishRecommendation: "needs_input",
    }),
    "ready_for_review",
  );
  assert.equal(
    resolveProfileV3DraftState({
      publishRecommendation: "invalid",
    }),
    "needs_input",
  );
});
