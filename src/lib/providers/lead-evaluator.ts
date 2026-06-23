import type { Campaign, Confidence } from "@/types/domain";
import { generateText } from "./openrouter";
import type { SearchResult } from "./tavily";

type RawEvaluatedLead = {
  companyName?: unknown;
  companyType?: unknown;
  confidence?: unknown;
  fitScore?: unknown;
  industry?: unknown;
  reason?: unknown;
  summary?: unknown;
  url?: unknown;
};

type RawEvaluationResponse = {
  leads?: RawEvaluatedLead[];
};

export type EvaluatedLeadCandidate = {
  companyName: string;
  companyType: string;
  confidence: Confidence;
  fitScore: number;
  industry: string;
  reason: string;
  result: SearchResult;
  summary: string;
};

export async function evaluateLeadCandidate(
  campaign: Campaign,
  result: SearchResult,
): Promise<EvaluatedLeadCandidate | null> {
  const parsed = await generateAndParseEvaluation(campaign, result);
  const resultByUrl = new Map([[result.url, result]]);

  return (
    (parsed.leads ?? [])
      .map((lead) => mapEvaluatedLead(lead, resultByUrl, result))
      .filter((lead): lead is EvaluatedLeadCandidate => Boolean(lead))
      .sort((first, second) => second.fitScore - first.fitScore)[0] ?? null
  );
}

async function generateAndParseEvaluation(campaign: Campaign, result: SearchResult) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const content = await generateText(buildEvaluationMessages(campaign, result, attempt), {
        taskName: "lead qualification",
      });

      return parseEvaluation(content);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI lead qualification failed.");
}

function buildEvaluationMessages(campaign: Campaign, result: SearchResult, attempt: number) {
  return [
    {
      role: "system" as const,
      content: [
        "You qualify B2B prospecting search results.",
        "Return JSON only. Do not include markdown.",
        "Keep actual operating companies that plausibly match the campaign.",
        "Reject only when the result is clearly not a company candidate.",
        "Prefer official company websites over third-party pages.",
        attempt > 1
          ? 'The previous response was not valid JSON. Return exactly {"leads":[...]} with no prose.'
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        campaign: {
          geography: campaign.geography,
          industryTerms: campaign.industryTerms,
          objective: campaign.objective,
          qualificationCriteria: campaign.strategy.criteria,
          searchTerms: campaign.strategy.terms,
          targetSegments: campaign.targetSegments,
        },
        outputSchema: {
          leads: [
            {
              companyName: "string",
              companyType: "string",
              confidence: "high | medium | low",
              fitScore: "integer 0-100",
              industry: "string",
              reason: "short reason this is a real relevant lead",
              summary: "short company summary based only on the search result",
              url: "must exactly match one input result url",
            },
          ],
        },
        result: {
          content: result.content,
          score: result.score,
          title: result.title,
          url: result.url,
        },
      }),
    },
  ];
}

function mapEvaluatedLead(
  lead: RawEvaluatedLead,
  resultByUrl: Map<string, SearchResult>,
  fallbackResult: SearchResult,
): EvaluatedLeadCandidate | null {
  const url = getString(lead.url);
  const result = resultByUrl.get(url) ?? fallbackResult;

  const companyName = getString(lead.companyName);
  const summary = getString(lead.summary);

  if (!companyName || !summary) {
    return null;
  }

  return {
    companyName,
    companyType: getString(lead.companyType) || "Company",
    confidence: getConfidence(lead.confidence),
    fitScore: clampScore(lead.fitScore),
    industry: getString(lead.industry) || "Unknown",
    reason: getString(lead.reason) || "AI qualified this as a relevant company.",
    result,
    summary,
  };
}

function parseEvaluation(content: string): RawEvaluationResponse {
  const json = content.match(/\{[\s\S]*\}/)?.[0] ?? content.match(/\[[\s\S]*\]/)?.[0] ?? content;

  try {
    const parsed = JSON.parse(json) as RawEvaluationResponse | RawEvaluatedLead[];

    if (Array.isArray(parsed)) {
      return { leads: parsed };
    }

    if (Array.isArray(parsed.leads)) {
      return parsed;
    }

    if ("companyName" in parsed || "summary" in parsed) {
      return { leads: [parsed as RawEvaluatedLead] };
    }

    return { leads: [] };
  } catch {
    throw new Error(
      "OpenRouter did not return the required JSON lead evaluation. The selected model may not support reliable structured output for this prompt; choose another OPENROUTER_MODEL or retry with a stronger model.",
    );
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getConfidence(value: unknown): Confidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function clampScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
