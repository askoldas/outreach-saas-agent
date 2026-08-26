import {
  campaignV2Stages,
  type CampaignV2Stage,
  type WorkflowControlState,
} from "./contracts.ts";

export function remainingCampaignStages(
  completedCheckpoints: CampaignV2Stage[],
): CampaignV2Stage[] {
  const completed = new Set(completedCheckpoints);
  return campaignV2Stages.filter((stage) => !completed.has(stage));
}

export function decideWorkflowControl(input: {
  latestCommand?: "pause" | "resume" | "cancel";
  currentState: WorkflowControlState;
}): WorkflowControlState {
  if (input.currentState === "cancelled") return "cancelled";
  if (input.latestCommand === "cancel") return "cancel_requested";
  if (input.latestCommand === "pause" && input.currentState === "run")
    return "pause_requested";
  if (input.latestCommand === "resume" && input.currentState === "paused") return "run";
  return input.currentState;
}

export function stageCheckpointKey(stage: CampaignV2Stage): string {
  return `campaign_v2:${stage}:complete`;
}

export function researchCycleStageCheckpointKey(
  stage: CampaignV2Stage,
  cycleNumber: number,
): string {
  if (!Number.isInteger(cycleNumber) || cycleNumber < 1) {
    throw new Error("Research cycle number must be a positive integer.");
  }
  return cycleNumber === 1
    ? stageCheckpointKey(stage)
    : `campaign_v2:cycle:${cycleNumber}:${stage}:complete`;
}

export function stagesForResearchCycle(cycleNumber: number): CampaignV2Stage[] {
  if (!Number.isInteger(cycleNumber) || cycleNumber < 1) {
    throw new Error("Research cycle number must be a positive integer.");
  }
  return cycleNumber === 1
    ? [...campaignV2Stages]
    : ["research_candidates", "qualify_candidates", "rank_candidates"];
}

export function stagesForResearchContinuation(
  action:
    | "research_existing_pool"
    | "discover_more"
    | "expand_source_pages"
    | "stop_budget",
): CampaignV2Stage[] {
  return action === "research_existing_pool" || action === "stop_budget"
    ? ["research_candidates", "qualify_candidates", "rank_candidates"]
    : [
        "discover",
        "resolve_entities",
        "research_candidates",
        "qualify_candidates",
        "rank_candidates",
      ];
}

export function aggregateWorkflowProgress(input: {
  completedStages: CampaignV2Stage[];
  activeStage?: CampaignV2Stage;
  failedCandidateCount: number;
  totalCandidateCount: number;
}) {
  const completed = new Set(input.completedStages);
  const stagePercent = Math.round((completed.size / campaignV2Stages.length) * 100);
  return {
    stagePercent,
    completedStageCount: completed.size,
    totalStageCount: campaignV2Stages.length,
    activeStage: input.activeStage ?? null,
    failedCandidateCount: input.failedCandidateCount,
    totalCandidateCount: input.totalCandidateCount,
    candidateFailureRate:
      input.totalCandidateCount === 0
        ? 0
        : input.failedCandidateCount / input.totalCandidateCount,
  };
}
