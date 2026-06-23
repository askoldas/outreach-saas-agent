import { requireOpenRouterConfig } from "./config";

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
  const response = await fetch(openRouterChatCompletionsEndpoint, {
    body: JSON.stringify({
      messages,
      model,
      temperature: 0.2,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Outreach SaaS Agent",
    },
    method: "POST",
  });

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

  const payload = JSON.parse(rawBody) as OpenRouterResponse;
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
