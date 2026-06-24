import type { Campaign, Confidence, Offer } from "../../types/domain.ts";
import { generateText } from "../providers/openrouter.ts";

export const LEAD_EVALUATOR_PROMPT_VERSION = "lead-evaluator-v1";

export type LeadEvaluationInput = {
  campaign: Pick<
    Campaign,
    | "geography"
    | "industryTerms"
    | "language"
    | "objective"
    | "targetSegments"
  > & {
    strategy: Pick<Campaign["strategy"], "criteria" | "exclusions" | "terms">;
  };
  offer: Pick<
    Offer,
    | "buyerTypes"
    | "capabilities"
    | "differentiators"
    | "keywords"
    | "limitations"
    | "name"
    | "problems"
    | "summary"
    | "type"
  > | null;
  source: {
    classification: string;
    content: string;
    query: string;
    rejectionReason: string | null;
    title: string;
    url: string;
  };
};

export type LeadEvaluation = {
  city: string | null;
  companyName: string | null;
  companyType: string | null;
  confidence: Confidence;
  contactability: Confidence;
  country: string | null;
  disqualifyingSignals: string[];
  fitReasons: string[];
  industry: string | null;
  missingInfo: string[];
  qualificationStatus: "disqualified" | "needs_review" | "qualified";
  relevanceScore: number;
  suggestedNextAction: string;
  summary: string;
  website: string | null;
};

export async function evaluateLeadSourceWithAi(input: LeadEvaluationInput) {
  const promptInput = buildPromptInput(input);
  const content = await generateText(buildMessages(promptInput), {
    taskName: "lead evaluation",
  });

  return {
    evaluation: parseLeadEvaluation(content),
    promptInput,
    promptVersion: LEAD_EVALUATOR_PROMPT_VERSION,
    rawOutput: content,
  };
}

function buildMessages(promptInput: unknown) {
  return [
    {
      role: "system" as const,
      content: [
        "You evaluate B2B lead candidates for a prospecting campaign.",
        "Return strict JSON only. Do not include markdown or prose.",
        "Use only supplied source evidence. Do not invent emails, people, private data, or facts.",
        "Be conservative. Weak evidence means low or medium confidence.",
        "Ambiguous companies should be needs_review. Irrelevant entities should be disqualified.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        input: promptInput,
        outputSchema: {
          city: "string|null",
          companyName: "string|null",
          companyType: "string|null",
          confidence: "low|medium|high",
          contactability: "low|medium|high",
          country: "string|null",
          disqualifyingSignals: ["string"],
          fitReasons: ["string"],
          industry: "string|null",
          missingInfo: ["string"],
          qualificationStatus: "qualified|needs_review|disqualified",
          relevanceScore: "integer 0-100",
          suggestedNextAction: "string",
          summary: "string",
          website: "string|null",
        },
      }),
    },
  ];
}

function buildPromptInput(input: LeadEvaluationInput) {
  return {
    campaign: input.campaign,
    instructions: [
      "Assess whether this source represents a real company or organization worth reviewing as a lead.",
      "A qualified lead should match the campaign objective, geography, and likely buyer/partner profile.",
      "Needs_review is appropriate when source evidence is partial but plausibly relevant.",
      "Disqualified is appropriate for directories, news, marketplaces, job pages, regulators, or irrelevant entities.",
    ],
    offer: input.offer,
    source: input.source,
  };
}

function parseLeadEvaluation(content: string): LeadEvaluation {
  const json = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Lead evaluation AI output was not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Lead evaluation AI output was not an object.");
  }

  const record = parsed as Record<string, unknown>;
  const evaluation: LeadEvaluation = {
    city: nullableString(record.city),
    companyName: nullableString(record.companyName),
    companyType: nullableString(record.companyType),
    confidence: confidence(record.confidence),
    contactability: confidence(record.contactability),
    country: nullableString(record.country),
    disqualifyingSignals: stringArray(record.disqualifyingSignals).slice(0, 6),
    fitReasons: stringArray(record.fitReasons).slice(0, 6),
    industry: nullableString(record.industry),
    missingInfo: stringArray(record.missingInfo).slice(0, 6),
    qualificationStatus: qualificationStatus(record.qualificationStatus),
    relevanceScore: score(record.relevanceScore),
    suggestedNextAction:
      stringValue(record.suggestedNextAction) || "Review the lead manually.",
    summary: stringValue(record.summary),
    website: nullableString(record.website),
  };

  if (!evaluation.summary) {
    throw new Error("Lead evaluation missing summary.");
  }

  if (
    evaluation.qualificationStatus !== "disqualified" &&
    (!evaluation.companyName || !evaluation.website)
  ) {
    throw new Error("Relevant lead evaluation missing companyName or website.");
  }

  return evaluation;
}

function confidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function qualificationStatus(value: unknown): LeadEvaluation["qualificationStatus"] {
  return value === "qualified" || value === "needs_review" || value === "disqualified"
    ? value
    : "needs_review";
}

function score(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
