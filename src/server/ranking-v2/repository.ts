import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

const contextSchema = z.object({
  campaignId: z.string().uuid(),
  campaignRunId: z.string().uuid(),
  strategyVersionId: z.string().uuid(),
  qualificationBatchId: z.string().uuid(),
  minimumRecommendedConfidence: z.number().min(0).max(100),
  candidates: z.array(
    z.object({
      campaignCandidateId: z.string().uuid(),
      evaluationVersionId: z.string().uuid(),
      organizationId: z.string().uuid(),
      inputSnapshot: z.record(z.string(), z.unknown()),
      finalSnapshot: z.record(z.string(), z.unknown()),
    }),
  ),
});

const resultSchema = z.object({
  rankSnapshotId: z.string().uuid(),
  candidateCount: z.number().int().nonnegative(),
  anomalyCount: z.number().int().nonnegative(),
  blockingAnomalyCount: z.number().int().nonnegative(),
  comparativeBatchIds: z.array(z.string().uuid()),
});

type GenericRpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function client() {
  return createServiceRoleClient() as unknown as GenericRpcClient;
}

export async function loadRankingContext(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const { data, error } = await client().rpc("load_campaign_ranking_inputs_v2", {
    target_campaign_run_id: input.campaignRunId,
    target_workspace_id: input.workspaceId,
  });
  if (error) throw new Error(`Could not load Ranking V2 inputs: ${error.message}`);
  return contextSchema.parse(data);
}

export async function persistRankingResult(input: {
  workspaceId: string;
  campaignRunId: string;
  qualificationBatchId: string;
  contractVersion: string;
  orderingPolicyVersion: string;
  inputHash: string;
  batches: Json;
  anomalies: Json;
  entries: Json;
}) {
  const { data, error } = await client().rpc("persist_campaign_ranking_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_qualification_batch_id: input.qualificationBatchId,
    target_contract_version: input.contractVersion,
    target_ordering_policy_version: input.orderingPolicyVersion,
    target_input_hash: input.inputHash,
    target_batches: input.batches,
    target_anomalies: input.anomalies,
    target_entries: input.entries,
  });
  if (error) throw new Error(`Could not persist Ranking V2: ${error.message}`);
  return resultSchema.parse(data);
}
