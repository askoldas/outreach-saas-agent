import { createServiceRoleClient } from "@/lib/supabase/service";
import { getResearchBudgetState } from "./repository";

export async function getInternalResearchUsage(input: { workspaceId: string; campaignRunId: string }) {
  if (process.env.NEXT_PUBLIC_OPPTIUM_INTERNAL_USAGE !== "true") return null;
  const supabase = createServiceRoleClient();
  const [{ data, error }, budget] = await Promise.all([
    supabase.from("usage_ledger").select("provider,actual_cost_usd,billable_cost_usd,raw_provider_usage")
      .eq("workspace_id", input.workspaceId).eq("campaign_run_id", input.campaignRunId)
      .eq("entry_type", "settlement"),
    getResearchBudgetState(input),
  ]);
  if (error) throw new Error(`Could not load internal provider usage: ${error.message}`);
  const rows = data ?? [];
  const grouped = new Map<string, { calls: number; actualCostUsd: number; inputTokens: number; outputTokens: number; reasoningTokens: number; cachedTokens: number; providerUnits: number }>();
  for (const row of rows) {
    const key = row.provider ?? "unknown";
    const value = grouped.get(key) ?? { calls: 0, actualCostUsd: 0, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0, providerUnits: 0 };
    const raw = row.raw_provider_usage as Record<string, unknown>;
    value.calls += 1; value.actualCostUsd += Number(row.actual_cost_usd);
    value.inputTokens += Number(raw.inputTokens ?? 0); value.outputTokens += Number(raw.outputTokens ?? 0);
    value.reasoningTokens += Number(raw.reasoningTokens ?? 0); value.cachedTokens += Number(raw.cachedTokens ?? 0);
    value.providerUnits += Number(raw.providerUnits ?? 0); grouped.set(key, value);
  }
  return { budget,
    totalActualCostUsd: rows.reduce((sum, row) => sum + Number(row.actual_cost_usd), 0),
    totalBillableCostUsd: rows.reduce((sum, row) => sum + Number(row.billable_cost_usd), 0),
    providers: [...grouped.entries()].map(([provider, value]) => ({ provider, ...value })),
  };
}
