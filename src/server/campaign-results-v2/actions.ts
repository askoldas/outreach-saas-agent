"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { dispatchCampaignV2Continuation } from "@/server/trigger/dispatch";
import { DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET } from "@/lib/research-budget-v2/contracts";
import { reserveCampaignResearchContinuation } from "@/server/workflow-v2/repository";
import { commercialRelationshipTypeSchema } from "@/lib/intelligence/core/commercial-intelligence";

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

export async function continueV2CampaignResearchAction(input: {
  campaignExternalId: string;
  campaignRunId: string;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", currentWorkspace.id)
    .eq("external_id", input.campaignExternalId)
    .maybeSingle();
  if (campaignError || !campaign) throw new Error("Campaign not found.");
  const { data: run, error: runError } = await supabase
    .from("campaign_runs")
    .select("id")
    .eq("workspace_id", currentWorkspace.id)
    .eq("campaign_id", campaign.id)
    .eq("id", input.campaignRunId)
    .eq("workflow_version", "v2")
    .maybeSingle();
  if (runError || !run) throw new Error("V2 Campaign Run not found.");
  const { data: workflow, error: workflowError } = await supabase
    .from("campaign_workflow_runs_v2")
    .select("status")
    .eq("workspace_id", currentWorkspace.id)
    .eq("campaign_run_id", run.id)
    .maybeSingle();
  if (workflowError || workflow?.status !== "ready_for_review") {
    throw new Error(
      "Research can continue only when the current cycle is ready for review.",
    );
  }
  const reservation = await reserveCampaignResearchContinuation({
    campaignRunId: run.id,
    workspaceId: currentWorkspace.id,
    budget: DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET,
  });
  await dispatchCampaignV2Continuation({
    campaignRunId: run.id,
    cycleNumber: reservation.cycleNumber,
    requestedAction: reservation.requestedAction,
    workspaceId: currentWorkspace.id,
  });
  revalidatePath(`/campaigns/${input.campaignExternalId}`);
  revalidatePath(`/campaigns/${input.campaignExternalId}/leads`);
  return {
    message: `Research cycle ${reservation.cycleNumber} queued.`,
    nextCycleNumber: reservation.cycleNumber,
  };
}

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
  relationshipDimension?: string;
  reason: string;
  scope?: string;
  sourceRelationshipAssessmentVersionId?: string | null;
}) {
  if (!correctionTypes.has(input.correctionType))
    throw new Error("Unsupported correction type.");
  if (!input.proposedValue.trim() || !input.reason.trim()) {
    throw new Error("A corrected value and reason are required.");
  }
  const relationshipDimension = input.relationshipDimension?.trim() || null;
  const sourceRelationshipAssessmentVersionId =
    input.sourceRelationshipAssessmentVersionId ?? null;
  if (
    input.correctionType === "relationship" &&
    (!relationshipDimension ||
      !commercialRelationshipTypeSchema.safeParse(relationshipDimension).success ||
      !sourceRelationshipAssessmentVersionId)
  ) {
    throw new Error(
      "Relationship corrections require a persisted dimension and source assessment.",
    );
  }
  if (
    input.correctionType !== "relationship" &&
    (relationshipDimension || sourceRelationshipAssessmentVersionId)
  ) {
    throw new Error("Only relationship corrections may target a relationship dimension.");
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
      target_proposed_value_json: {
        relationshipDimension,
        value: input.proposedValue.trim(),
      },
      target_reason: input.reason.trim(),
      target_relationship_dimension: relationshipDimension,
      target_scope: input.scope ?? "campaign",
      target_source_relationship_assessment_version_id:
        sourceRelationshipAssessmentVersionId,
      target_workspace_id: currentWorkspace.id,
    },
  );
  if (error) throw new Error(`Could not propose candidate correction: ${error.message}`);
  revalidatePath(`/campaigns/${input.campaignExternalId}/leads`);
  return { message: "Correction recorded for review and re-evaluation." };
}
