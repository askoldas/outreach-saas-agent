export const campaignStrategyModelRouteVersion =
  "campaign-strategy-compilation-route/v2";

export const campaignStrategyBaselineContract = {
  taskId: "campaign.strategy_baseline",
  promptVersion: "campaign-strategy-deterministic-baseline/v1",
  schemaVersion: "campaign-strategy-v2",
  contextCompilerVersion: "campaign-context/v2.2-market-specific",
} as const;
