export const campaignV2Stages = [
  "initialize",
  "market_analysis",
  "discover",
  "resolve_entities",
  "research_candidates",
  "qualify_candidates",
  "rank_candidates",
] as const;

export type CampaignV2Stage = (typeof campaignV2Stages)[number];

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
