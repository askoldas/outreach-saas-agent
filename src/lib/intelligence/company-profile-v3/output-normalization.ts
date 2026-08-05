import { parseCompleteJsonObject } from "../../ai/structured-json.ts";

export function normalizeProfileStageProviderOutput(taskId: string, raw: string) {
  if (taskId !== "profile.fact_extraction") return raw;
  const parsed = parseCompleteJsonObject(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
  const output = structuredClone(parsed) as Record<string, unknown>;
  if (!Array.isArray(output.facts)) return raw;
  output.facts = output.facts
    .filter((fact) => {
      const value = objectValue(fact).value;
      return value !== null && value !== undefined;
    })
    .map((fact) => {
      const record = objectValue(fact);
      return { ...record, value: atomicFactValue(record.value) };
    });
  return JSON.stringify(output);
}

function atomicFactValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return JSON.stringify(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
