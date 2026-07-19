import { generateText } from "../providers/openrouter.ts";

export const companyProfileAnalysisPromptVersion = "company-profile-website-v1";

export type AnalyzedCompanyProfile = {
  companyName: string;
  website: string;
  summary: string;
  productsAndServices: string[];
  capabilities: string[];
  customerTypes: string[];
  differentiators: string[];
  proofPoints: string[];
  marketsAndLanguages: string[];
  claims: string[];
  limitations: string[];
  sources: string[];
  warnings: string[];
};

export async function analyzeCompanyProfile(input: {
  currentProfile: Record<string, unknown>;
  sources: Array<{ title: string; url: string; content: string }>;
}) {
  const rawOutput = await generateText(
    [
      {
        role: "system",
        content:
          "Extract reusable seller knowledge from supplied public website evidence. Return JSON only. Do not invent claims, customers, metrics, certifications, or capabilities. Put uncertain or missing information in warnings.",
      },
      {
        role: "user",
        content: JSON.stringify({
          ...input,
          outputSchema: {
            companyName: "string",
            website: "string",
            summary: "string",
            productsAndServices: ["string"],
            capabilities: ["string"],
            customerTypes: ["string"],
            differentiators: ["string"],
            proofPoints: ["string"],
            marketsAndLanguages: ["string"],
            claims: ["string"],
            limitations: ["string"],
            sources: ["source URL actually used"],
            warnings: ["string"],
          },
        }),
      },
    ],
    { taskName: "company profile website analysis" },
  );
  return { profile: parseCompanyProfileAnalysis(rawOutput), rawOutput };
}

export function parseCompanyProfileAnalysis(rawOutput: string): AnalyzedCompanyProfile {
  const json = rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Company Profile analysis returned invalid JSON.");
  }
  if (!parsed || typeof parsed !== "object")
    throw new Error("Company Profile analysis returned an invalid object.");
  const row = parsed as Record<string, unknown>;
  return {
    companyName: required(row.companyName, "companyName"),
    website: required(row.website, "website"),
    summary: required(row.summary, "summary"),
    productsAndServices: list(row.productsAndServices, "productsAndServices"),
    capabilities: list(row.capabilities, "capabilities"),
    customerTypes: list(row.customerTypes, "customerTypes"),
    differentiators: list(row.differentiators, "differentiators"),
    proofPoints: list(row.proofPoints, "proofPoints"),
    marketsAndLanguages: list(row.marketsAndLanguages, "marketsAndLanguages"),
    claims: list(row.claims, "claims"),
    limitations: list(row.limitations, "limitations"),
    sources: list(row.sources, "sources"),
    warnings: list(row.warnings, "warnings"),
  };
}

function required(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 2)
    throw new Error(`Company Profile analysis returned invalid ${field}.`);
  return value.trim().slice(0, 5000);
}
function list(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`Company Profile analysis returned invalid ${field}.`);
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}
