import { evolvingMarketOverviewSchema, type EvolvingMarketOverview } from "@/lib/company-research/market-overview";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { AdaptiveResearchDecision } from "@/lib/adaptive-research-v2/contracts";
import type { Json } from "@/types/database.types";

type RpcResult = { data: unknown; error: { message: string } | null };

export async function persistEvolvingMarketOverview(input: {
  workspaceId: string;
  campaignRunId: string;
  researchCycleId: string;
  cycleNumber: number;
  decision: AdaptiveResearchDecision;
}) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as { rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult> };
  const [priorResult, analysisResult] = await Promise.all([
    database.rpc("get_latest_research_market_overview", {
      target_workspace_id: input.workspaceId,
      target_campaign_run_id: input.campaignRunId,
    }),
    supabase.from("market_analyses").select("analysis").eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (priorResult.error)
    throw new Error(`Could not load prior Market Overview: ${priorResult.error.message}`);
  if (analysisResult.error)
    throw new Error(`Could not load Market Overview baseline: ${analysisResult.error.message}`);
  const prior = priorResult.data;
  const analysis = analysisResult.data;
  const previous = prior ? evolvingMarketOverviewSchema.parse(prior) : null;
  const base = (analysis?.analysis ?? {}) as Record<string, Json>;
  const terminology = Array.isArray(base.localTerminology) ? base.localTerminology : [];
  const sourceFamilies = Array.isArray(base.majorSourceFamilies) ? base.majorSourceFamilies : [];
  const overview: EvolvingMarketOverview = evolvingMarketOverviewSchema.parse({
    schemaVersion: 1,
    cycleNumber: input.cycleNumber,
    summary: String(base.marketSummary ?? previous?.summary ?? "Company Research is building an evidence-backed view of this market."),
    localTerminology: terminology,
    sourceFamilies,
    observations: [
      ...(previous?.observations ?? []),
      { cycleNumber: input.cycleNumber, statement: input.decision.rationale },
    ].slice(-20),
    exploredDirectionCount: (previous?.exploredDirectionCount ?? 0) + input.decision.actionableDiscoveryGaps,
    nextDirection: input.decision.additionalOpportunityRemains ? input.decision.reasonCode : null,
    saturationState: saturationState(input.decision),
    updatedAt: new Date().toISOString(),
  });
  const { data, error } = await database.rpc("persist_research_market_overview", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_research_cycle_id: input.researchCycleId,
    target_cycle_number: input.cycleNumber,
    target_overview: overview as unknown as Json,
  });
  if (error) throw new Error(`Could not persist evolving Market Overview: ${error.message}`);
  return evolvingMarketOverviewSchema.parse(data);
}

function saturationState(decision: AdaptiveResearchDecision): EvolvingMarketOverview["saturationState"] {
  if (decision.action === "pause" || decision.action === "stop_budget") return "paused";
  if (decision.action === "stop_saturation") return "saturated";
  if (decision.action === "stop_low_yield") return "low_yield";
  if (decision.action === "stop_no_actionable_work" || decision.action === "cancel") return "complete";
  return "active";
}
