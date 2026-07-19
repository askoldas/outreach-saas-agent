"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { saveCampaignStrategyVersion } from "./repository";
import { getCurrentCampaignStrategy } from "./repository";
import { getCampaign } from "@/server/campaigns/repository";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import {
  generateCampaignStrategy,
  strategyGenerationPromptVersion,
} from "@/lib/ai/strategy-generation";
import { requireOpenRouterConfig } from "@/lib/providers/config";
import { recordUsageEvent } from "@/server/outreach/repository";

export async function saveCampaignStrategyAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const campaignId = text(formData, "campaignId");
  if (!campaignId) throw new Error("Campaign id is required");
  await saveCampaignStrategyVersion(currentWorkspace.id, campaignId, {
    id: null,
    version: 0,
    status: "ready",
    targetGeography: text(formData, "targetGeography"),
    companyTypes: list(formData, "companyTypes"),
    industries: list(formData, "industries"),
    characteristics: list(formData, "characteristics"),
    relevanceReasons: list(formData, "relevanceReasons"),
    opportunityAssumptions: list(formData, "opportunityAssumptions"),
    qualificationCriteria: list(formData, "qualificationCriteria"),
    positiveSignals: list(formData, "positiveSignals"),
    exclusions: list(formData, "exclusions"),
    contactRoles: list(formData, "contactRoles"),
    contactDepartments: list(formData, "contactDepartments"),
    acceptableContactRoutes: list(formData, "acceptableContactRoutes"),
    searchLanguages: list(formData, "searchLanguages"),
    sourceCategories: list(formData, "sourceCategories"),
    searchTerms: list(formData, "searchTerms"),
    localizedTerms: list(formData, "localizedTerms"),
    limitations: list(formData, "limitations"),
    targetCompanyCount: positive(formData, "targetCompanyCount", 25),
    refinementSummary: list(formData, "refinementSummary"),
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/strategy`);
  redirect(`/campaigns/${campaignId}/strategy?saved=1`);
}

export async function generateCampaignStrategyAction(input: {
  campaignId: string;
  instruction: string;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const instruction = input.instruction.trim();
  if (instruction.length < 3) throw new Error("Describe the Strategy change you want.");
  const [campaign, currentStrategy] = await Promise.all([
    getCampaign(currentWorkspace.id, input.campaignId),
    getCurrentCampaignStrategy(currentWorkspace.id, input.campaignId),
  ]);
  if (!campaign || !currentStrategy) throw new Error("Campaign Strategy not found.");
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data: campaignRow, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", currentWorkspace.id)
    .eq("external_id", input.campaignId)
    .single();
  if (campaignError)
    throw new Error(`Could not load campaign context: ${campaignError.message}`);
  const { data: snapshot, error: snapshotError } = await supabase
    .from("campaign_profile_snapshots")
    .select("snapshot")
    .eq("workspace_id", currentWorkspace.id)
    .eq("campaign_id", (campaignRow as { id: string }).id)
    .single();
  if (snapshotError)
    throw new Error(`Could not load frozen Company Profile: ${snapshotError.message}`);
  const generated = await generateCampaignStrategy({
    campaign: campaign as unknown as Record<string, unknown>,
    companyProfile: (snapshot as { snapshot: Record<string, unknown> }).snapshot,
    currentStrategy,
    instruction,
  });
  const saved = await saveCampaignStrategyVersion(currentWorkspace.id, input.campaignId, {
    ...generated.strategy,
    refinementSummary: [...generated.strategy.refinementSummary, instruction],
  });
  const model = requireOpenRouterConfig().model;
  const { error: logError } = await supabase.from("ai_generations").insert({
    workspace_id: currentWorkspace.id,
    campaign_id: input.campaignId,
    provider: "openrouter",
    model,
    task_name: "generate_campaign_strategy",
    prompt_version: strategyGenerationPromptVersion,
    prompt_json: {
      campaign,
      companyProfile: (snapshot as { snapshot: unknown }).snapshot,
      currentStrategy,
      instruction,
    },
    output_text: generated.rawOutput,
    output_json: { ...generated.strategy, savedStrategyVersionId: saved.id },
    status: "completed",
    completed_at: new Date().toISOString(),
  });
  if (logError) throw new Error(`Could not log Strategy generation: ${logError.message}`);
  await recordUsageEvent(currentWorkspace.id, user.id, {
    campaignId: input.campaignId,
    operation: "strategy_generation",
    estimated: 3,
    actual: 3,
    referenceId: saved.id ?? `strategy-${saved.version}`,
  });
  revalidatePath(`/campaigns/${input.campaignId}`);
  revalidatePath(`/campaigns/${input.campaignId}/strategy`);
  revalidatePath("/usage");
  return { message: `Created AI Strategy version ${saved.version}.` };
}
function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function list(data: FormData, key: string) {
  return text(data, key)
    .split(/[\n,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function positive(data: FormData, key: string, fallback: number) {
  const value = Number(text(data, key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
