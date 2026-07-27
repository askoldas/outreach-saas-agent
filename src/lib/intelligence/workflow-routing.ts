import type { IntelligenceVersion } from "./rollout.ts";

export function resolveCampaignTaskId(workflowVersion: IntelligenceVersion) {
  if (workflowVersion === "v1") return "execute-campaign" as const;
  throw new Error(
    `Campaign workflow "${workflowVersion}" is persisted but its Trigger task is not enabled yet.`,
  );
}
