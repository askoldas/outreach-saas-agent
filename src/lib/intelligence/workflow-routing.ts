import type { IntelligenceVersion } from "./rollout.ts";

export function resolveCampaignTaskId(workflowVersion: IntelligenceVersion) {
  if (workflowVersion === "v1") return "execute-campaign" as const;
  return "execute-campaign-v2" as const;
}
