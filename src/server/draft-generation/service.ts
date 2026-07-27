import { createHash } from "node:crypto";
import {
  draftPromptVersion,
  generateGroundedDraft,
  type DraftGenerationInput,
} from "@/lib/ai/draft-generation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  loadProviderResult,
  storeProviderResult,
} from "@/server/execution/provider-result-cache";

type GeneratedDraft = Awaited<ReturnType<typeof generateGroundedDraft>>;

export async function executeDraftGeneration(providerExecutionId: string) {
  const supabase = createServiceRoleClient();
  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .select("id,workspace_id,campaign_run_id,idempotency_key,metadata,status")
    .eq("id", providerExecutionId)
    .eq("operation", "draft_generation")
    .single();
  if (executionError)
    throw new Error(`Could not load draft execution: ${executionError.message}`);

  const completedDraftId = optionalMetadata(execution.metadata, "draftId");
  const campaignId = requiredMetadata(execution.metadata, "campaignId");
  const campaignCompanyId = requiredMetadata(execution.metadata, "campaignCompanyId");
  if (execution.status === "completed" && completedDraftId)
    return { draftId: completedDraftId, campaignCompanyId };
  const campaignContactId = requiredMetadata(execution.metadata, "campaignContactId");
  const profileSnapshotId = requiredMetadata(execution.metadata, "profileSnapshotId");
  const strategyVersionId = requiredMetadata(execution.metadata, "strategyVersionId");
  const startedAt = new Date().toISOString();
  await updateExecution(providerExecutionId, {
    status: "running",
    started_at: startedAt,
    error_code: null,
    error_message: null,
  });

  let requestHash = hash({ campaignCompanyId, campaignContactId });
  try {
    const input = await loadDraftInput({
      workspaceId: execution.workspace_id,
      campaignId,
      campaignCompanyId,
      campaignContactId,
      profileSnapshotId,
      strategyVersionId,
    });
    requestHash = hash({
      context: input.context,
      evidenceIds: input.evidenceIds,
      promptVersion: draftPromptVersion,
    });
    let generated = await loadProviderResult<GeneratedDraft>(
      providerExecutionId,
      requestHash,
    );
    if (!generated) {
      generated = await generateGroundedDraft(input.context);
      await storeProviderResult(providerExecutionId, requestHash, generated);
    }
    const completedAt = new Date().toISOString();
    const modelConfigId = await resolveModelConfigId(execution.workspace_id);
    const { data: draft, error: draftError } = await supabase
      .from("outreach_drafts")
      .upsert(
        {
          workspace_id: execution.workspace_id,
          campaign_id: campaignId,
          campaign_run_id: execution.campaign_run_id,
          campaign_company_id: campaignCompanyId,
          campaign_contact_id: campaignContactId,
          profile_snapshot_id: profileSnapshotId,
          strategy_version_id: strategyVersionId,
          subject: generated.draft.subject,
          body: generated.draft.body,
          variant: "primary",
          language: input.context.campaign.preferredOutreachLanguage,
          status: "needs_review",
          seller_claims: generated.draft.sellerClaims,
          evidence_used: input.evidenceIds,
          warnings: generated.draft.warnings,
          prompt_version: draftPromptVersion,
          model_config_id: modelConfigId,
          input_hash: requestHash,
          generated_at: completedAt,
        },
        {
          onConflict: "campaign_company_id,campaign_contact_id,variant,input_hash",
        },
      )
      .select("id")
      .single();
    if (draftError)
      throw new Error(`Could not save generated draft: ${draftError.message}`);

    const { error: requestError } = await supabase.from("ai_requests").upsert(
      {
        workspace_id: execution.workspace_id,
        campaign_run_id: execution.campaign_run_id,
        provider_execution_id: execution.id,
        model_config_id: modelConfigId,
        role: "outreach_generation",
        provider: "openrouter",
        selected_model:
          generated.modelCall.actualModel ?? generated.modelCall.requestedModel,
        fallback_model: generated.modelCall.fallbackUsed
          ? generated.modelCall.actualModel
          : null,
        fallback_used: generated.modelCall.fallbackUsed,
        prompt_version: draftPromptVersion,
        schema_version: "outreach-draft-v1",
        request_hash: requestHash,
        status: "completed",
        input_units: generated.modelCall.inputTokens,
        output_units: generated.modelCall.outputTokens,
        actual_cost: generated.modelCall.providerReportedCost ?? 0,
        currency: generated.modelCall.providerCurrency ?? "USD",
        metadata: {
          campaignCompanyId,
          campaignContactId,
          draftId: draft.id,
          providerRequestId: generated.modelCall.providerRequestId,
        },
        started_at: startedAt,
        completed_at: completedAt,
      },
      {
        ignoreDuplicates: true,
        onConflict: "provider_execution_id,role,request_hash,status",
      },
    );
    if (requestError)
      throw new Error(`Could not log draft generation: ${requestError.message}`);

    const { error: companyError } = await supabase
      .from("campaign_companies")
      .update({ status: "draft_ready" })
      .eq("workspace_id", execution.workspace_id)
      .eq("id", campaignCompanyId);
    if (companyError)
      throw new Error(`Could not update Campaign company: ${companyError.message}`);

    const { error: usageError } = await supabase.from("usage_ledger").upsert(
      {
        workspace_id: execution.workspace_id,
        campaign_run_id: execution.campaign_run_id,
        provider_execution_id: execution.id,
        operation: "draft_generation",
        entry_type: "settlement",
        idempotency_key: execution.idempotency_key,
        credits: 0,
        amount: generated.modelCall.providerReportedCost ?? 0,
        currency: generated.modelCall.providerCurrency ?? "USD",
        metadata: { campaignCompanyId, campaignContactId, draftId: draft.id },
      },
      { onConflict: "workspace_id,entry_type,idempotency_key" },
    );
    if (usageError)
      throw new Error(`Could not record draft usage: ${usageError.message}`);

    await updateExecution(providerExecutionId, {
      status: "completed",
      completed_at: completedAt,
      provider_reference: generated.modelCall.providerRequestId,
      input_units: generated.modelCall.inputTokens,
      output_units: generated.modelCall.outputTokens,
      actual_cost: generated.modelCall.providerReportedCost ?? 0,
      provider_cost: generated.modelCall.providerReportedCost,
      provider_currency: generated.modelCall.providerCurrency,
      metadata: { ...asRecord(execution.metadata), draftId: draft.id },
    });
    if (execution.campaign_run_id)
      await syncCampaignRun(execution.workspace_id, execution.campaign_run_id);
    return { draftId: draft.id, campaignCompanyId };
  } catch (error) {
    throw error;
  }
}

