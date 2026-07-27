"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { createAndDispatchCompanyIntelligenceV3Draft } from "./repository";
import type { Json } from "@/types/database.types";

export async function createCompanyProfileV3DraftAction() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  try {
    await createAndDispatchCompanyIntelligenceV3Draft(currentWorkspace.id);
  } catch (error) {
    const code =
      error instanceof Error && error.message.includes("structured Company Profile")
        ? "structured-profile-required"
        : "v3-draft-create-failed";
    redirect(`/company-profile?error=${code}`);
  }
  revalidatePath("/company-profile");
  redirect("/company-profile?message=v3-analysis-started");
}

export async function answerCompanyProfileV3QuestionAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const questionId = text(formData, "questionId");
  const answer = formData.getAll("answer").map(String).filter(Boolean);
  if (!questionId || answer.length === 0)
    redirect("/company-profile?error=question-answer-required");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("profile_clarification_questions")
    .update({
      answer_json: answer.length === 1 ? answer[0] : answer,
      status: "answered",
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", currentWorkspace.id)
    .eq("id", questionId)
    .eq("status", "pending");
  if (error) throw new Error(`Could not answer profile clarification: ${error.message}`);
  revalidatePath("/company-profile");
  redirect("/company-profile?message=v3-question-answered");
}

export async function skipCompanyProfileV3QuestionAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const questionId = text(formData, "questionId");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("profile_clarification_questions")
    .update({ status: "skipped", updated_at: new Date().toISOString() })
    .eq("workspace_id", currentWorkspace.id)
    .eq("id", questionId)
    .eq("skip_allowed", true)
    .eq("status", "pending");
  if (error) throw new Error(`Could not skip profile clarification: ${error.message}`);
  revalidatePath("/company-profile");
  redirect("/company-profile?message=v3-question-skipped");
}

export async function reviewCompanyProfileV3OfferingAction(formData: FormData) {
  const context = await reviewContext(formData);
  const intent = text(formData, "intent");
  const status = intent === "activate" ? "active" : "inactive";
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("company_offering_versions")
    .update({ status })
    .eq("workspace_id", context.workspaceId)
    .eq("profile_draft_id", context.draftId)
    .eq("id", text(formData, "entityId"));
  if (error) throw new Error(`Could not review V3 offering: ${error.message}`);
  await recordDecision(context, "offering_reviewed", {
    entityId: text(formData, "entityId"),
    status,
  });
  revalidatePath("/company-profile");
}

export async function reviewCompanyProfileV3ArchetypeAction(formData: FormData) {
  const context = await reviewContext(formData);
  const intent = text(formData, "intent");
  const status = intent === "confirm" ? "user_confirmed" : "user_rejected";
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("buyer_archetype_hypotheses")
    .update({ status })
    .eq("workspace_id", context.workspaceId)
    .eq("profile_draft_id", context.draftId)
    .eq("id", text(formData, "entityId"));
  if (error) throw new Error(`Could not review buyer archetype: ${error.message}`);
  await recordDecision(context, "archetype_reviewed", {
    entityId: text(formData, "entityId"),
    status,
  });
  revalidatePath("/company-profile");
}

export async function reviewCompanyProfileV3RuleAction(formData: FormData) {
  const context = await reviewContext(formData);
  const intent = text(formData, "intent");
  const status = intent === "confirm" ? "confirmed" : "rejected";
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("commercial_rules")
    .update({ status })
    .eq("workspace_id", context.workspaceId)
    .eq("profile_draft_id", context.draftId)
    .eq("id", text(formData, "entityId"));
  if (error) throw new Error(`Could not review commercial rule: ${error.message}`);
  await recordDecision(context, "rule_reviewed", {
    entityId: text(formData, "entityId"),
    status,
  });
  revalidatePath("/company-profile");
}

export async function publishCompanyProfileV3Action(formData: FormData) {
  const context = await reviewContext(formData);
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase.rpc("publish_company_profile_v3_draft", {
    target_workspace_id: context.workspaceId,
    target_profile_draft_id: context.draftId,
  });
  if (error) {
    const code = error.message.includes("Blocking clarification")
      ? "v3-blocking-questions"
      : "v3-publish-failed";
    redirect(`/company-profile?error=${code}`);
  }
  revalidatePath("/company-profile");
  revalidatePath("/campaigns/new");
  redirect("/company-profile?message=v3-profile-published");
}

export async function updateCompanyProfileV3CoreAction(formData: FormData) {
  const context = await reviewContext(formData);
  const { supabase } = await createAuthenticatedDatabaseClient();
  const updateRpc = supabase.rpc as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  const { error } = await updateRpc("update_company_profile_v3_core", {
    target_workspace_id: context.workspaceId,
    target_profile_draft_id: context.draftId,
    target_public_name: text(formData, "publicName"),
    target_canonical_domain: text(formData, "canonicalDomain"),
    target_commercial_summary: text(formData, "commercialSummary"),
    target_primary_role: text(formData, "primaryRole"),
    target_revenue_model: text(formData, "revenueModel"),
    target_transaction_model: text(formData, "transactionModel"),
    target_customer_usage_mode: text(formData, "customerUsageMode"),
  });
  if (error) redirect("/company-profile?error=v3-core-update-failed");
  revalidatePath("/company-profile");
  redirect("/company-profile?message=v3-core-updated");
}

async function reviewContext(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const draftId = text(formData, "draftId");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("company_profile_drafts")
    .select("state")
    .eq("workspace_id", currentWorkspace.id)
    .eq("id", draftId)
    .single();
  if (error || !["needs_input", "ready_for_review"].includes(data.state)) {
    redirect("/company-profile?error=v3-draft-not-reviewable");
  }
  return { workspaceId: currentWorkspace.id, draftId };
}

async function recordDecision(
  context: { workspaceId: string; draftId: string },
  eventType: string,
  details: Json,
) {
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase.from("profile_change_events").insert({
    workspace_id: context.workspaceId,
    profile_draft_id: context.draftId,
    event_type: eventType,
    actor_type: "user",
    actor_user_id: user.id,
    affected_paths: [],
    details_json: details,
  });
  if (error) throw new Error(`Could not record profile review: ${error.message}`);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
