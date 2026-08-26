import { parseCompleteJsonObject } from "../../ai/structured-json.ts";

export function normalizeProfileStageProviderOutput(taskId: string, raw: string) {
  const parsed = parseCompleteJsonObject(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
  const output = structuredClone(parsed) as Record<string, unknown>;
  if (taskId === "profile.buyer_logic") {
    normalizeBuyerLogic(output);
    return JSON.stringify(output);
  }
  if (taskId !== "profile.fact_extraction") return raw;
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

function normalizeBuyerLogic(output: Record<string, unknown>) {
  if (!Array.isArray(output.offeringBuyerLogic)) return;
  output.offeringBuyerLogic = output.offeringBuyerLogic.map((value) => {
    const logic = objectValue(value);
    if (typeof logic.procurementPattern !== "string") return logic;
    return {
      ...logic,
      procurementPattern: boundedText(logic.procurementPattern, 320),
    };
  });
}

function boundedText(value: string, maximumLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumLength) return normalized;
  const prefix = normalized.slice(0, maximumLength - 1);
  const boundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, boundary >= maximumLength * 0.7 ? boundary : prefix.length).trimEnd()}…`;
}

function atomicFactValue(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
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
