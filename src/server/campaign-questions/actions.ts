"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database.types";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { enqueueCampaignAgentResume } from "@/server/research/repository";

export async function answerCampaignQuestionAction(formData: FormData) {
  const questionId = stringField(formData, "questionId");
  const campaignId = stringField(formData, "campaignId");
  const answer = stringField(formData, "answer");
  if (!questionId || !campaignId || answer.length < 3)
    throw new Error("Provide a short targeting clarification.");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data: question, error: lookupError } = await supabase
    .from("campaign_questions")
    .select("id,campaign_run_id,campaign_runs!inner(campaigns!inner(external_id))")
    .eq("workspace_id", currentWorkspace.id)
    .eq("id", questionId)
    .eq("status", "open")
    .eq("campaign_runs.campaigns.external_id", campaignId)
    .single();
  if (lookupError)
    throw new Error(`Could not load Campaign clarification: ${lookupError.message}`);
  const answeredAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("campaign_questions")
    .update({
      answer: { text: answer } as Json,
      answered_at: answeredAt,
      answered_by: user.id,
      status: "answered",
    })
    .eq("workspace_id", currentWorkspace.id)
    .eq("id", question.id)
    .eq("status", "open");
  if (updateError)
    throw new Error(`Could not save Campaign clarification: ${updateError.message}`);
  try {
    await enqueueCampaignAgentResume({
      campaignRunId: question.campaign_run_id,
      questionId: question.id,
      workspaceId: currentWorkspace.id,
    });
    await supabase
      .from("campaign_runs")
      .update({ status: "queued", current_phase: "discovery_queued" })
      .eq("workspace_id", currentWorkspace.id)
      .eq("id", question.campaign_run_id);
  } catch (error) {
    await supabase
      .from("campaign_questions")
      .update({ answer: null, answered_at: null, answered_by: null, status: "open" })
      .eq("workspace_id", currentWorkspace.id)
      .eq("id", question.id);
    throw error;
  }
  revalidatePath(`/campaigns/${campaignId}/leads`);
}

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
