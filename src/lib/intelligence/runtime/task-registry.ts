import type { z } from "zod";
import type {
  AiTaskContractVersion,
  IntelligenceV2ModelRole,
} from "../contracts/shared.ts";

export type PromptMessage = { role: "system" | "user"; content: string };

export type PromptDefinition<TInput, TOutput> = AiTaskContractVersion & {
  modelRole: IntelligenceV2ModelRole;
  title: string;
  description: string;
  buildMessages(input: TInput): PromptMessage[];
  outputSchema: z.ZodType<TOutput>;
  maxCompletionTokens: number;
  reasoningClass: "none" | "minimal" | "standard" | "high";
  allowsRepair: boolean;
  allowsFallback: boolean;
  batchLimit?: number;
};

export class IntelligenceTaskRegistry {
  readonly #definitions = new Map<string, PromptDefinition<unknown, unknown>>();

  register<TInput, TOutput>(definition: PromptDefinition<TInput, TOutput>) {
    const key = this.key(definition.taskId, definition.promptVersion);
    if (this.#definitions.has(key)) {
      throw new Error(`Duplicate intelligence task registration: ${key}`);
    }
    this.#definitions.set(key, definition as PromptDefinition<unknown, unknown>);
  }

  get<TInput, TOutput>(taskId: string, promptVersion: string) {
    const definition = this.#definitions.get(this.key(taskId, promptVersion));
    if (!definition) {
      throw new Error(`Unknown intelligence task: ${taskId}@${promptVersion}`);
    }
    return definition as PromptDefinition<TInput, TOutput>;
  }

  private key(taskId: string, promptVersion: string) {
    return `${taskId}@${promptVersion}`;
  }
}
