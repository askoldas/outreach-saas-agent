import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateWorkflowProgress,
  decideWorkflowControl,
  remainingCampaignStages,
  stageCheckpointKey,
} from "./controller.ts";

test("resume skips every completed durable checkpoint", () => {
  assert.deepEqual(remainingCampaignStages(["initialize", "discover"]), [
    "resolve_entities",
    "research_candidates",
    "qualify_candidates",
    "rank_candidates",
  ]);
  assert.equal(stageCheckpointKey("discover"), "campaign_v2:discover:complete");
});

test("cancel dominates pause and completed cancellation is terminal", () => {
  assert.equal(
    decideWorkflowControl({ latestCommand: "cancel", currentState: "pause_requested" }),
    "cancel_requested",
  );
  assert.equal(
    decideWorkflowControl({ latestCommand: "resume", currentState: "cancelled" }),
    "cancelled",
  );
});

test("pause requires an explicit resume command", () => {
  assert.equal(
    decideWorkflowControl({ latestCommand: "pause", currentState: "run" }),
    "pause_requested",
  );
  assert.equal(
    decideWorkflowControl({ latestCommand: "resume", currentState: "paused" }),
    "run",
  );
});

test("progress uses named stages and explicit candidate failure counts", () => {
  assert.deepEqual(
    aggregateWorkflowProgress({
      completedStages: ["initialize", "discover", "resolve_entities"],
      activeStage: "research_candidates",
      failedCandidateCount: 2,
      totalCandidateCount: 10,
    }),
    {
      stagePercent: 50,
      completedStageCount: 3,
      totalStageCount: 6,
      activeStage: "research_candidates",
      failedCandidateCount: 2,
      totalCandidateCount: 10,
      candidateFailureRate: 0.2,
    },
  );
});
