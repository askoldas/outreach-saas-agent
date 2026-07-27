"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { saveCampaignStrategyVersion } from "./repository";
import { getCurrentCampaignStrategy } from "./repository";
import { getCampaign } from "@/server/campaigns/repository";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  generateCampaignStrategy,
  strategyGenerationPromptVersion,
} from "@/lib/ai/strategy-generation";

export async function saveCampaignStrategyAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const campaignId = text(formData, "campaignId");
  if (!campaignId) throw new Error("Campaign id is required");
  const campaign = await getCampaign(currentWorkspace.id, campaignId);
  if (!campaign) throw new Error("Campaign not found.");
  assertRevisionAllowed(campaign.status);
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
  assertRevisionAllowed(campaign.status);
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
    .select("snapshot_data")
    .eq("workspace_id", currentWorkspace.id)
    .eq("campaign_id", (campaignRow as { id: string }).id)
    .single();
  if (snapshotError)
    throw new Error(`Could not load frozen Company Profile: ${snapshotError.message}`);
  const generated = await generateCampaignStrategy({
    campaign: campaign as unknown as Record<string, unknown>,
    companyProfile: (snapshot as { snapshot_data: Record<string, unknown> })
      .snapshot_data,
    currentStrategy,
    instruction,
  });
  const saved = await saveCampaignStrategyVersion(currentWorkspace.id, input.campaignId, {
    ...generated.strategy,
    refinementSummary: [...generated.strategy.refinementSummary, instruction],
  });
  const requestHash = `strategy:${input.campaignId}:${saved.version}`;
  const operational = createServiceRoleClient();
  const { error: logError } = await operational.from("ai_requests").insert({
    workspace_id: currentWorkspace.id,
    provider: "openrouter",
    role: "campaign_planning",
    selected_model: generated.modelCall.requestedModel,
    fallback_model: generated.modelCall.fallbackUsed
      ? generated.modelCall.actualModel
      : null,
    fallback_used: generated.modelCall.fallbackUsed,
    prompt_version: strategyGenerationPromptVersion,
    status: "completed",
    request_hash: requestHash,
    input_units: generated.modelCall.inputTokens,
    output_units: generated.modelCall.outputTokens,
    actual_cost: generated.modelCall.providerReportedCost ?? 0,
    currency: generated.modelCall.providerCurrency ?? "USD",
    metadata: {
      actualModel: generated.modelCall.actualModel,
      fallbackReason: generated.modelCall.fallbackReason,
      latencyMs: generated.modelCall.latencyMs,
      providerRequestId: generated.modelCall.providerRequestId,
      savedStrategyVersionId: saved.id,
      instruction,
      totalTokens: generated.modelCall.totalTokens,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
  if (logError) throw new Error(`Could not log Strategy generation: ${logError.message}`);
  const { error: usageError } = await operational.from("usage_ledger").insert({
    workspace_id: currentWorkspace.id,
    operation: "strategy_generation",
    entry_type: "settlement",
    idempotency_key: requestHash,
    credits: 0,
    metadata: { createdBy: user.id, strategyVersionId: saved.id },
  });
  if (usageError)
    throw new Error(`Could not record Strategy usage: ${usageError.message}`);
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

function assertRevisionAllowed(status: string) {
  if (status === "running") {
    throw new Error("Pause the active campaign run before adjusting its market.");
  }
}
