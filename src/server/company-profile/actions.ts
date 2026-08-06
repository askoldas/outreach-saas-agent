"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createAndDispatchCompanyIntelligenceV3Draft } from "@/server/company-profile-v3/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function updateCompanyWebsiteAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const website = normalizeWebsite(text(formData, "website"));
  if (!website) redirect("/company-profile?error=invalid-website-url");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ website_url: website })
    .eq("id", currentWorkspace.id);
  if (error) throw new Error(`Could not update the company website: ${error.message}`);
  revalidatePath("/company-profile");
  redirect("/company-profile?message=company-website-updated");
}

export async function analyzeCompanyProfileAction() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  if (!currentWorkspace.websiteUrl) redirect("/company-profile?error=website-required");
  await createAndDispatchCompanyIntelligenceV3Draft(currentWorkspace.id);
  revalidatePath("/company-profile");
  revalidatePath("/usage");
  redirect("/company-profile?message=v3-analysis-started");
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWebsite(value: string) {
  if (!value) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname || !["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
