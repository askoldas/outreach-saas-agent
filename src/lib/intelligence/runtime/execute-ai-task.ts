import { z } from "zod";
import type { AiTaskResult } from "../contracts/shared.ts";
import type { IntelligenceSchemaRegistry } from "./schema-registry.ts";
import type { IntelligenceTaskRegistry } from "./task-registry.ts";
import {
  IntelligenceExecutionError,
  classifyIntelligenceExecutionError,
  isUnsupportedStructuredOutput,
} from "./execution-errors.ts";
import {
  supportsStrictStructuredOutput,
  validateStructuredOutput,
} from "./validated-output.ts";

export type AiTransportResult = {
  output: unknown;
  requestedModel: string;
  actualModel: string;
  fallbackUsed: boolean;
  requestHash: string;
  responseHash: string;
  latencyMs?: number;
  inputUnits?: number;
  outputUnits?: number;
  actualCost?: number;
  currency?: string;
};

export type IntelligenceAttemptRecord = {
  taskId: string;
  promptVersion: string;
  schemaVersion: string;
  contextCompilerVersion: string;
  modelRouteVersion: string;
  attempt: number;
  attemptKind: "initial" | "repair";
  outputMode: "json_schema" | "json_object";
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  validationIssue?: string;
  errorCode?: string;
  errorMessage?: string;
  transport?: AiTransportResult;
};

export type IntelligenceTaskCache = {
  get<T>(key: string): Promise<AiTaskResult<T> | null>;
  put<T>(key: string, result: AiTaskResult<T>): Promise<void>;
};

type TransportRequest = {
  messages: Array<{ role: "assistant" | "system" | "user"; content: string }>;
  modelRole: string;
  maxCompletionTokens: number;
  allowsFallback: boolean;
  reasoningClass: "none" | "minimal" | "standard" | "high";
  output:
    | { mode: "json_object" }
    | { mode: "json_schema"; name: string; schema: Record<string, unknown>; strict: true };
  attemptKind: "initial" | "repair";
};

