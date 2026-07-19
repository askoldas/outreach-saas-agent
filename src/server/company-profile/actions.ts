"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { saveCompanyProfileVersion } from "./repository";
import { getCurrentCompanyProfile } from "./repository";
import { enqueueCompanyProfileAnalysisRun } from "@/server/research/repository";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { recordUsageEvent } from "@/server/outreach/repository";

export async function saveCompanyProfileAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const companyName = text(formData, "companyName");
  if (companyName.length < 1) redirect("/company-profile?error=company-name-required");
  await saveCompanyProfileVersion(currentWorkspace.id, {
    id: null,
    version: 0,
    companyName,
    website: text(formData, "website") || null,
    summary: text(formData, "summary"),
    productsAndServices: list(formData, "productsAndServices"),
    capabilities: list(formData, "capabilities"),
    customerTypes: list(formData, "customerTypes"),
    differentiators: list(formData, "differentiators"),
    proofPoints: list(formData, "proofPoints"),
    marketsAndLanguages: list(formData, "marketsAndLanguages"),
    claims: list(formData, "claims"),
    limitations: list(formData, "limitations"),
    sources: list(formData, "sources"),
    warnings: list(formData, "warnings"),
    lastAnalyzed: null,
    provenance: "manual",
  });
  revalidatePath("/company-profile");
  revalidatePath("/campaigns/new");
  redirect("/company-profile?message=profile-version-saved");
}

export async function analyzeCompanyProfileAction() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!profile?.id || !profile.website)
    redirect("/company-profile?error=website-required");
  const { runId } = await enqueueCompanyProfileAnalysisRun({
    workspaceId: currentWorkspace.id,
    profileVersionId: profile.id,
    website: profile.website,
  });
  const { user } = await createAuthenticatedDatabaseClient();
  await recordUsageEvent(currentWorkspace.id, user.id, {
    operation: "company_research",
    estimated: 5,
    actual: 0,
    referenceId: runId,
  });
  revalidatePath("/company-profile");
  revalidatePath("/usage");
  redirect(`/company-profile?message=analysis-queued&run=${runId}`);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function list(formData: FormData, key: string) {
  return text(formData, key)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
