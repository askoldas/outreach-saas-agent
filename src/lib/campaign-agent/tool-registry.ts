export type CampaignAgentToolContext = {
  campaignRunId: string;
  iteration: number;
  workspaceId: string;
};

export type CampaignAgentTool<TInput, TOutput> = {
  description: string;
  execute(input: TInput, context: CampaignAgentToolContext): Promise<TOutput>;
  name: string;
  parseInput(value: unknown): TInput;
  parseOutput(value: unknown): TOutput;
  version: string;
};

type RegisteredTool = CampaignAgentTool<unknown, unknown>;

export type CampaignAgentToolReceipt<TOutput> = {
  output: TOutput;
  tool: { name: string; version: string };
};

export function createCampaignAgentToolRegistry() {
  const tools = new Map<string, RegisteredTool>();
  return {
    register<TInput, TOutput>(tool: CampaignAgentTool<TInput, TOutput>) {
      const name = normalizedName(tool.name);
      if (tools.has(name))
        throw new Error(`Campaign Agent tool already registered: ${name}`);
      tools.set(name, tool as RegisteredTool);
      return this;
    },
    list() {
      return [...tools.values()].map(({ description, name, version }) => ({
        description,
        name,
        version,
      }));
    },
    async invoke<TOutput>(
      name: string,
      input: unknown,
      context: CampaignAgentToolContext,
    ): Promise<CampaignAgentToolReceipt<TOutput>> {
      const tool = tools.get(normalizedName(name));
      if (!tool) throw new Error(`Campaign Agent tool is not approved: ${name}`);
      const parsedInput = tool.parseInput(input);
      const output = tool.parseOutput(await tool.execute(parsedInput, context));
      return {
        output: output as TOutput,
        tool: { name: tool.name, version: tool.version },
      };
    },
  };
}

function normalizedName(value: string) {
  const name = value.trim();
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(name))
    throw new Error("Campaign Agent tool name is invalid.");
  return name;
}
