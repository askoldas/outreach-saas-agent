import { createHash } from "node:crypto";
import { parseCompleteJsonObject } from "@/lib/ai/structured-json";
import { compileProfileV3Draft } from "@/lib/intelligence/company-profile-v3/draft-compiler";
import {
  profileBuyerLogicOutputSchema,
  profileClarificationOutputSchema,
  profileCommercialSynthesisOutputSchema,
  profileConsistencyOutputSchema,
  profileOfferingDecompositionOutputSchema,
  profileV3TaskDefinitions,
} from "@/lib/intelligence/company-profile-v3/task-contracts";
import { resolveProfileV3DraftState } from "@/lib/intelligence/company-profile-v3/workflow";
import { resolveWorkspaceIntelligenceSettings } from "@/lib/intelligence/rollout";
import { generateTextResult } from "@/lib/providers/openrouter";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

export const profileV3StageIds = profileV3TaskDefinitions.map(
  (definition) => definition.taskId,
);
export type ProfileV3StageId = (typeof profileV3StageIds)[number];

export async function executeProfileV3Stage(input: {
  workspaceId: string;
  profileDraftId: string;
  taskId: ProfileV3StageId;
  triggerRunId?: string;
}) {
  await assertProfileV3Enabled(input.workspaceId);
  const definition = profileV3TaskDefinitions.find(
    (candidate) => candidate.taskId === input.taskId,
  );
  if (!definition) throw new Error(`Unknown Company Intelligence stage: ${input.taskId}`);

  const supabase = createServiceRoleClient();
  const [{ data: draft, error: draftError }, { data: previous, error: previousError }] =
    await Promise.all([
      supabase
        .from("company_profile_drafts")
        .select("id,workspace_id,base_version_id,input_hash,compiled_snapshot_json")
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.profileDraftId)
        .single(),
      supabase
        .from("profile_task_runs")
        .select("task_id,output_json,output_hash,status")
        .eq("workspace_id", input.workspaceId)
        .eq("profile_draft_id", input.profileDraftId)
        .eq("status", "completed")
        .order("created_at", { ascending: true }),
    ]);
  if (draftError)
    throw new Error(`Could not load Company Intelligence draft: ${draftError.message}`);
  if (previousError)
    throw new Error(`Could not load previous profile stages: ${previousError.message}`);

  const { data: evidence, error: evidenceError } = draft.base_version_id
    ? await supabase
        .from("evidence_items")
        .select(
          "id,evidence_type,excerpt,structured_value_json,directness,source_reliability,freshness_state,retrieved_at",
        )
        .eq("workspace_id", input.workspaceId)
        .eq("subject_id", draft.base_version_id)
        .order("retrieved_at", { ascending: false })
        .limit(40)
    : { data: [], error: null };
  if (evidenceError)
    throw new Error(`Could not load profile evidence: ${evidenceError.message}`);

  const context = {
    profileDraftId: draft.id,
    baseProfileVersionId: draft.base_version_id,
    draftSnapshot: draft.compiled_snapshot_json,
    evidence: evidence ?? [],
    previousStageOutputs: (previous ?? []).map((stage) => ({
      taskId: stage.task_id,
      output: stage.output_json,
      outputHash: stage.output_hash,
    })),
  };
  const inputHash = hash({
    context,
    contextCompilerVersion: definition.contextCompilerVersion,
    promptVersion: definition.promptVersion,
    schemaVersion: definition.schemaVersion,
  });
  const idempotencyKey = [
    input.workspaceId,
    input.taskId,
    input.profileDraftId,
    inputHash,
    definition.schemaVersion,
  ].join(":");

  const { data: existing, error: existingError } = await supabase
    .from("profile_task_runs")
    .select("id,status,output_json,attempt_count")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingError)
    throw new Error(`Could not inspect profile stage state: ${existingError.message}`);
  if (existing?.status === "completed" && existing.output_json !== null)
    return { cached: true, output: existing.output_json, taskRunId: existing.id };

  let taskRunId = existing?.id;
  if (!taskRunId) {
    const { data: created, error: createError } = await supabase
      .from("profile_task_runs")
      .insert({
        workspace_id: input.workspaceId,
        profile_draft_id: input.profileDraftId,
        task_id: input.taskId,
        idempotency_key: idempotencyKey,
        input_hash: inputHash,
        contract_version: "company-intelligence/v3.0",
        prompt_version: definition.promptVersion,
        schema_version: definition.schemaVersion,
        context_compiler_version: definition.contextCompilerVersion,
        trigger_run_id: input.triggerRunId ?? null,
      })
      .select("id")
      .single();
    if (createError)
      throw new Error(`Could not create profile stage run: ${createError.message}`);
    taskRunId = created.id;
  }

  const startedAt = new Date().toISOString();
  await updateTaskRun(taskRunId, {
    status: "running",
    attempt_count: (existing?.attempt_count ?? 0) + 1,
    started_at: startedAt,
    error_code: null,
    error_message: null,
  });

  try {
    const modelCall = await generateTextResult(definition.buildMessages(context), {
      role: modelRole(input.taskId),
      jsonMode: true,
      maxCompletionTokens: definition.maxCompletionTokens,
      reasoningEffort:
        definition.reasoningClass === "high"
          ? "high"
          : definition.reasoningClass === "standard"
            ? "medium"
            : "minimal",
      taskName: input.taskId,
    });
    const parsed = parseCompleteJsonObject(modelCall.data);
    const output = definition.outputSchema.parse(parsed);
    const outputHash = hash(output);
    const completedAt = new Date().toISOString();
    const { data: audit, error: auditError } = await supabase
      .from("ai_requests")
      .insert({
        workspace_id: input.workspaceId,
        role: input.taskId,
        provider: "openrouter",
        selected_model: modelCall.requestedModel,
        fallback_model: modelCall.fallbackUsed ? modelCall.actualModel : null,
        fallback_used: modelCall.fallbackUsed,
        prompt_version: definition.promptVersion,
        schema_version: definition.schemaVersion,
        request_hash: inputHash,
        status: "completed",
        input_units: modelCall.inputTokens ?? null,
        output_units: modelCall.outputTokens ?? null,
        actual_cost: modelCall.providerReportedCost ?? 0,
        currency: modelCall.providerCurrency ?? "USD",
        metadata: {
          actualModel: modelCall.actualModel,
          contextCompilerVersion: definition.contextCompilerVersion,
          latencyMs: modelCall.latencyMs,
          profileDraftId: input.profileDraftId,
          promptContentHash: hash(definition.buildMessages({ template: true })),
          providerRequestId: modelCall.providerRequestId,
          responseHash: outputHash,
          taskRunId,
        },
        started_at: startedAt,
        completed_at: completedAt,
      })
      .select("id")
      .single();
    if (auditError)
      throw new Error(`Could not audit profile stage request: ${auditError.message}`);

    await updateTaskRun(taskRunId, {
      status: "completed",
      output_json: output as Json,
      output_hash: outputHash,
      ai_request_ids: [audit.id],
      completed_at: completedAt,
    });
    return { cached: false, output, taskRunId };
  } catch (error) {
    await updateTaskRun(taskRunId, {
      status: "failed",
      error_code: errorCode(error),
      error_message: errorMessage(error).slice(0, 2_000),
      completed_at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function finalizeProfileV3Draft(input: {
  workspaceId: string;
  profileDraftId: string;
}) {
  const supabase = createServiceRoleClient();
  const [{ data: draft, error: draftError }, { data: stages, error: stagesError }] =
    await Promise.all([
      supabase
        .from("company_profile_drafts")
        .select("id,company_profile_id,compiled_snapshot_json")
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.profileDraftId)
        .single(),
      supabase
        .from("profile_task_runs")
        .select("task_id,output_json,completed_at")
        .eq("workspace_id", input.workspaceId)
        .eq("profile_draft_id", input.profileDraftId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false }),
    ]);
  if (draftError)
    throw new Error(
      `Could not load profile draft for compilation: ${draftError.message}`,
    );
  if (stagesError)
    throw new Error(
      `Could not load profile stages for compilation: ${stagesError.message}`,
    );

  const outputs = new Map<string, Json>();
  for (const stage of stages ?? []) {
    if (!outputs.has(stage.task_id) && stage.output_json !== null) {
      outputs.set(stage.task_id, stage.output_json);
    }
  }
  const commercial = profileCommercialSynthesisOutputSchema.parse(
    requiredOutput(outputs, "profile.commercial_synthesis"),
  );
  const offerings = profileOfferingDecompositionOutputSchema.parse(
    requiredOutput(outputs, "profile.offering_decomposition"),
  );
  const buyerLogic = profileBuyerLogicOutputSchema.parse(
    requiredOutput(outputs, "profile.buyer_logic"),
  );
  const clarification = profileClarificationOutputSchema.parse(
    requiredOutput(outputs, "profile.clarification"),
  );
  const consistency = profileConsistencyOutputSchema.parse(
    requiredOutput(outputs, "profile.consistency_audit"),
  );
  const compilation = compileProfileV3Draft({
    workspaceId: input.workspaceId,
    profileDraftId: input.profileDraftId,
    companyProfileId: draft.company_profile_id,
    baseSnapshot: draft.compiled_snapshot_json,
    commercial,
    offerings,
    buyerLogic,
    clarification,
    consistency,
  });
  const { error: compileError } = await supabase.rpc("compile_company_profile_v3_draft", {
    target_workspace_id: input.workspaceId,
    target_profile_draft_id: input.profileDraftId,
    target_compilation: compilation as Json,
  });
  if (compileError)
    throw new Error(
      `Could not compile Company Intelligence draft: ${compileError.message}`,
    );

  const { data: audit, error: auditError } = await supabase
    .from("profile_task_runs")
    .select("output_json")
    .eq("workspace_id", input.workspaceId)
    .eq("profile_draft_id", input.profileDraftId)
    .eq("task_id", "profile.consistency_audit")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (auditError)
    throw new Error(`Could not load profile consistency audit: ${auditError.message}`);
  const recommendation = stringField(audit?.output_json, "publishRecommendation");
  const state = resolveProfileV3DraftState({
    publishRecommendation: recommendation,
    clarificationQuestions: clarification.questions,
  });
  const { error } = await supabase
    .from("company_profile_drafts")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.profileDraftId);
  if (error) throw new Error(`Could not finalize profile draft: ${error.message}`);
  return { state };
}

