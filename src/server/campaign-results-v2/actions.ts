"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";

const decisions = new Set([
  "approved",
  "conditional",
  "research_requested",
  "rejected",
  "excluded",
]);
const correctionTypes = new Set([
  "relationship",
  "archetype",
  "entity",
  "evidence",
  "procurement",
  "location",
  "duplicate_state",
]);

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function reviewV2CandidateAction(input: {
  campaignCandidateId: string;
  campaignExternalId: string;
  campaignRunId: string;
  condition?: string;
  decision: string;
  evaluationVersionId: string;
  reason?: string;
}) {
  if (!decisions.has(input.decision)) throw new Error("Unsupported review decision.");
  if (input.decision === "conditional" && !input.condition?.trim()) {
    throw new Error("Describe the condition before saving a conditional decision.");
  }
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await (supabase as unknown as RpcClient).rpc(
    "record_candidate_review_decision_v2",
    {
      target_campaign_candidate_id: input.campaignCandidateId,
      target_campaign_run_id: input.campaignRunId,
      target_condition_text: input.condition?.trim() || null,
      target_decision: input.decision,
      target_evaluation_version_id: input.evaluationVersionId,
      target_reason: input.reason?.trim() ?? "",
      target_workspace_id: currentWorkspace.id,
    },
  );
  if (error) throw new Error(`Could not save candidate review: ${error.message}`);
  revalidatePath(`/campaigns/${input.campaignExternalId}/leads`);
  return { message: "Campaign review decision saved." };
}

export async function proposeV2CandidateCorrectionAction(input: {
  campaignCandidateId: string;
  campaignExternalId: string;
  campaignRunId: string;
  correctionType: string;
  evaluationVersionId: string;
  proposedValue: string;
  reason: string;
  scope?: string;
}) {
  if (!correctionTypes.has(input.correctionType))
    throw new Error("Unsupported correction type.");
  if (!input.proposedValue.trim() || !input.reason.trim()) {
    throw new Error("A corrected value and reason are required.");
  }
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await (supabase as unknown as RpcClient).rpc(
    "propose_candidate_correction_v2",
    {
      target_campaign_candidate_id: input.campaignCandidateId,
      target_campaign_run_id: input.campaignRunId,
      target_correction_type: input.correctionType,
      target_evaluation_version_id: input.evaluationVersionId,
      target_proposed_value_json: { value: input.proposedValue.trim() },
      target_reason: input.reason.trim(),
      target_scope: input.scope ?? "campaign",
      target_workspace_id: currentWorkspace.id,
    },
  );
  if (error) throw new Error(`Could not propose candidate correction: ${error.message}`);
  revalidatePath(`/campaigns/${input.campaignExternalId}/leads`);
  return { message: "Correction recorded for review and re-evaluation." };
}
