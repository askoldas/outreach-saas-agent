import type { AiTaskResult } from "../contracts/shared.ts";
import type { IntelligenceSchemaRegistry } from "./schema-registry.ts";
import type { IntelligenceTaskRegistry } from "./task-registry.ts";

export type AiTransportResult = {
  output: unknown;
  requestedModel: string;
  actualModel: string;
  fallbackUsed: boolean;
  requestHash: string;
  responseHash: string;
};

export async function executeValidatedAiTask<TInput, TOutput>(input: {
  registry: IntelligenceTaskRegistry;
  schemas: IntelligenceSchemaRegistry;
  taskId: string;
  promptVersion: string;
  request: TInput;
  semanticContext?: unknown;
  transport: (request: {
    messages: Array<{ role: "system" | "user"; content: string }>;
    modelRole: string;
    maxCompletionTokens: number;
  }) => Promise<AiTransportResult>;
}): Promise<AiTaskResult<TOutput>> {
  const task = input.registry.get<TInput, TOutput>(input.taskId, input.promptVersion);
  const transportResult = await input.transport({
    messages: task.buildMessages(input.request),
    modelRole: task.modelRole,
    maxCompletionTokens: task.maxCompletionTokens,
  });
  const data = input.schemas.parse<TOutput>(
    task.taskId,
    task.schemaVersion,
    transportResult.output,
    input.semanticContext,
  );

  return {
    data,
    diagnostics: {
      warnings: [],
      unknownCount: 0,
      conflictCount: 0,
      evidenceReferenceCount: 0,
      omittedItemCount: 0,
    },
    provenance: {
      taskId: task.taskId,
      promptVersion: task.promptVersion,
      schemaVersion: task.schemaVersion,
      contextCompilerVersion: task.contextCompilerVersion,
      ...transportResult,
    },
  };
}
