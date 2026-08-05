import { createServiceRoleClient } from "@/lib/supabase/service";
import type { IntelligenceAttemptRecord } from "@/lib/intelligence/runtime/execute-ai-task";

export function createIntelligenceAttemptRecorder(input: {
  workspaceId: string;
  cacheKey?: string;
  frozenInputHash?: string;
  metadata?: Record<string, unknown>;
}) {
  return (attempt: IntelligenceAttemptRecord) =>
    recordIntelligenceAttempt({ ...input, attempt });
}

export async function recordIntelligenceAttempt(input: {
  workspaceId: string;
  cacheKey?: string;
  frozenInputHash?: string;
  metadata?: Record<string, unknown>;
  attempt: IntelligenceAttemptRecord;
}) {
  type AttemptTable = {
    from(name: "intelligence_ai_attempts"): {
      insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
  };
  const transport = input.attempt.transport;
  const { error } = await (createServiceRoleClient() as unknown as AttemptTable)
    .from("intelligence_ai_attempts")
    .insert({
      workspace_id: input.workspaceId,
      cache_key: input.cacheKey ?? null,
      frozen_input_hash: input.frozenInputHash ?? null,
      task_id: input.attempt.taskId,
      prompt_version: input.attempt.promptVersion,
      schema_version: input.attempt.schemaVersion,
      context_compiler_version: input.attempt.contextCompilerVersion,
      model_route_version: input.attempt.modelRouteVersion,
      attempt: input.attempt.attempt,
      attempt_kind: input.attempt.attemptKind,
      output_mode: input.attempt.outputMode,
      status: input.attempt.status,
      requested_model: transport?.requestedModel ?? null,
      actual_model: transport?.actualModel ?? null,
      fallback_used: transport?.fallbackUsed ?? false,
      request_hash: transport?.requestHash ?? null,
      response_hash: transport?.responseHash ?? null,
      latency_ms: transport?.latencyMs ?? null,
      input_units: transport?.inputUnits ?? null,
      output_units: transport?.outputUnits ?? null,
      actual_cost: transport?.actualCost ?? null,
      currency: transport?.currency ?? null,
      validation_issue: input.attempt.validationIssue ?? null,
      error_code: input.attempt.errorCode ?? null,
      error_message: input.attempt.errorMessage ?? null,
      metadata: input.metadata ?? {},
      started_at: input.attempt.startedAt,
      completed_at: input.attempt.completedAt,
    });
  if (error) throw new Error(`Could not record Intelligence AI attempt: ${error.message}`);
}
