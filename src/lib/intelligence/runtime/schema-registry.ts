import type { z } from "zod";

export type SemanticValidator<T> = (value: T, context: unknown) => void;

export type SchemaRegistration<T> = {
  schemaVersion: string;
  taskId: string;
  schema: z.ZodType<T>;
  jsonSchema?: Record<string, unknown>;
  semanticValidators: SemanticValidator<T>[];
};

export class IntelligenceSchemaRegistry {
  readonly #registrations = new Map<string, SchemaRegistration<unknown>>();

  register<T>(registration: SchemaRegistration<T>) {
    const key = this.key(registration.taskId, registration.schemaVersion);
    if (this.#registrations.has(key)) {
      throw new Error(`Duplicate intelligence schema registration: ${key}`);
    }
    this.#registrations.set(key, registration as SchemaRegistration<unknown>);
  }

  parse<T>(taskId: string, schemaVersion: string, input: unknown, context?: unknown): T {
    const registration = this.#registrations.get(this.key(taskId, schemaVersion));
    if (!registration) {
      throw new Error(`Unknown intelligence schema: ${taskId}@${schemaVersion}`);
    }
    const value = registration.schema.parse(input);
    for (const validate of registration.semanticValidators) validate(value, context);
    return value as T;
  }

  get(taskId: string, schemaVersion: string) {
    return this.#registrations.get(this.key(taskId, schemaVersion));
  }

  private key(taskId: string, schemaVersion: string) {
    return `${taskId}@${schemaVersion}`;
  }
}
