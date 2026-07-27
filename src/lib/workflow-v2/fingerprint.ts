import { createHash } from "node:crypto";
import type { Json } from "@/types/database.types";

export function fingerprintJson(value: Json) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item ?? null)}`)
    .join(",")}}`;
}
