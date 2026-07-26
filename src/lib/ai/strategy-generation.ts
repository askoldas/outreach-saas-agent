import { generateTextResult } from "../providers/openrouter.ts";
import type { CampaignStrategyVersion } from "../../types/domain.ts";

export const strategyGenerationPromptVersion = "campaign-strategy-v1";

export async function generateCampaignStrategy(input: {
  campaign: Record<string, unknown>;
  companyProfile: Record<string, unknown>;
  currentStrategy: CampaignStrategyVersion;
  instruction: string;
}) {
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content:
          "Create or refine a structured B2B research strategy grounded only in the supplied campaign and Company Profile. Return JSON only using the exact currentStrategy field names. Preserve reasonable existing values unless the instruction changes them. Never add unsupported seller claims.",
      },
      {
        role: "user",
        content: JSON.stringify({
          ...input,
          requiredFields: Object.keys(input.currentStrategy).filter(
            (key) => !["id", "version", "status"].includes(key),
          ),
        }),
      },
    ],
    { role: "campaign_planning", taskName: "campaign strategy generation" },
  );
  const rawOutput = modelCall.data;
  return { strategy: parseCampaignStrategy(rawOutput), rawOutput, modelCall };
}

export function parseCampaignStrategy(rawOutput: string): CampaignStrategyVersion {
  const json = rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Strategy generation returned invalid JSON.");
  }
  if (!value || typeof value !== "object")
    throw new Error("Strategy generation returned an invalid object.");
  const row = value as Record<string, unknown>;
  const arrays = [
    "companyTypes",
    "industries",
    "characteristics",
    "relevanceReasons",
    "opportunityAssumptions",
    "qualificationCriteria",
    "positiveSignals",
    "exclusions",
    "contactRoles",
    "contactDepartments",
    "acceptableContactRoutes",
    "searchLanguages",
    "sourceCategories",
    "searchTerms",
    "localizedTerms",
    "limitations",
    "refinementSummary",
  ] as const;
  const result = Object.fromEntries(
    arrays.map((key) => [key, stringList(row[key], key)]),
  ) as Record<(typeof arrays)[number], string[]>;
  const count = Number(row.targetCompanyCount);
  if (!Number.isFinite(count) || count < 1)
    throw new Error("Strategy generation returned invalid targetCompanyCount.");
  return {
    id: null,
    version: 0,
    status: "ready",
    targetGeography: required(row.targetGeography, "targetGeography"),
    targetCompanyCount: Math.floor(count),
    ...result,
  };
}

function required(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2)
    throw new Error(`Strategy generation returned invalid ${field}.`);
  return value.trim();
}
function stringList(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Strategy generation returned invalid ${field}.`);
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}
