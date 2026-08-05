import type { z } from "zod";
import { parseCompleteJsonObject } from "../../ai/structured-json.ts";

export type StructuredOutputValidation =
  | { success: true; data: unknown }
  | {
      success: false;
      kind: "invalid_json" | "schema_validation";
      issue: string;
    };

export function validateStructuredOutput(
  schema: z.ZodType,
  rawOutput: string,
): StructuredOutputValidation {
  const parsed = parseCompleteJsonObject(rawOutput);
  if (parsed === undefined) {
    return {
      success: false,
      kind: "invalid_json",
      issue: "The response did not contain one complete JSON object.",
    };
  }
  const result = schema.safeParse(parsed);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    kind: "schema_validation",
    issue: result.error.issues
      .slice(0, 20)
      .map(
        ({ message, path }) =>
          `${path.length ? path.map(String).join(".") : "<root>"}: ${message}`,
      )
      .join("; "),
  };
}

export function supportsStrictStructuredOutput(schema: Record<string, unknown>) {
  return inspectStrictCompatibility(schema);
}

function inspectStrictCompatibility(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Array.isArray(value)
      ? value.every((entry) => inspectStrictCompatibility(entry))
      : true;
  }
  const node = value as Record<string, unknown>;
  if (node.type === "object" && isRecord(node.properties)) {
    const required = new Set(
      Array.isArray(node.required) ? node.required.map(String) : [],
    );
    if (Object.keys(node.properties).some((key) => !required.has(key))) return false;
  }
  return Object.values(node).every((entry) => inspectStrictCompatibility(entry));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
