import { createServiceRoleClient } from "@/lib/supabase/service";
import { aggregateCampaignRunTelemetry } from "./telemetry-aggregate";

export async function getCampaignRunTelemetry(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const [executions, aiRequests, queries, candidates, classifications, qualifications] =
    await Promise.all([
      supabase
        .from("provider_executions")
        .select(
          "id,operation,provider,status,input_units,output_units,actual_cost,provider_cost,provider_currency,error_code,metadata,started_at,completed_at",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("campaign_run_id", input.campaignRunId),
      supabase
        .from("ai_requests")
        .select(
          "provider,selected_model,status,input_units,output_units,actual_cost,currency,metadata,started_at,completed_at",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("campaign_run_id", input.campaignRunId),
      supabase
        .from("discovery_queries")
        .select(
          "id,provider,discovery_iteration:discovery_iterations!inner(campaign_run_id)",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("discovery_iteration.campaign_run_id", input.campaignRunId),
      supabase
        .from("discovery_candidates")
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .eq("campaign_run_id", input.campaignRunId),
      supabase
        .from("candidate_classifications")
        .select("status")
        .eq("workspace_id", input.workspaceId)
        .eq("campaign_run_id", input.campaignRunId),
      supabase
        .from("qualification_results")
        .select("status")
        .eq("workspace_id", input.workspaceId)
        .eq("campaign_run_id", input.campaignRunId),
    ]);
  const failure = [
    executions.error,
    aiRequests.error,
    queries.error,
    candidates.error,
    classifications.error,
    qualifications.error,
  ].find(Boolean);
  if (failure) throw new Error(`Could not load Campaign telemetry: ${failure.message}`);

  return aggregateCampaignRunTelemetry({
    aiRequests: aiRequests.data ?? [],
    candidateStatuses: (classifications.data ?? []).map((row) => row.status),
    providerExecutions: executions.data ?? [],
    qualificationStatuses: (qualifications.data ?? []).map((row) => row.status),
    rawCandidateCount: candidates.data?.length ?? 0,
    searchProviders: (queries.data ?? []).map((row) => row.provider),
  });
}
