export type IntelligenceExecutionErrorCode =
  | "AI_TRANSPORT_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_JSON"
  | "AI_SCHEMA_VALIDATION_FAILED"
  | "AI_SEMANTIC_VALIDATION_FAILED"
  | "AI_CONTEXT_MISSING_FROZEN_VERSION"
  | "AI_REPAIR_FAILED"
  | "AI_TASK_CANCELLED"
  | "AI_CONFIGURATION_ERROR"
  | "AI_UNKNOWN_ERROR";

export class IntelligenceExecutionError extends Error {
  readonly code: IntelligenceExecutionErrorCode;
  readonly retryable: boolean;
  readonly validationIssue?: string;

  constructor(input: {
    code: IntelligenceExecutionErrorCode;
    message: string;
    retryable: boolean;
    cause?: unknown;
    validationIssue?: string;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "IntelligenceExecutionError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.validationIssue = input.validationIssue;
  }
}

export function classifyIntelligenceExecutionError(error: unknown) {
  if (error instanceof IntelligenceExecutionError) return error;
  const message = error instanceof Error ? error.message : "AI task execution failed.";
  const code = stringProperty(error, "code");
  if (code === "timeout" || /timeout|timed out|aborted due to timeout/i.test(message)) {
    return new IntelligenceExecutionError({
      code: "AI_TRANSPORT_TIMEOUT",
      message,
      retryable: true,
      cause: error,
    });
  }
  if (code === "rate_limited" || /rate.?limit|status 429/i.test(message)) {
    return new IntelligenceExecutionError({
      code: "AI_RATE_LIMITED",
      message,
      retryable: true,
      cause: error,
    });
  }
  if (
    code === "provider_unavailable" ||
    code === "transport_error" ||
    /status 5\d\d|fetch failed|network|temporarily unavailable/i.test(message)
  ) {
    return new IntelligenceExecutionError({
      code: "AI_PROVIDER_UNAVAILABLE",
      message,
      retryable: true,
      cause: error,
    });
  }
  if (/cancelled by user/i.test(message)) {
    return new IntelligenceExecutionError({
      code: "AI_TASK_CANCELLED",
      message,
      retryable: false,
      cause: error,
    });
  }
  if (/environment variable|configuration|api key|pinned provider/i.test(message)) {
    return new IntelligenceExecutionError({
      code: "AI_CONFIGURATION_ERROR",
      message,
      retryable: false,
      cause: error,
    });
  }
  return new IntelligenceExecutionError({
    code: "AI_UNKNOWN_ERROR",
    message,
    retryable: false,
    cause: error,
  });
}

export function isUnsupportedStructuredOutput(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /structured output|json schema|specified schema|schema produces a constraint|too many states|response_format/i.test(
    message,
  );
}

function stringProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : "";
}
