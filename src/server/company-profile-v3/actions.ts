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
    const code = companyIntelligenceStartErrorCode(error);
    redirect(`/company-profile?error=${code}`);
  }
  revalidatePath("/company-profile");
  redirect("/company-profile?message=v3-analysis-started");
}

export async function forceRefreshCompanyProfileV3Action() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  try {
    await createAndDispatchCompanyIntelligenceV3Draft(currentWorkspace.id, { forceRefresh: true });
  } catch (error) {
    redirect(`/company-profile?error=${companyIntelligenceStartErrorCode(error)}`);
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

export async function updateCompanyProfileV3OfferingAction(formData: FormData) {
  const context = await reviewContext(formData);
  const entityId = text(formData, "entityId");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: offering, error: loadError } = await supabase
    .from("company_offering_versions")
    .select("commercial_mechanics_json,buyer_logic_json")
    .eq("workspace_id", context.workspaceId)
    .eq("profile_draft_id", context.draftId)
    .eq("id", entityId)
    .single();
  if (loadError) throw new Error(`Could not load V3 offering: ${loadError.message}`);
  const mechanics = jsonObject(offering.commercial_mechanics_json);
  const buyerLogic = jsonObject(offering.buyer_logic_json);
  const whyBuy = lines(formData, "whyBuy");
  if (!whyBuy.length) {
    throw new Error("An active offering requires at least one usable buyer rationale.");
  }
  const { error } = await supabase
    .from("company_offering_versions")
    .update({
      name: requiredText(formData, "name"),
      offering_type: requiredText(formData, "offeringType"),
      short_description: requiredText(formData, "shortDescription"),
      commercial_mechanics_json: {
        ...mechanics,
        buyingMotion: requiredText(formData, "buyingMotion"),
        customerConsumptionMode: requiredText(formData, "customerConsumptionMode"),
        valueProposition: lines(formData, "valueProposition"),
        customerProblems: lines(formData, "customerProblems"),
        expectedOutcomes: lines(formData, "expectedOutcomes"),
      },
      buyer_logic_json: {
        ...buyerLogic,
        whyBuy,
        requiredConditions: lines(formData, "requiredConditions"),
        preferredConditions: lines(formData, "preferredConditions"),
        likelyTriggers: lines(formData, "likelyTriggers"),
        incompatibleConditions: lines(formData, "incompatibleConditions"),
        likelyDecisionRoles: lines(formData, "likelyDecisionRoles"),
        procurementPattern: text(formData, "procurementPattern") || null,
        positiveEvidenceSignals: lines(formData, "positiveEvidenceSignals"),
        negativeEvidenceSignals: lines(formData, "negativeEvidenceSignals"),
      },
    })
    .eq("workspace_id", context.workspaceId)
    .eq("profile_draft_id", context.draftId)
    .eq("id", entityId);
  if (error) throw new Error(`Could not update V3 offering: ${error.message}`);
  await recordDecision(context, "offering_intelligence_updated", {
    entityId,
    affectedFields: ["boundary", "commercialMechanics", "buyerLogic"],
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
    redirect(`/company-profile?error=${profilePublishErrorCode(error)}`);
  }
  revalidatePath("/company-profile");
  revalidatePath("/campaigns/new");
  redirect("/company-profile?message=v3-profile-published");
}

export async function updateCompanyProfileV3CoreAction(formData: FormData) {
  const context = await reviewContext(formData);
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase.rpc("update_company_profile_v3_core", {
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
  await recordDecision(context, "profile_core_updated", {
    affectedFields: [
      "publicName",
      "canonicalDomain",
      "commercialSummary",
      "primaryRole",
      "revenueModel",
      "transactionModel",
      "customerUsageMode",
    ],
  });
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

function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function lines(formData: FormData, key: string) {
  return Array.from(
    new Set(
      text(formData, key)
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, 40);
}

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function companyIntelligenceStartErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("website")) return "website-required";
  if (message.includes("profile container")) return "v3-profile-container-missing";
  if (message.includes("not enabled")) return "v3-workspace-not-ready";
  if (
    message.includes("digest") ||
    message.includes("schema cache") ||
    message.includes("create_native_company_profile_v3_draft")
  )
    return "v3-database-repair-required";
  if (message.includes("trigger dispatch")) return "v3-trigger-dispatch-failed";
  return "v3-draft-create-failed";
}

function profilePublishErrorCode(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  if (message.includes("consistency audit is invalid"))
    return "v3-publish-stale-audit-gate";
  if (message.includes("active offering")) return "v3-publish-no-active-offering";
  if (message.includes("business model")) return "v3-publish-missing-model";
  if (message.includes("not ready for publication")) return "v3-publish-not-ready";
  if (message.includes("forbidden")) return "v3-publish-forbidden";
  if (
    message.includes("schema cache") ||
    message.includes("publish_company_profile_v3_draft")
  )
    return "v3-publish-database-update-required";
  return "v3-publish-failed";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "";
}
