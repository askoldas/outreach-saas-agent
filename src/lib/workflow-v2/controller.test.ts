import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateWorkflowProgress,
  decideWorkflowControl,
  remainingCampaignStages,
  researchCycleStageCheckpointKey,
  stageCheckpointKey,
  stagesForResearchContinuation,
  stagesForResearchCycle,
} from "./controller.ts";

test("resume skips every completed durable checkpoint", () => {
  assert.deepEqual(remainingCampaignStages(["initialize", "market_analysis", "discover"]), [
    "resolve_entities",
    "research_candidates",
    "qualify_candidates",
    "rank_candidates",
  ]);
  assert.equal(stageCheckpointKey("discover"), "campaign_v2:discover:complete");
});

test("continuation action controls whether discovery is repeated", () => {
  assert.deepEqual(stagesForResearchContinuation("research_existing_pool"), [
    "research_candidates",
    "qualify_candidates",
    "rank_candidates",
  ]);
  assert.deepEqual(stagesForResearchContinuation("discover_more"), [
    "discover",
    "resolve_entities",
    "research_candidates",
    "qualify_candidates",
    "rank_candidates",
  ]);
  assert.deepEqual(
    stagesForResearchContinuation("expand_source_pages"),
    stagesForResearchContinuation("discover_more"),
  );
});

test("continuation cycles rerun only repeatable evidence stages with distinct checkpoints", () => {
  assert.deepEqual(stagesForResearchCycle(2), [
    "research_candidates",
    "qualify_candidates",
    "rank_candidates",
  ]);
  assert.equal(
    researchCycleStageCheckpointKey("research_candidates", 2),
    "campaign_v2:cycle:2:research_candidates:complete",
  );
  assert.equal(
    researchCycleStageCheckpointKey("discover", 1),
    stageCheckpointKey("discover"),
  );
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
      completedStages: ["initialize", "market_analysis", "discover"],
      activeStage: "research_candidates",
      failedCandidateCount: 2,
      totalCandidateCount: 10,
    }),
    {
      stagePercent: 43,
      completedStageCount: 3,
      totalStageCount: 7,
      activeStage: "research_candidates",
      failedCandidateCount: 2,
      totalCandidateCount: 10,
      candidateFailureRate: 0.2,
    },
  );
});