export async function failProfileV3Draft(input: {
  workspaceId: string;
  profileDraftId: string;
  error: unknown;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("company_profile_drafts")
    .update({ state: "failed", updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.profileDraftId)
    .eq("state", "building");
  if (error) throw new Error(`Could not fail profile draft: ${error.message}`);
  const { error: eventError } = await supabase.from("profile_change_events").insert({
    workspace_id: input.workspaceId,
    profile_draft_id: input.profileDraftId,
    event_type: "workflow_failed",
    actor_type: "system",
    affected_paths: [],
    details_json: {
      errorCode: errorCode(input.error),
      errorMessage: errorMessage(input.error).slice(0, 2_000),
    },
  });
  if (eventError)
    throw new Error(`Could not record profile workflow failure: ${eventError.message}`);
}

async function assertProfileV3Enabled(workspaceId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("workspace_intelligence_settings")
    .select(
      "profile_version,campaign_workflow,shadow_mode,enabled_providers,result_write_mode",
    )
    .eq("workspace_id", workspaceId)
    .single();
  if (error) throw new Error(`Could not load Intelligence rollout: ${error.message}`);
  const settings = resolveWorkspaceIntelligenceSettings({
    settings: {
      profileVersion: data.profile_version as "v1" | "v2",
      campaignWorkflow: data.campaign_workflow as "v1" | "v2",
      shadowMode: data.shadow_mode,
      enabledProviders: data.enabled_providers,
      resultWriteMode: data.result_write_mode as "none" | "shadow" | "canonical",
    },
  });
  if (settings.profileVersion !== "v2")
    throw new Error("Company Intelligence V3 is not enabled for this workspace.");
}

async function updateTaskRun(id: string, values: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("profile_task_runs").update(values).eq("id", id);
  if (error) throw new Error(`Could not update profile stage: ${error.message}`);
}

function modelRole(taskId: string) {
  return taskId === "profile.fact_extraction"
    ? ("website_extraction" as const)
    : ("profile_analysis" as const);
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "profile_stage_failed";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Company Intelligence stage failed.";
}

function stringField(value: unknown, key: string) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as Record<string, unknown>)[key] ?? "")
    : "";
}

function requiredOutput(outputs: Map<string, Json>, taskId: string) {
  const output = outputs.get(taskId);
  if (output === undefined) {
    throw new Error(`Required Company Intelligence stage ${taskId} is missing.`);
  }
  return output;
}
