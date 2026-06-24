type ProviderConfig = {
  openRouter: {
    apiKey: string | null;
    model: string | null;
  };
  tavily: {
    apiKey: string | null;
  };
};

type RequiredOpenRouterConfig = {
  apiKey: string;
  model: string;
};

export type ProviderStatus = {
  configured: boolean;
  label: string;
  name: "openrouter" | "tavily";
  purpose: string;
};

export function getProviderConfig(): ProviderConfig {
  return {
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY?.trim() || null,
      model: process.env.OPENROUTER_MODEL?.trim() || null,
    },
    tavily: {
      apiKey: process.env.TAVILY_API_KEY?.trim() || null,
    },
  };
}

export function getProviderStatus(): ProviderStatus[] {
  const config = getProviderConfig();

  return [
    {
      configured: Boolean(config.tavily.apiKey),
      label: "Tavily",
      name: "tavily",
      purpose: "Web search and source discovery",
    },
    {
      configured: Boolean(config.openRouter.apiKey && config.openRouter.model),
      label: "OpenRouter",
      name: "openrouter",
      purpose: `AI reasoning and drafting (${config.openRouter.model ?? "model not set"})`,
    },
  ];
}

export function requireTavilyConfig() {
  const config = getProviderConfig();

  if (!config.tavily.apiKey) {
    throw new Error("Tavily is not configured. Add TAVILY_API_KEY to .env.local.");
  }

  return config.tavily;
}

export function requireOpenRouterConfig(): RequiredOpenRouterConfig {
  const config = getProviderConfig();

  if (!config.openRouter.apiKey) {
    throw new Error(
      "OpenRouter is not configured. Add OPENROUTER_API_KEY to .env.local.",
    );
  }

  if (!config.openRouter.model) {
    throw new Error(
      "OpenRouter model is not configured. Add OPENROUTER_MODEL to .env.local.",
    );
  }

  return {
    apiKey: config.openRouter.apiKey,
    model: config.openRouter.model,
  };
}
