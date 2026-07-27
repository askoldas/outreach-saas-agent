import { generateTextResult, type AiCallResult } from "../providers/openrouter.ts";

export const candidateClassificationPromptVersion = "search-result-classification-v2";

export type CandidateClassificationStatus =
  | "promising"
  | "possible"
  | "unlikely"
  | "excluded"
  | "duplicate"
  | "insufficient_data";

export type CandidateClassification = {
  candidateKey: string;
  status: CandidateClassificationStatus;
  confidence: number;
  probableCategory?: string;
  geographyMatch: boolean | null;
  exclusionReason?: string;
  reasons: string[];
  shouldEvaluate: boolean;
};

export async function classifyCandidatesWithAi(input: {
  campaign: {
    geography: string;
    companyTypes: string[];
    industries: string[];
    characteristics: string[];
    exclusions: string[];
  };
  candidates: Array<{
    candidateKey: string;
    title: string;
    url: string;
    snippet: string;
    deterministicSourceType: string;
  }>;
}): Promise<{
  classifications: CandidateClassification[];
  modelCall: AiCallResult<string>;
  promptInput: Record<string, unknown>;
}> {
  if (!input.candidates.length) {
    throw new Error("Candidate classification requires at least one candidate.");
  }
  const candidates = input.candidates.slice(0, 100).map((candidate, index) => ({
    ...candidate,
    candidateKey: `candidate_${String(index + 1).padStart(3, "0")}`,
    originalCandidateKey: candidate.candidateKey,
  }));
  const originalKeyByAlias = new Map(
    candidates.map((candidate) => [
      candidate.candidateKey,
      candidate.originalCandidateKey,
    ]),
  );
  const promptInput = {
    promptVersion: candidateClassificationPromptVersion,
    campaign: input.campaign,
    candidates: candidates.map((candidate) => ({
      candidateKey: candidate.candidateKey,
      title: candidate.title,
      url: candidate.url,
      snippet: candidate.snippet,
      deterministicSourceType: candidate.deterministicSourceType,
    })),
    requiredOutput: {
      classifications: [
        {
          candidateKey: "exact supplied key",
          status: "promising|possible|unlikely|excluded|duplicate|insufficient_data",
          confidence: 0.8,
          probableCategory: "short category",
          geographyMatch: true,
          exclusionReason: "",
          reasons: ["concise visible rationale"],
          shouldEvaluate: true,
        },
      ],
    },
  };
  const modelCall = await generateTextResult(
    [
      {
        role: "system",
        content:
          "Classify public search-result candidates cheaply before deep website evaluation. Use only supplied snippets and campaign criteria. Never invent company facts. Mark geography as null when unknown. Obvious exclusions must not be evaluated. Use possible when evidence is incomplete but plausibly relevant. Return exactly one result for every supplied candidateKey and JSON only.",
      },
      { role: "user", content: JSON.stringify(promptInput) },
    ],
    {
      role: "search_result_classification",
      taskName: "search result candidate classification",
      jsonMode: true,
      maxCompletionTokens: 5_000,
      reasoningEffort: "minimal",
    },
  );
  const classifications = parseCandidateClassificationBatch(
    modelCall.data,
    new Set(candidates.map((candidate) => candidate.candidateKey)),
  ).map((classification) => ({
    ...classification,
    candidateKey:
      originalKeyByAlias.get(classification.candidateKey) ?? classification.candidateKey,
  }));
  return {
    classifications,
    modelCall,
    promptInput,
  };
}

export function parseCandidateClassificationBatch(
  raw: string | unknown,
  expectedKeys: ReadonlySet<string>,
): CandidateClassification[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(
        raw
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, ""),
      );
    } catch {
      throw new Error("Candidate classification returned invalid JSON.");
    }
  }
  const root = record(value, "classification response");
  if (!Array.isArray(root.classifications)) {
    throw new Error("Candidate classification returned no classifications.");
  }
  if (root.classifications.length !== expectedKeys.size) {
    throw new Error("Candidate classification did not return every candidate.");
  }
  const seen = new Set<string>();
  const allowed = new Set<CandidateClassificationStatus>([
    "promising",
    "possible",
    "unlikely",
    "excluded",
    "duplicate",
    "insufficient_data",
  ]);
  const classifications = root.classifications.map((value, index) => {
    const row = record(value, `classifications.${index}`);
    const candidateKey = text(row.candidateKey, "candidateKey");
    if (!expectedKeys.has(candidateKey) || seen.has(candidateKey)) {
      throw new Error("Candidate classification returned an unknown or duplicate key.");
    }
    seen.add(candidateKey);
    const status = text(row.status, "status") as CandidateClassificationStatus;
    if (!allowed.has(status)) {
      throw new Error("Candidate classification returned an invalid status.");
    }
    const confidence = bounded(row.confidence, 0, 1);
    const shouldEvaluate =
      row.shouldEvaluate === true &&
      (status === "promising" || (status === "possible" && confidence >= 0.65));
    return {
      candidateKey,
      status,
      confidence,
      ...(optionalText(row.probableCategory)
        ? { probableCategory: optionalText(row.probableCategory) }
        : {}),
      geographyMatch: typeof row.geographyMatch === "boolean" ? row.geographyMatch : null,
      ...(optionalText(row.exclusionReason)
        ? { exclusionReason: optionalText(row.exclusionReason) }
        : {}),
      reasons: stringList(row.reasons, "reasons"),
      shouldEvaluate,
    };
  });
  return classifications;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Candidate classification returned invalid ${field}.`);
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Candidate classification returned invalid ${field}.`);
  }
  return value.trim();
}
function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function stringList(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Candidate classification returned invalid ${field}.`);
  }
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}
function bounded(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error("Candidate classification returned invalid confidence.");
  }
  return parsed;
}
