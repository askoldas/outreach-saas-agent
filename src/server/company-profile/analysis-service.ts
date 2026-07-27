import { createHash } from "node:crypto";
import {
  analyzeCompanyProfile,
  companyProfileAnalysisPromptVersion,
} from "@/lib/ai/company-profile-analysis";
import { extractWebPages, searchWeb } from "@/lib/providers/tavily";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function executeCompanyProfileAnalysis(providerExecutionId: string) {
  const supabase = createServiceRoleClient();
  const { data: execution, error: executionError } = await supabase
    .from("provider_executions")
    .select("id,workspace_id,idempotency_key,metadata")
    .eq("id", providerExecutionId)
    .eq("operation", "company_profile_analysis")
    .single();
  if (executionError)
    throw new Error(
      `Could not load profile analysis execution: ${executionError.message}`,
    );

  const profileVersionId = stringValue(execution.metadata, "profileVersionId");
  if (!profileVersionId)
    throw new Error("Profile analysis execution is missing profileVersionId.");

  const { data: profile, error: profileError } = await supabase
    .from("company_profile_versions")
    .select("id,workspace_id,website_url,structured_profile")
    .eq("workspace_id", execution.workspace_id)
    .eq("id", profileVersionId)
    .single();
  if (profileError)
    throw new Error(`Could not load frozen Company Profile: ${profileError.message}`);
  if (!profile.website_url) throw new Error("Company Profile website is missing.");

  const startedAt = new Date().toISOString();
  await updateExecution(providerExecutionId, {
    status: "running",
    started_at: startedAt,
    completed_at: null,
    error_code: null,
    error_message: null,
  });

  const origin = new URL(profile.website_url).origin;
  const host = new URL(origin).hostname.replace(/^www\./, "");
  let sources: Array<{ title: string; url: string; content: string }> = [];

  try {
    let results = await searchWeb(
      `${host} company products services capabilities customers markets about`,
      8,
      { includeDomains: [host], includeRawContent: true },
    );
    if (!results.some((item) => item.content.trim())) {
      results = await extractWebPages([profile.website_url]);
    }
    sources = results
      .filter((item) => item.content.trim())
      .slice(0, 6)
      .map((item) => ({
        title: item.title,
        url: item.url,
        content: item.content.trim().slice(0, 12_000),
      }));
    if (sources.length === 0)
      throw new Error(
        "Website analysis could not extract readable public content from this website.",
      );

    const generated = await analyzeCompanyProfile({
      currentProfile: asRecord(profile.structured_profile),
      sources,
    });
    const { data: saved, error: saveError } = await supabase.rpc(
      "save_clean_company_profile_version",
      {
        target_workspace_id: execution.workspace_id,
        profile_data: generated.analysis.profile,
        facts_data: generated.analysis.facts,
        questions_data: generated.analysis.reviewQuestions,
        provenance_value: "website_analysis",
      },
    );
    if (saveError)
      throw new Error(`Could not save analyzed Company Profile: ${saveError.message}`);

    const completedAt = new Date().toISOString();
    const requestHash = hash({
      profileVersionId,
      sourceUrls: sources.map((source) => source.url),
      promptVersion: companyProfileAnalysisPromptVersion,
    });
    const { error: requestError } = await supabase.from("ai_requests").insert({
      workspace_id: execution.workspace_id,
      provider_execution_id: execution.id,
      role: "profile_analysis",
      provider: "openrouter",
      selected_model: generated.modelCall.requestedModel,
      fallback_model: generated.modelCall.fallbackUsed
        ? generated.modelCall.actualModel
        : null,
      fallback_used: generated.modelCall.fallbackUsed,
      prompt_version: companyProfileAnalysisPromptVersion,
      schema_version: "company-profile-v2",
      request_hash: requestHash,
      status: "completed",
      input_units: generated.modelCall.inputTokens,
      output_units: generated.modelCall.outputTokens,
      actual_cost: generated.modelCall.providerReportedCost ?? 0,
      currency: generated.modelCall.providerCurrency ?? "USD",
      metadata: {
        actualModel: generated.modelCall.actualModel,
        fallbackReason: generated.modelCall.fallbackReason,
        inputProfileVersionId: profileVersionId,
        latencyMs: generated.modelCall.latencyMs,
        outputProfileVersionId: saved,
        providerRequestId: generated.modelCall.providerRequestId,
        sourceCount: sources.length,
        totalTokens: generated.modelCall.totalTokens,
      },
      started_at: startedAt,
      completed_at: completedAt,
    });
    if (requestError)
      throw new Error(`Could not log profile analysis: ${requestError.message}`);

    const { error: usageError } = await supabase.from("usage_ledger").upsert(
      {
        workspace_id: execution.workspace_id,
        provider_execution_id: execution.id,
        operation: "company_profile_analysis",
        entry_type: "settlement",
        idempotency_key: execution.idempotency_key,
        credits: 5,
        metadata: { profileVersionId: saved, sourceCount: sources.length },
      },
      { onConflict: "workspace_id,entry_type,idempotency_key" },
    );
    if (usageError)
      throw new Error(`Could not record profile analysis usage: ${usageError.message}`);

    await updateExecution(providerExecutionId, {
      status: "completed",
      completed_at: completedAt,
      provider_reference: generated.modelCall.providerRequestId,
      input_units: generated.modelCall.inputTokens,
      output_units: generated.modelCall.outputTokens,
      actual_cost: generated.modelCall.providerReportedCost ?? 0,
      provider_cost: generated.modelCall.providerReportedCost,
      provider_currency: generated.modelCall.providerCurrency,
      metadata: {
        ...asRecord(execution.metadata),
        outputProfileVersionId: saved,
        sourceCount: sources.length,
      },
    });

    return {
      profileVersionId: saved as string,
      providerExecutionId,
      sourceCount: sources.length,
    };
  } catch (error) {
    throw error;
  }
}

async function updateExecution(id: string, values: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("provider_executions")
    .update(values)
    .eq("id", id);
  if (error) throw new Error(`Could not update profile analysis: ${error.message}`);
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, key: string) {
  const record = asRecord(value);
  return typeof record[key] === "string" ? record[key] : "";
}
