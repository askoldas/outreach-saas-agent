import { generateTextResult } from "../providers/openrouter.ts";

export const draftPromptVersion = "grounded-outreach-draft-v1";

export type DraftGenerationInput = {
  campaign: { name: string; objective: string; language: string };
  companyProfile: Record<string, unknown>;
  strategy: Record<string, unknown>;
  lead: {
    company: string;
    website: string;
    summary: string;
    evidence: Array<{ text: string; sourceUrl: string }>;
  };
  recipient: { route: string; role: string; verification: string };
};

export type GeneratedDraft = {
  subject: string;
  body: string;
  sellerClaims: string[];
  evidenceUsed: string[];
  warnings: string[];
};

export async function generateGroundedDraft(input: DraftGenerationInput) {
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content: [
          "You write concise, factual B2B outreach drafts.",
          "Use only seller claims present in companyProfile and prospect facts present in lead.evidence.",
          "Do not invent names, results, relationships, or private information.",
          "Return JSON only with subject, body, sellerClaims, evidenceUsed, warnings.",
          "sellerClaims and evidenceUsed must contain the exact supporting input statements used.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(input) },
    ],
    { role: "outreach_generation", taskName: "grounded outreach draft" },
  );
  const rawOutput = modelCall.data;
  return { draft: parseGeneratedDraft(rawOutput), rawOutput, modelCall };
}

export function parseGeneratedDraft(rawOutput: string): GeneratedDraft {
  const json = rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Draft generator returned invalid JSON.");
  }
  if (!value || typeof value !== "object") {
    throw new Error("Draft generator returned an invalid object.");
  }
  const row = value as Record<string, unknown>;
  const subject = requiredString(row.subject, "subject", 180);
  const body = requiredString(row.body, "body", 5000);
  return {
    subject,
    body,
    sellerClaims: stringArray(row.sellerClaims, "sellerClaims"),
    evidenceUsed: stringArray(row.evidenceUsed, "evidenceUsed"),
    warnings: stringArray(row.warnings, "warnings"),
  };
}

function requiredString(value: unknown, field: string, maximum: number) {
  if (typeof value !== "string" || value.trim().length < 2 || value.length > maximum) {
    throw new Error(`Draft generator returned invalid ${field}.`);
  }
  return value.trim();
}

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Draft generator returned invalid ${field}.`);
  }
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}
