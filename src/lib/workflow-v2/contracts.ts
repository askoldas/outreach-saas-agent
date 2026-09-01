export const campaignV2Stages = [
  "initialize",
  "discover",
  "resolve_entities",
  "research_candidates",
  "qualify_candidates",
  "rank_candidates",
] as const;

// Historical in-flight runs may still deliver this task after a deployment. It is not
// part of the active stage registry used to plan new Company Research runs.
export const historicalCampaignV2Stages = ["market_analysis"] as const;

export type CampaignV2Stage =
  | (typeof campaignV2Stages)[number]
  | (typeof historicalCampaignV2Stages)[number];

export type WorkflowControlState =
  | "run"
  | "pause_requested"
  | "paused"
  | "cancel_requested"
  | "cancelled";

export type StageResult = {
  stage: CampaignV2Stage;
  status: "completed" | "partial" | "blocked";
  outputReferences: Record<string, unknown>;
  progressDelta: Record<string, number>;
  usageEventIds: string[];
};
