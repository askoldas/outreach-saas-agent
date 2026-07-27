import type { ModelRole } from "../ai/model-roles.ts";
import { getModelRoute } from "../ai/model-router.ts";
import { requireOpenRouterConfig } from "./config.ts";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export interface AiCallResult<T> {
  data: T;
  provider: "openrouter";
  requestedModel: string;
  actualModel?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  providerRequestId?: string;
  providerReportedCost?: number;
  providerCurrency?: "USD";
  latencyMs: number;
}

export type GenerateTextOptions = {
  role: ModelRole;
  jsonMode?: boolean;
  maxCompletionTokens?: number;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  taskName?: string;
  timeoutMs?: number;
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  error?: { code?: number | string; message?: string };
  choices?: Array<{
    error?: { code?: number | string; message?: string };
    finish_reason?: string | null;
    native_finish_reason?: string | null;
    message?: { content?: string };
  }>;
  usage?: {
    completion_tokens?: number;
    prompt_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
};

export async function generateText(
  messages: OpenRouterMessage[],
  options: GenerateTextOptions,
): Promise<string> {
  return (await generateTextResult(messages, options)).data;
}

export async function generateTextResult(
  messages: OpenRouterMessage[],
  options: GenerateTextOptions,
): Promise<AiCallResult<string>> {
  const { apiKey } = requireOpenRouterConfig();
  const route = getModelRoute(options.role);
  const timeoutMs = options.timeoutMs ?? route.timeoutMs;
  const taskName = options.taskName ?? options.role;
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      body: JSON.stringify({
        messages,
        model: route.primaryModel,
        ...(route.fallbackModels.length ? { models: route.fallbackModels } : {}),
        ...(options.maxCompletionTokens
          ? { max_completion_tokens: options.maxCompletionTokens }
          : {}),
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort, exclude: true } }
          : {}),
        temperature: 0.2,
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Opptium",
      },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new OpenRouterRequestError(
      normalizeNetworkError(error, timeoutMs),
      isTimeoutError(error) ? "timeout" : "transport_error",
      true,
    );
  }

  const rawBody = await response.text();
  if (!response.ok) {
    const message = readErrorMessage(rawBody);
    throw new OpenRouterRequestError(
      `OpenRouter generation failed with status ${response.status} for model "${route.primaryModel}".${message ? ` ${message}` : ""}`,
      classifyStatus(response.status),
      isRetryableStatus(response.status),
    );
  }
  if (!rawBody.trim())
    throw new OpenRouterRequestError(
      `OpenRouter returned an empty response for ${taskName}.`,
      "empty_response",
      false,
    );

  let payload: OpenRouterResponse;
  try {
    payload = JSON.parse(rawBody) as OpenRouterResponse;
  } catch {
    throw new OpenRouterRequestError(
      `OpenRouter returned a non-JSON response for ${taskName}.`,
      "invalid_provider_response",
      false,
    );
  }
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content)
    throw new OpenRouterRequestError(
      `OpenRouter model "${route.primaryModel}" returned no content for ${taskName}. ${describeEmptyCompletion(payload)}`,
      "empty_completion",
      false,
    );
  const finishReason =
    payload.choices?.[0]?.finish_reason ?? payload.choices?.[0]?.native_finish_reason;
  if (finishReason === "length")
    throw new OpenRouterRequestError(
      `OpenRouter truncated the response for ${taskName}.`,
      "completion_truncated",
      false,
    );

  const actualModel = payload.model?.trim() || route.primaryModel;
  const fallbackUsed = actualModel !== route.primaryModel;
  return {
    data: content,
    provider: "openrouter",
    requestedModel: route.primaryModel,
    actualModel,
    fallbackUsed,
    ...(fallbackUsed
      ? {
          fallbackReason:
            "OpenRouter used the configured fallback after a primary model or provider availability failure.",
        }
      : {}),
    ...(typeof payload.usage?.prompt_tokens === "number"
      ? { inputTokens: payload.usage.prompt_tokens }
      : {}),
    ...(typeof payload.usage?.completion_tokens === "number"
      ? { outputTokens: payload.usage.completion_tokens }
      : {}),
    ...(typeof payload.usage?.total_tokens === "number"
      ? { totalTokens: payload.usage.total_tokens }
      : {}),
    ...(payload.id ? { providerRequestId: payload.id } : {}),
    ...(typeof payload.usage?.cost === "number"
      ? { providerReportedCost: payload.usage.cost, providerCurrency: "USD" as const }
      : {}),
    latencyMs: Date.now() - startedAt,
  };
}

export class OpenRouterRequestError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function getOpenRouterFallbackModels(role: ModelRole) {
  return getModelRoute(role).fallbackModels;
}

export function describeEmptyCompletion(payload: OpenRouterResponse) {
  const choice = payload.choices?.[0];
  const providerError = payload.error?.message ?? choice?.error?.message;
  if (providerError) return `Provider error: ${providerError}`;
  const finishReason = choice?.finish_reason ?? choice?.native_finish_reason;
  const completionTokens = payload.usage?.completion_tokens;
  const promptTokens = payload.usage?.prompt_tokens;
  return [
    finishReason ? `finish reason: ${finishReason}` : "finish reason was not supplied",
    typeof completionTokens === "number"
      ? `completion tokens: ${completionTokens}`
      : "completion token count was not supplied",
    typeof promptTokens === "number" ? `prompt tokens: ${promptTokens}` : null,
  ]
    .filter(Boolean)
    .join("; ")
    .concat(".");
}

export function getOpenRouterTimeoutMs(role: ModelRole = "low_risk_transformation") {
  return getModelRoute(role).timeoutMs;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function classifyStatus(status: number) {
  if (status === 429) return "rate_limited";
  if (status === 404) return "model_unavailable";
  if (status >= 500) return "provider_unavailable";
  return `http_${status}`;
}

function isTimeoutError(error: unknown) {
  return (
    (error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")) ||
    (error instanceof Error && /timeout|timed out/i.test(error.message))
  );
}

function normalizeNetworkError(error: unknown, timeoutMs: number) {
  if (isTimeoutError(error))
    return `OpenRouter request timed out after ${Math.round(timeoutMs / 1_000)} seconds.`;
  return error instanceof Error
    ? `OpenRouter network request failed: ${error.message}`
    : "OpenRouter network request failed.";
}

function readErrorMessage(rawBody: string) {
  if (!rawBody) return "";
  try {
    const value = JSON.parse(rawBody) as {
      error?: { message?: string };
      message?: string;
    };
    return value.error?.message ?? value.message ?? "";
  } catch {
    return rawBody.slice(0, 500);
  }
}