async function syncCampaignRun(workspaceId: string, campaignRunId: string) {
  const supabase = createServiceRoleClient();
  const { count, error: countError } = await supabase
    .from("provider_executions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("campaign_run_id", campaignRunId)
    .eq("operation", "draft_generation")
    .in("status", ["pending", "running"]);
  if (countError)
    throw new Error(`Could not count active draft executions: ${countError.message}`);
  const finished = (count ?? 0) === 0;
  const { error } = await supabase
    .from("campaign_runs")
    .update({
      status: finished ? "completed" : "preparing_outreach",
      current_phase: finished ? "waiting_for_outreach_approval" : "preparing_outreach",
      progress_percentage: finished ? 100 : 98,
      ...(finished ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignRunId);
  if (error) throw new Error(`Could not synchronize Campaign drafts: ${error.message}`);
}

async function loadDraftInput(input: {
  workspaceId: string;
  campaignId: string;
  campaignCompanyId: string;
  campaignContactId: string;
  profileSnapshotId: string;
  strategyVersionId: string;
}) {
  const supabase = createServiceRoleClient();
  const [
    { data: campaign, error: campaignError },
    { data: snapshot, error: snapshotError },
    { data: strategy, error: strategyError },
    { data: association, error: associationError },
    { data: recipient, error: recipientError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("name,objective,preferred_outreach_language")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.campaignId)
      .single(),
    supabase
      .from("campaign_profile_snapshots")
      .select("snapshot_data")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.profileSnapshotId)
      .single(),
    supabase
      .from("campaign_strategy_versions")
      .select("*")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.strategyVersionId)
      .single(),
    supabase
      .from("campaign_companies")
      .select(
        "id,source_summary,company:companies!inner(name,website_url),qualification_results(id,created_at,qualification_evidence(id,statement,source_url))",
      )
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.campaignCompanyId)
      .single(),
    supabase
      .from("campaign_contacts")
      .select(
        "id,role_relevance,contact:contacts(full_name,job_title),contact_method:contact_methods(value,verification_status)",
      )
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_company_id", input.campaignCompanyId)
      .eq("id", input.campaignContactId)
      .eq("selection_status", "selected")
      .single(),
  ]);
  if (campaignError)
    throw new Error(`Could not load draft Campaign: ${campaignError.message}`);
  if (snapshotError)
    throw new Error(`Could not load frozen Company Profile: ${snapshotError.message}`);
  if (strategyError)
    throw new Error(`Could not load frozen Campaign Strategy: ${strategyError.message}`);
  if (associationError)
    throw new Error(`Could not load draft company: ${associationError.message}`);
  if (recipientError)
    throw new Error(`Could not load selected recipient: ${recipientError.message}`);

  const company = association.company as unknown as {
    name: string;
    website_url: string | null;
  };
  const qualifications = (association.qualification_results ?? []) as unknown as Array<{
    created_at: string;
    qualification_evidence: Array<{
      id: string;
      statement: string;
      source_url: string | null;
    }> | null;
  }>;
  const qualification = [...qualifications].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0];
  const evidence = qualification?.qualification_evidence ?? [];
  const contact = recipient.contact as unknown as {
    full_name: string | null;
    job_title: string | null;
  } | null;
  const method = recipient.contact_method as unknown as {
    value: string;
    verification_status: string;
  };
  return {
    evidenceIds: evidence.map((item) => item.id),
    context: {
      campaign: {
        name: campaign.name,
        objective: campaign.objective,
        preferredOutreachLanguage: campaign.preferred_outreach_language,
      },
      companyProfile: asRecord(snapshot.snapshot_data),
      strategy: strategy as Record<string, unknown>,
      lead: {
        company: company.name,
        website: company.website_url ?? "",
        summary: association.source_summary,
        evidence: evidence.map((item) => ({
          text: item.statement,
          sourceUrl: item.source_url ?? "",
        })),
      },
      recipient: {
        route: method.value,
        role:
          recipient.role_relevance ||
          contact?.job_title ||
          contact?.full_name ||
          "Public business contact",
        verification: method.verification_status,
      },
    } satisfies DraftGenerationInput,
  };
}

async function resolveModelConfigId(workspaceId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("ai_model_configs")
    .select("id,workspace_id")
    .eq("role", "outreach_generation")
    .eq("enabled", true)
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("workspace_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();
  if (error) throw new Error(`Could not resolve draft model config: ${error.message}`);
  return data.id;
}

async function updateExecution(id: string, values: Record<string, unknown>) {
  const { error } = await createServiceRoleClient()
    .from("provider_executions")
    .update(values)
    .eq("id", id);
  if (error) throw new Error(`Could not update draft execution: ${error.message}`);
}

function requiredMetadata(value: unknown, key: string) {
  const field = asRecord(value)[key];
  if (typeof field !== "string" || !field)
    throw new Error(`Draft execution is missing ${key}.`);
  return field;
}

function optionalMetadata(value: unknown, key: string) {
  const field = asRecord(value)[key];
  return typeof field === "string" && field ? field : null;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
