import { requireOpenRouterConfig } from "./config";

type OpenRouterMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function generateText(messages: OpenRouterMessage[]): Promise<string> {
  const { apiKey, model } = requireOpenRouterConfig();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    throw new Error(`OpenRouter generation failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OpenRouterResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return content;
}
