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
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GenerateTextOptions = {
  taskName?: string;
};

export async function generateText(
  messages: OpenRouterMessage[],
  options: GenerateTextOptions = {},
): Promise<string> {
  const { apiKey, model } = requireOpenRouterConfig();
  const taskName = options.taskName ?? "text generation";
  let response: Response;

  try {
    response = await fetch(openRouterChatCompletionsEndpoint, {
      body: JSON.stringify({
        messages,
        model,
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
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = normalizeOpenRouterNetworkError(error);

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
    logOpenRouterDiagnostics({
      body: rawBody,
      message: "OpenRouter returned an empty message content.",
      model,
      status: response.status,
      taskName,
    });

    throw new Error(`OpenRouter returned an empty response for ${taskName}.`);
  }

  return content;
}

function normalizeOpenRouterNetworkError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "OpenRouter request timed out before returning a response.";
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
