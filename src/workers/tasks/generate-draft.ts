import type { SupabaseClient } from "@supabase/supabase-js";
import {
  draftPromptVersion,
  generateGroundedDraft,
  type DraftGenerationInput,
} from "../../lib/ai/draft-generation.ts";
import { requireOpenRouterConfig } from "../../lib/providers/config.ts";
import type { ResearchTaskRow } from "../lib/claim-task.ts";
import { updateRunStep } from "../lib/task-status.ts";

type DraftPayload = {
  companyProfileVersionId: string;
  leadDatabaseId: string;
  leadExternalId: string;
  selectedContactRouteId: string;
  strategyVersionId: string;
};

export async function processGenerateDraftTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Generating grounded draft", 50);
  const payload = parsePayload(task);
  const input = await loadGroundedInput(supabase, task, payload);
  const model = requireOpenRouterConfig().model;

  try {
    const result = await generateGroundedDraft(input.context);
    const draftId = `draft-${payload.leadExternalId}-primary`.slice(0, 120);
    const { error: generationError } = await supabase.from("ai_generations").insert({
      workspace_id: task.workspace_id,
      run_id: task.run_id,
      task_id: task.id,
      campaign_id: task.campaign_id,
      lead_external_id: payload.leadExternalId,
      provider: "openrouter",
      model,
      task_name: "generate_draft",
      prompt_version: draftPromptVersion,
      prompt_json: input.context,
      output_text: result.rawOutput,
      output_json: result.draft,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    if (generationError)
      throw new Error(`Could not log draft generation: ${generationError.message}`);

    const { error: draftError } = await supabase.from("outreach_drafts").upsert(
      {
        workspace_id: task.workspace_id,
        external_id: draftId,
        lead_external_id: payload.leadExternalId,
        campaign_external_id: task.campaign_id,
        recipient_route: input.context.recipient.route,
        subject: result.draft.subject,
        body: result.draft.body,
        variant: "primary",
        language: input.context.campaign.language,
        status: "needs_review",
        last_edited_label: "Generated just now",
        seller_claims: result.draft.sellerClaims,
        evidence_used: result.draft.evidenceUsed,
        warnings: result.draft.warnings,
        company_profile_version_id: input.profileVersionId,
        strategy_version_id: input.strategyVersionId,
        generation_task_id: task.id,
        prompt_version: draftPromptVersion,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,campaign_external_id,lead_external_id,variant" },
    );
    if (draftError)
      throw new Error(`Could not save generated draft: ${draftError.message}`);

    await supabase
      .from("leads")
      .update({ status: "draft_ready" })
      .eq("id", payload.leadDatabaseId);
    const { error: usageError } = await supabase.from("usage_events").insert({
      workspace_id: task.workspace_id,
      campaign_external_id: task.campaign_id,
      operation: "draft_generation",
      estimated_credits: 0,
      actual_credits: 2,
      reference_type: "research_task",
      reference_id: task.id,
    });
    if (usageError)
      throw new Error(`Could not record draft usage: ${usageError.message}`);
    return { draftId, leadId: payload.leadExternalId };
  } catch (error) {
    await supabase.from("ai_generations").insert({
      workspace_id: task.workspace_id,
      run_id: task.run_id,
      task_id: task.id,
      campaign_id: task.campaign_id,
      lead_external_id: payload.leadExternalId,
      provider: "openrouter",
      model,
      task_name: "generate_draft",
      prompt_version: draftPromptVersion,
      prompt_json: input.context,
      status: "failed",
      error_message: error instanceof Error ? error.message : "Draft generation failed",
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

async function loadGroundedInput(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  payload: DraftPayload,
) {
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id,name,objective,language,company_profile_version_id,current_strategy_version_id",
    )
    .eq("workspace_id", task.workspace_id)
    .eq("external_id", task.campaign_id)
    .single();
  if (campaignError)
    throw new Error(`Could not load draft campaign: ${campaignError.message}`);
  const campaignRow = campaign as {
    id: string;
    name: string;
    objective: string;
    language: string;
  };

  const [
    { data: snapshot, error: snapshotError },
    { data: strategy, error: strategyError },
    { data: lead, error: leadError },
    { data: route, error: routeError },
  ] = await Promise.all([
    supabase
      .from("campaign_profile_snapshots")
      .select("snapshot")
      .eq("campaign_id", campaignRow.id)
      .eq("company_profile_version_id", payload.companyProfileVersionId)
      .single(),
    supabase
      .from("campaign_strategy_versions")
      .select("*")
      .eq("id", payload.strategyVersionId)
      .eq("workspace_id", task.workspace_id)
      .single(),
    supabase
      .from("leads")
      .select("company,website,summary,lead_evidence_claims(text,source_url)")
      .eq("id", payload.leadDatabaseId)
      .eq("workspace_id", task.workspace_id)
      .single(),
    supabase
      .from("lead_contact_routes")
      .select("value,suggested_role,verification")
      .eq("id", payload.selectedContactRouteId)
      .eq("lead_id", payload.leadDatabaseId)
      .single(),
  ]);
  if (snapshotError)
    throw new Error(`Could not load frozen company profile: ${snapshotError.message}`);
  if (strategyError)
    throw new Error(`Could not load campaign strategy: ${strategyError.message}`);
  if (leadError)
    throw new Error(`Could not load draft lead evidence: ${leadError.message}`);
  if (routeError)
    throw new Error(`Could not load selected recipient: ${routeError.message}`);
  const leadRow = lead as {
    company: string;
    website: string;
    summary: string;
    lead_evidence_claims: Array<{ text: string; source_url: string }>;
  };
  const routeRow = route as {
    value: string;
    suggested_role: string;
    verification: string;
  };
  return {
    profileVersionId: payload.companyProfileVersionId,
    strategyVersionId: payload.strategyVersionId,
    context: {
      campaign: {
        name: campaignRow.name,
        objective: campaignRow.objective,
        language: campaignRow.language,
      },
      companyProfile: (snapshot as { snapshot: Record<string, unknown> }).snapshot,
      strategy: strategy as Record<string, unknown>,
      lead: {
        company: leadRow.company,
        website: leadRow.website,
        summary: leadRow.summary,
        evidence: (leadRow.lead_evidence_claims ?? []).map((item) => ({
          text: item.text,
          sourceUrl: item.source_url,
        })),
      },
      recipient: {
        route: routeRow.value,
        role: routeRow.suggested_role,
        verification: routeRow.verification,
      },
    } satisfies DraftGenerationInput,
  };
}

function parsePayload(task: ResearchTaskRow): DraftPayload {
  const value = task.payload_json;
  if (
    typeof value.leadDatabaseId !== "string" ||
    typeof value.leadExternalId !== "string" ||
    typeof value.selectedContactRouteId !== "string" ||
    typeof value.companyProfileVersionId !== "string" ||
    typeof value.strategyVersionId !== "string"
  )
    throw new Error("generate_draft task missing selected lead recipient payload.");
  return value as DraftPayload;
}