export async function executeValidatedAiTask<TInput, TOutput>(input: {
  registry: IntelligenceTaskRegistry;
  schemas: IntelligenceSchemaRegistry;
  taskId: string;
  promptVersion: string;
  modelRouteVersion: string;
  request: TInput;
  semanticContext?: unknown;
  supportsStructuredOutput?: (schema: Record<string, unknown>) => boolean;
  transport: (request: TransportRequest) => Promise<AiTransportResult>;
  recordAttempt?: (attempt: IntelligenceAttemptRecord) => Promise<void>;
  recordCacheHit?: (event: {
    taskId: string;
    cacheKey: string;
    promptVersion: string;
    schemaVersion: string;
  }) => Promise<void>;
  cache?: IntelligenceTaskCache;
  cacheKey?: string;
}): Promise<AiTaskResult<TOutput>> {
  if (input.cache && input.cacheKey) {
    const cached = await input.cache.get<TOutput>(input.cacheKey);
    if (cached) {
      await input.recordCacheHit?.({
        taskId: cached.provenance.taskId,
        cacheKey: input.cacheKey,
        promptVersion: cached.provenance.promptVersion,
        schemaVersion: cached.provenance.schemaVersion,
      });
      return {
        ...cached,
        provenance: { ...cached.provenance, cacheHit: true },
      };
    }
  }
  const task = input.registry.get<TInput, TOutput>(input.taskId, input.promptVersion);
  const registration = input.schemas.get(task.taskId, task.schemaVersion);
  if (!registration) {
    throw new IntelligenceExecutionError({
      code: "AI_CONFIGURATION_ERROR",
      message: `Unknown intelligence schema: ${task.taskId}@${task.schemaVersion}`,
      retryable: false,
    });
  }
  const jsonSchema =
    registration.jsonSchema ??
    (z.toJSONSchema(registration.schema) as Record<string, unknown>);
  const structuredOutputUsed =
    supportsStrictStructuredOutput(jsonSchema) &&
    (input.supportsStructuredOutput?.(jsonSchema) ?? true);
  const baseMessages = task.buildMessages(input.request);
  const attempts: AiTransportResult[] = [];
  let structuredOutputFallbackUsed = false;

  let initial;
  try {
    initial = await invoke({
      attemptKind: "initial",
      attempt: 1,
      messages: baseMessages,
      outputMode: structuredOutputUsed ? "json_schema" : "json_object",
      reasoningClass: task.reasoningClass,
    });
  } catch (error) {
    if (!structuredOutputUsed || !isUnsupportedStructuredOutput(error)) throw error;
    structuredOutputFallbackUsed = true;
    initial = await invoke({
      attemptKind: "initial",
      attempt: 2,
      messages: baseMessages,
      outputMode: "json_object",
      reasoningClass: task.reasoningClass,
    });
  }
  let successfulAttempt = initial;
  attempts.push(initial.transport);
  let validation = validateStructuredOutput(
    registration.schema,
    outputText(initial.transport.output),
  );
  if (!validation.success) {
    const errorCode = validation.kind === "invalid_json"
      ? "AI_INVALID_JSON"
      : "AI_SCHEMA_VALIDATION_FAILED";
    await recordOutputAttempt(initial, "failed", {
      errorCode,
      errorMessage: `AI output validation failed: ${validation.issue}`,
      validationIssue: validation.issue,
    });
  }
  if (!validation.success && !task.allowsRepair) {
    throw validationError(validation.issue, validation.kind, false);
  }
  if (!validation.success) {
    const repair = await invoke({
      attemptKind: "repair",
      attempt: initial.options.attempt + 1,
      messages: [
        ...baseMessages,
        { role: "assistant", content: outputText(initial.transport.output).slice(0, 30_000) },
        {
          role: "user",
          content: `Correct the previous response without inventing evidence. Return only one complete JSON object. Validation issues: ${validation.issue}`,
        },
      ],
      outputMode: "json_object",
      reasoningClass: "minimal",
      priorValidationIssue: validation.issue,
    });
    attempts.push(repair.transport);
    validation = validateStructuredOutput(
      registration.schema,
      outputText(repair.transport.output),
    );
    if (!validation.success) {
      await recordOutputAttempt(repair, "failed", {
        errorCode: "AI_REPAIR_FAILED",
        errorMessage: `AI output repair failed: ${validation.issue}`,
        validationIssue: validation.issue,
      });
      throw validationError(validation.issue, validation.kind, true);
    }
    successfulAttempt = repair;
  }

  let data: TOutput;
  try {
    data = input.schemas.parse<TOutput>(
      task.taskId,
      task.schemaVersion,
      validation.data,
      input.semanticContext,
    );
  } catch (error) {
    await recordOutputAttempt(successfulAttempt, "failed", {
      errorCode: "AI_SEMANTIC_VALIDATION_FAILED",
      errorMessage:
        error instanceof Error ? error.message : "AI semantic validation failed.",
    });
    throw new IntelligenceExecutionError({
      code: "AI_SEMANTIC_VALIDATION_FAILED",
      message: error instanceof Error ? error.message : "AI semantic validation failed.",
      retryable: false,
      cause: error,
    });
  }
  await recordOutputAttempt(successfulAttempt, "completed");
  const finalTransport = attempts.at(-1)!;
  const result: AiTaskResult<TOutput> = {
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
      modelRouteVersion: input.modelRouteVersion,
      requestedModel: finalTransport.requestedModel,
      actualModel: finalTransport.actualModel,
      fallbackUsed: finalTransport.fallbackUsed,
      requestHash: finalTransport.requestHash,
      responseHash: finalTransport.responseHash,
      attemptCount: successfulAttempt.options.attempt,
      repairAttempted: successfulAttempt.options.attemptKind === "repair",
      structuredOutputUsed,
      structuredOutputFallbackUsed,
      cacheHit: false,
      latencyMs: sum(attempts, "latencyMs"),
      inputUnits: sum(attempts, "inputUnits"),
      outputUnits: sum(attempts, "outputUnits"),
      actualCost: sum(attempts, "actualCost"),
      currency: finalTransport.currency,
    },
  };
  if (input.cache && input.cacheKey) await input.cache.put(input.cacheKey, result);
  return result;

  async function invoke(options: {
    attempt: number;
    attemptKind: "initial" | "repair";
    messages: TransportRequest["messages"];
    outputMode: "json_schema" | "json_object";
    reasoningClass: TransportRequest["reasoningClass"];
    priorValidationIssue?: string;
  }) {
    const startedAt = new Date().toISOString();
    try {
      const transport = await input.transport({
        messages: options.messages,
        modelRole: task.modelRole,
        maxCompletionTokens: task.maxCompletionTokens,
        reasoningClass: options.reasoningClass,
        allowsFallback: task.allowsFallback,
        output:
          options.outputMode === "json_schema"
            ? {
                mode: "json_schema",
                name: task.taskId.replaceAll(".", "_"),
                schema: jsonSchema,
                strict: true,
              }
            : { mode: "json_object" },
        attemptKind: options.attemptKind,
      });
      return { transport, startedAt, options };
    } catch (error) {
      const classified = classifyIntelligenceExecutionError(error);
      await input.recordAttempt?.({
        ...identity(options),
        status: "failed",
        startedAt,
        completedAt: new Date().toISOString(),
        validationIssue: options.priorValidationIssue,
        errorCode: classified.code,
        errorMessage: classified.message,
      });
      throw classified;
    }
  }

  async function recordOutputAttempt(
    execution: {
      transport: AiTransportResult;
      startedAt: string;
      options: {
        attempt: number;
        attemptKind: "initial" | "repair";
        outputMode: "json_schema" | "json_object";
      };
    },
    status: "completed" | "failed",
    failure: {
      validationIssue?: string;
      errorCode?: string;
      errorMessage?: string;
    } = {},
  ) {
    await input.recordAttempt?.({
      ...identity(execution.options),
      status,
      startedAt: execution.startedAt,
      completedAt: new Date().toISOString(),
      transport: execution.transport,
      ...failure,
    });
  }

  function identity(options: {
    attempt: number;
    attemptKind: "initial" | "repair";
    outputMode: "json_schema" | "json_object";
  }) {
    return {
      taskId: task.taskId,
      promptVersion: task.promptVersion,
      schemaVersion: task.schemaVersion,
      contextCompilerVersion: task.contextCompilerVersion,
      modelRouteVersion: input.modelRouteVersion,
      attempt: options.attempt,
      attemptKind: options.attemptKind,
      outputMode: options.outputMode,
    };
  }
}

function validationError(
  issue: string,
  kind: "invalid_json" | "schema_validation",
  repair: boolean,
) {
  return new IntelligenceExecutionError({
    code: repair
      ? "AI_REPAIR_FAILED"
      : kind === "invalid_json"
        ? "AI_INVALID_JSON"
        : "AI_SCHEMA_VALIDATION_FAILED",
    message: repair ? `AI output repair failed: ${issue}` : `AI output validation failed: ${issue}`,
    retryable: false,
    validationIssue: issue,
  });
}

function outputText(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function sum(
  values: AiTransportResult[],
  key: "latencyMs" | "inputUnits" | "outputUnits" | "actualCost",
) {
  const present = values.map((value) => value[key]).filter((value) => value !== undefined);
  return present.length ? present.reduce((total, value) => total + value, 0) : undefined;
}
