"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { createAndDispatchCompanyIntelligenceV3Draft } from "./repository";

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

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
