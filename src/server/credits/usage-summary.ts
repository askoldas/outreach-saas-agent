import { createServiceRoleClient } from "@/lib/supabase/service";
import { summarizeOutcomeEconomics } from "./outcome-economics";
import { getResearchBudgetState } from "./repository";

export async function getInternalResearchUsage(input: {
  workspaceId: string;
  campaignRunId: string;
}) {
  if (process.env.NEXT_PUBLIC_OPPTIUM_INTERNAL_USAGE !== "true") return null;
  const supabase = createServiceRoleClient();
  const [{ data: run, error: runError }, { data, error }, budget] = await Promise.all([
    supabase
      .from("campaign_runs")
      .select("campaign_id,strategy_version_id")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.campaignRunId)
      .single(),
    supabase
      .from("usage_ledger")
      .select("provider,actual_cost_usd,billable_cost_usd,raw_provider_usage")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .eq("entry_type", "settlement"),
    getResearchBudgetState(input),
  ]);
  if (runError)
    throw new Error(`Could not load research outcome usage: ${runError.message}`);
  if (error) throw new Error(`Could not load internal provider usage: ${error.message}`);
  const rows = data ?? [];
  const grouped = new Map<
    string,
    {
      calls: number;
      actualCostUsd: number;
      inputTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      cachedTokens: number;
      providerUnits: number;
    }
  >();
  for (const row of rows) {
    const key = row.provider ?? "unknown";
    const value = grouped.get(key) ?? {
      calls: 0,
      actualCostUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cachedTokens: 0,
      providerUnits: 0,
    };
    const raw = objectValue(row.raw_provider_usage);
    value.calls += 1;
    value.actualCostUsd += Number(row.actual_cost_usd);
    value.inputTokens += Number(raw.inputTokens ?? 0);
    value.outputTokens += Number(raw.outputTokens ?? 0);
    value.reasoningTokens += Number(raw.reasoningTokens ?? 0);
    value.cachedTokens += Number(raw.cachedTokens ?? 0);
    value.providerUnits += Number(raw.providerUnits ?? 0);
    grouped.set(key, value);
  }
  const totalActualCostUsd = rows.reduce(
    (sum, row) => sum + Number(row.actual_cost_usd),
    0,
  );
  const totalBillableCostUsd = rows.reduce(
    (sum, row) => sum + Number(row.billable_cost_usd),
    0,
  );
  const outcomeEconomics = await loadOutcomeEconomics({
    actualCostUsd: totalActualCostUsd,
    billableCostUsd: totalBillableCostUsd,
    campaignId: run.campaign_id,
    campaignRunId: input.campaignRunId,
    strategyVersionId: run.strategy_version_id,
    supabase,
    workspaceId: input.workspaceId,
  });
  return {
    budget,
    totalActualCostUsd,
    totalBillableCostUsd,
    providers: [...grouped.entries()].map(([provider, value]) => ({
      provider,
      ...value,
    })),
    outcomeEconomics,
  };
}

async function loadOutcomeEconomics(input: {
  actualCostUsd: number;
  billableCostUsd: number;
  campaignId: string;
  campaignRunId: string;
  strategyVersionId: string;
  supabase: ReturnType<typeof createServiceRoleClient>;
  workspaceId: string;
}) {
  const [candidateResult, batchResult] = await Promise.all([
    input.supabase
      .from("campaign_candidates")
      .select("id,display_organization_id,state")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_id", input.campaignId)
      .eq("campaign_strategy_version_id", input.strategyVersionId),
    input.supabase
      .from("candidate_qualification_batches_v2")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId),
  ]);
  const firstError = candidateResult.error ?? batchResult.error;
  if (firstError)
    throw new Error(`Could not load outcome economics: ${firstError.message}`);
  const candidates = (candidateResult.data ?? []).map((candidate) => ({
    id: candidate.id,
    organizationId: candidate.display_organization_id,
    state: candidate.state,
  }));
  const candidateIds = candidates.map(({ id }) => id);
  const batchIds = (batchResult.data ?? []).map(({ id }) => id);
  const [memberResult, linkResult] = await Promise.all([
    batchIds.length
      ? input.supabase
          .from("candidate_qualification_batch_members_v2")
          .select("campaign_candidate_id,status,output_reference_json")
          .eq("workspace_id", input.workspaceId)
          .in("candidate_qualification_batch_id", batchIds)
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length
      ? input.supabase
          .from("campaign_candidate_discovery_links")
          .select("campaign_candidate_id,provider_source_record_id")
          .eq("workspace_id", input.workspaceId)
          .in("campaign_candidate_id", candidateIds)
          .not("provider_source_record_id", "is", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const attributionError = memberResult.error ?? linkResult.error;
  if (attributionError)
    throw new Error(`Could not load outcome attribution: ${attributionError.message}`);
  const links = (linkResult.data ?? []).flatMap((link) =>
    link.provider_source_record_id
      ? [
          {
            candidateId: link.campaign_candidate_id,
            sourceId: link.provider_source_record_id,
          },
        ]
      : [],
  );
  const sourceIds = [...new Set(links.map(({ sourceId }) => sourceId))];
  const sourceResult = sourceIds.length
    ? await input.supabase
        .from("provider_source_records")
        .select("id,provider_key,source_type")
        .eq("workspace_id", input.workspaceId)
        .in("id", sourceIds)
    : { data: [], error: null };
  if (sourceResult.error)
    throw new Error(`Could not load source attribution: ${sourceResult.error.message}`);
  return summarizeOutcomeEconomics({
    actualCostUsd: input.actualCostUsd,
    billableCostUsd: input.billableCostUsd,
    candidates,
    qualificationFacts: (memberResult.data ?? []).map((member) => {
      const output = objectValue(member.output_reference_json);
      return {
        candidateId: member.campaign_candidate_id,
        lane: typeof output.lane === "string" ? output.lane : null,
        status: member.status,
      };
    }),
    discoveryLinks: links,
    sources: (sourceResult.data ?? []).map((source) => ({
      id: source.id,
      provider: source.provider_key,
      sourceType: source.source_type,
    })),
  });
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
