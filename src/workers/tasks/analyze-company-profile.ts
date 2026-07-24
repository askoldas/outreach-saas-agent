import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeCompanyProfile,
  companyProfileAnalysisPromptVersion,
} from "../../lib/ai/company-profile-analysis.ts";
import { requireOpenRouterConfig } from "../../lib/providers/config.ts";
import { extractWebPages, searchWeb } from "../../lib/providers/tavily.ts";
import type { ResearchTaskRow } from "../lib/claim-task.ts";
import { updateRunStep } from "../lib/task-status.ts";

export async function processAnalyzeCompanyProfileTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Discovering company website evidence", 20);
  const profileVersionId = task.payload_json.profileVersionId;
  const website = task.payload_json.website;
  if (typeof profileVersionId !== "string" || typeof website !== "string")
    throw new Error("Company Profile analysis task is missing its frozen profile input.");
  const { data, error } = await supabase
    .from("company_profile_versions")
    .select("*")
    .eq("workspace_id", task.workspace_id)
    .eq("id", profileVersionId)
    .single();
  if (error)
    throw new Error(`Could not load frozen Company Profile input: ${error.message}`);
  const origin = new URL(website).origin;
  const host = new URL(origin).hostname.replace(/^www\./, "");
  let results = await searchWeb(
    `${host} company products services capabilities customers markets about`,
    8,
    { includeDomains: [host], includeRawContent: true },
  );
  if (!results.some((item) => item.content.trim())) {
    results = await extractWebPages([website]);
  }
  const sources = results
    .filter((item) => item.content.trim())
    .slice(0, 6)
    .map((item) => ({
      title: item.title,
      url: item.url,
      content: item.content.trim().slice(0, 12_000),
    }));
  if (sources.length === 0)
    throw new Error(
      "Website analysis could not extract readable public content from this website. Check that the URL is public and not blocked by robots, authentication, or anti-bot protection.",
    );
  await updateRunStep(supabase, task.run_id, "Extracting Company Profile", 65);
  const model = requireOpenRouterConfig().model;
  try {
    const generated = await analyzeCompanyProfile({
      currentProfile: data as Record<string, unknown>,
      sources,
    });
    const { data: saved, error: saveError } = await supabase.rpc(
      "save_analyzed_company_profile_version_v2",
      {
        target_workspace_id: task.workspace_id,
        target_run_id: task.run_id,
        structured_profile_data: generated.analysis.profile,
        facts_data: generated.analysis.facts,
        questions_data: generated.analysis.reviewQuestions,
        target_prompt_version: companyProfileAnalysisPromptVersion,
      },
    );
    if (saveError)
      throw new Error(`Could not save analyzed Company Profile: ${saveError.message}`);
    const { error: generationError } = await supabase.from("ai_generations").insert({
      workspace_id: task.workspace_id,
      run_id: task.run_id,
      task_id: task.id,
      provider: "openrouter",
      model,
      task_name: "analyze_company_profile",
      prompt_version: companyProfileAnalysisPromptVersion,
      prompt_json: { profileVersionId, website, sources },
      output_text: generated.rawOutput,
      output_json: generated.analysis,
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    if (generationError)
      throw new Error(
        `Could not log Company Profile analysis: ${generationError.message}`,
      );
    const { error: usageError } = await supabase.from("usage_events").insert({
      workspace_id: task.workspace_id,
      operation: "company_research",
      actual_credits: 5,
      reference_type: "research_run",
      reference_id: task.run_id,
    });
    if (usageError)
      throw new Error(
        `Could not record Company Profile analysis usage: ${usageError.message}`,
      );
    return {
      profileVersionId: (saved as { id: string }).id,
      sourceCount: sources.length,
    };
  } catch (analysisError) {
    await supabase.from("ai_generations").insert({
      workspace_id: task.workspace_id,
      run_id: task.run_id,
      task_id: task.id,
      provider: "openrouter",
      model,
      task_name: "analyze_company_profile",
      prompt_version: companyProfileAnalysisPromptVersion,
      prompt_json: { profileVersionId, website, sources },
      status: "failed",
      error_message:
        analysisError instanceof Error
          ? analysisError.message
          : "Company Profile analysis failed",
      completed_at: new Date().toISOString(),
    });
    throw analysisError;
  }
}
