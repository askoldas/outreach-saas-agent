import { getIntelligenceFeatureFlags } from "@/lib/intelligence/feature-flags";
import { intelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";

export type RolloutGate = {
  detail: string;
  key: string;
  label: string;
  passed: boolean;
  required: boolean;
};

export type ControlledBetaReadiness = {
  activeV2Runs: number;
  completedV2Runs: number;
  correctionRate: number | null;
  failureRate: number | null;
  gates: RolloutGate[];
  ready: boolean;
  recommendedCandidates: number;
  reviewDecisionRate: number | null;
  settings: {
    campaignWorkflow: string;
    profileVersion: string;
    resultWriteMode: string;
    shadowMode: boolean;
  };
  totalV2Runs: number;
};

export async function getControlledBetaReadiness(
  workspaceId: string,
): Promise<ControlledBetaReadiness> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const settings = await getWorkspaceIntelligenceSettings(workspaceId);
  const { data: runs, error: runError } = await supabase
    .from("campaign_runs")
    .select("id,status")
    .eq("workspace_id", workspaceId)
    .eq("workflow_version", "v2");
  if (runError) throw new Error(`Could not assess V2 Campaign Runs: ${runError.message}`);

  const runIds = (runs ?? []).map((run) => run.id);
  const { data: rankSnapshots, error: rankSnapshotError } = runIds.length
    ? await supabase
        .from("candidate_rank_snapshots")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("campaign_run_id", runIds)
    : { data: [], error: null };
  if (rankSnapshotError) {
    throw new Error(`Could not assess V2 rank snapshots: ${rankSnapshotError.message}`);
  }
  const rankSnapshotIds = (rankSnapshots ?? []).map((snapshot) => snapshot.id);
  const emptyResult = { count: 0, error: null };
  const [rankResult, reviewResult, correctionResult, entityResult] = runIds.length
    ? await Promise.all([
        rankSnapshotIds.length
          ? supabase
              .from("candidate_rank_entries")
              .select("id,lane", { count: "exact" })
              .eq("workspace_id", workspaceId)
              .in("rank_snapshot_id", rankSnapshotIds)
          : Promise.resolve(emptyResult),
        supabase
          .from("candidate_review_decisions_v2")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("campaign_run_id", runIds),
        supabase
          .from("candidate_corrections_v2")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("campaign_run_id", runIds),
        supabase
          .from("entity_resolution_cases")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("campaign_run_id", runIds)
          .neq("status", "resolved"),
      ])
    : [emptyResult, emptyResult, emptyResult, emptyResult];
  const queryError =
    rankResult.error ??
    reviewResult.error ??
    correctionResult.error ??
    entityResult.error;
  if (queryError)
    throw new Error(`Could not assess V2 rollout quality: ${queryError.message}`);

  const flags = getIntelligenceFeatureFlags();
  const completedRuns = (runs ?? []).filter((run) =>
    ["completed", "ready_for_review", "partial"].includes(run.status),
  ).length;
  const failedRuns = (runs ?? []).filter((run) => run.status === "failed").length;
  const activeRuns = (runs ?? []).filter((run) =>
    ["queued", "running", "paused"].includes(run.status),
  ).length;
  const rankedCount = rankResult.count ?? rankResult.data?.length ?? 0;
  const reviewCount = reviewResult.count ?? 0;
  const correctionCount = correctionResult.count ?? 0;
  const recommendedCount =
    "data" in rankResult
      ? (rankResult.data ?? []).filter((entry) => entry.lane === "recommended").length
      : 0;

  const gates: RolloutGate[] = [
    {
      detail:
        "WP-20 benchmark and holdout evidence was explicitly postponed before V2 became the canonical default.",
      key: "benchmark_evidence",
      label: "Frozen and holdout benchmarks meet release thresholds",
      passed: false,
      required: false,
    },
    {
      detail: intelligenceExternalCallsAllowed("provider")
        ? "V2 provider calls are allowed; set INTELLIGENCE_V2_PROVIDER_CALLS_ENABLED=false to stop them."
        : "V2 provider calls are stopped by the operator kill switch.",
      key: "provider_calls",
      label: "Provider-call kill switch is configured",
      passed: intelligenceExternalCallsAllowed("provider"),
      required: true,
    },
    {
      detail: intelligenceExternalCallsAllowed("model")
        ? "V2 model calls are allowed; set INTELLIGENCE_V2_MODEL_CALLS_ENABLED=false to stop them."
        : "V2 model calls are stopped by the operator kill switch.",
      key: "model_calls",
      label: "Model-call kill switch is configured",
      passed: intelligenceExternalCallsAllowed("model"),
      required: true,
    },
    {
      detail: completedRuns
        ? `${completedRuns} V2 Campaign Run(s) reached a reviewable terminal state.`
        : "No V2 Campaign Run has reached a reviewable terminal state.",
      key: "completed_run",
      label: "At least one end-to-end V2 run completed",
      passed: completedRuns > 0,
      required: true,
    },
    {
      detail: entityResult.count
        ? `${entityResult.count} unresolved entity-resolution case(s).`
        : "No unresolved entity-resolution cases in observed V2 runs.",
      key: "entity_integrity",
      label: "No unresolved entity-integrity blockers",
      passed: (entityResult.count ?? 0) === 0,
      required: true,
    },
    {
      detail:
        "The rollback RPC preserves historical V2 campaigns and disables new V2 routing.",
      key: "rollback",
      label: "Workspace rollback is available",
      passed: true,
      required: true,
    },
    {
      detail: flags.INTELLIGENCE_V2_ENABLED
        ? "The retired rollout flag agrees with the canonical V2 default."
        : "The retired rollout flag is off but cannot downgrade canonical V2 routing.",
      key: "master_switch",
      label: "Retired rollout flag does not control workflow routing",
      passed: true,
      required: false,
    },
  ];

  return {
    activeV2Runs: activeRuns,
    completedV2Runs: completedRuns,
    correctionRate: rankedCount ? correctionCount / rankedCount : null,
    failureRate: runs?.length ? failedRuns / runs.length : null,
    gates,
    ready: gates.filter((gate) => gate.required).every((gate) => gate.passed),
    recommendedCandidates: recommendedCount,
    reviewDecisionRate: rankedCount ? reviewCount / rankedCount : null,
    settings: {
      campaignWorkflow: settings.campaignWorkflow,
      profileVersion: settings.profileVersion,
      resultWriteMode: settings.resultWriteMode,
      shadowMode: settings.shadowMode,
    },
    totalV2Runs: runs?.length ?? 0,
  };
}
