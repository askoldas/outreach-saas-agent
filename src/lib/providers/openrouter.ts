import { requireOpenRouterConfig } from "./config.ts";

const openRouterChatCompletionsEndpoint = "https://openrouter.ai/api/v1/chat/completions";
const openRouterEndpointPath = "/api/v1/chat/completions";

type OpenRouterMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

type OpenRouterErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
  message?: string;
};

type OpenRouterResponse = {
  error?: { code?: number | string; message?: string };
  choices?: Array<{
    error?: { code?: number | string; message?: string };
    finish_reason?: string | null;
    native_finish_reason?: string | null;
    message?: {
      content?: string;
    };
  }>;
  usage?: { completion_tokens?: number; prompt_tokens?: number };
};

type GenerateTextOptions = {
  jsonMode?: boolean;
  maxCompletionTokens?: number;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  taskName?: string;
  timeoutMs?: number;
};

const defaultOpenRouterTimeoutMs = 120_000;

export async function generateText(
  messages: OpenRouterMessage[],
  options: GenerateTextOptions = {},
): Promise<string> {
  const { apiKey, model } = requireOpenRouterConfig();
  const fallbackModels = getOpenRouterFallbackModels(model);
  const taskName = options.taskName ?? "text generation";
  const timeoutMs = options.timeoutMs ?? getOpenRouterTimeoutMs();
  let response: Response;

  try {
    response = await fetch(openRouterChatCompletionsEndpoint, {
      body: JSON.stringify({
        messages,
        model,
        ...(fallbackModels.length ? { models: fallbackModels } : {}),
        ...(options.maxCompletionTokens
          ? { max_completion_tokens: options.maxCompletionTokens }
          : {}),
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(options.reasoningEffort
          ? {
              reasoning: {
                effort: options.reasoningEffort,
                exclude: true,
              },
            }
          : {}),
        temperature: 0.2,
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Outreach SaaS Agent",
      },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = normalizeOpenRouterNetworkError(error, timeoutMs);

    logOpenRouterDiagnostics({
      body: "",
      message,
      model,
      status: 0,
      taskName,
    });

    throw new Error(message);
  }

  if (!response.ok) {
    const errorBody = await readOpenRouterErrorBody(response);

    logOpenRouterDiagnostics({
      body: errorBody.rawBody,
      message: errorBody.message,
      model,
      status: response.status,
      taskName,
    });

    throw new Error(
      buildOpenRouterErrorMessage(response.status, model, errorBody.message),
    );
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    logOpenRouterDiagnostics({
      body: rawBody,
      message: "OpenRouter returned an empty response body.",
      model,
      status: response.status,
      taskName,
    });

    throw new Error(`OpenRouter returned an empty response for ${taskName}.`);
  }

  let payload: OpenRouterResponse;

  try {
    payload = JSON.parse(rawBody) as OpenRouterResponse;
  } catch {
    logOpenRouterDiagnostics({
      body: rawBody,
      message: "OpenRouter returned a non-JSON response body.",
      model,
      status: response.status,
      taskName,
    });

    throw new Error(`OpenRouter returned a non-JSON response for ${taskName}.`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    const diagnostic = describeEmptyCompletion(payload);
    logOpenRouterDiagnostics({
      body: rawBody,
      message: diagnostic,
      model,
      status: response.status,
      taskName,
    });

    throw new Error(
      `OpenRouter model "${model}" returned no content for ${taskName}. ${diagnostic}`,
    );
  }

  const finishReason =
    payload.choices?.[0]?.finish_reason ?? payload.choices?.[0]?.native_finish_reason;
  if (finishReason === "length") {
    throw new Error(
      `OpenRouter truncated the response for ${taskName} at the completion-token limit.`,
    );
  }

  return content;
}

export function getOpenRouterFallbackModels(primaryModel: string) {
  return (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(
      (model, index, models) =>
        Boolean(model) && model !== primaryModel && models.indexOf(model) === index,
    );
}

export function describeEmptyCompletion(payload: OpenRouterResponse) {
  const choice = payload.choices?.[0];
  const providerError = payload.error?.message ?? choice?.error?.message;
  if (providerError) return `Provider error: ${providerError}`;
  const finishReason = choice?.finish_reason ?? choice?.native_finish_reason;
  const completionTokens = payload.usage?.completion_tokens;
  const promptTokens = payload.usage?.prompt_tokens;
  const details = [
    finishReason ? `finish reason: ${finishReason}` : "finish reason was not supplied",
    typeof completionTokens === "number"
      ? `completion tokens: ${completionTokens}`
      : "completion token count was not supplied",
    typeof promptTokens === "number" ? `prompt tokens: ${promptTokens}` : null,
  ].filter(Boolean);
  return `${details.join("; ")}. The selected provider/model may be unavailable, rate-limited, filtered, or unable to complete the requested structured output.`;
}

export function getOpenRouterTimeoutMs() {
  const configured = Number(process.env.OPENROUTER_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 5_000
    ? Math.floor(configured)
    : defaultOpenRouterTimeoutMs;
}

function normalizeOpenRouterNetworkError(error: unknown, timeoutMs: number) {
  if (
    (error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")) ||
    (error instanceof Error && /aborted due to timeout|timed? out/i.test(error.message))
  ) {
    return `OpenRouter request timed out after ${Math.round(timeoutMs / 1000)} seconds before returning a response.`;
  }

  if (error instanceof Error) {
    const cause = getErrorCause(error);
    const code = getErrorCode(cause) || getErrorCode(error);
    const detail = code ? ` (${code})` : "";

    return `OpenRouter network request failed before a response was received${detail}: ${error.message}`;
  }

  return "OpenRouter network request failed before a response was received.";
}

function getErrorCause(error: Error) {
  return "cause" in error ? error.cause : undefined;
}

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "";
}

async function readOpenRouterErrorBody(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return {
      message: "",
      rawBody,
    };
  }

  try {
    const parsed = JSON.parse(rawBody) as OpenRouterErrorPayload;
    return {
      message: parsed.error?.message ?? parsed.message ?? rawBody,
      rawBody,
    };
  } catch {
    return {
      message: rawBody,
      rawBody,
    };
  }
}

function buildOpenRouterErrorMessage(
  status: number,
  model: string,
  responseMessage: string,
) {
  const detail = responseMessage ? ` OpenRouter response: ${responseMessage}` : "";

  if (status === 404) {
    return [
      `OpenRouter generation failed with status 404 for model "${model}".`,
      "Likely causes: unavailable model, typo in OPENROUTER_MODEL, expired free model, or unsupported endpoint.",
      `Endpoint path: ${openRouterEndpointPath}.`,
      detail.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    `OpenRouter generation failed with status ${status} for model "${model}".`,
    `Endpoint path: ${openRouterEndpointPath}.`,
    detail.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

function logOpenRouterDiagnostics(input: {
  body: string;
  message: string;
  model: string;
  status: number;
  taskName: string;
}) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn("OpenRouter request failed", {
    endpointPath: openRouterEndpointPath,
    model: input.model,
    responseBody: input.body,
    responseMessage: input.message,
    status: input.status,
    taskName: input.taskName,
  });
}
