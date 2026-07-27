import type {
  CandidateResearchPlan,
  CandidateResearchQuestion,
  ResearchPurpose,
  WebsitePageKind,
} from "./contracts.ts";

export type ResearchPlanInput = {
  organizationId: string;
  campaignCandidateId?: string;
  strategyVersionId?: string;
  requiredQuestionKeys: string[];
  optionalQuestionKeys?: string[];
  resolvedQuestionKeys?: string[];
  staleQuestionKeys?: string[];
  conflictQuestionKeys?: string[];
  procurementUnknown?: boolean;
  pageBudget?: number;
};

const QUESTION_CATALOG: Record<
  string,
  Omit<CandidateResearchQuestion, "id" | "key" | "required" | "priority">
> = {
  business_model: {
    question: "What business model and value-chain roles does the organization operate?",
    purpose: "business_model",
    reusableScope: "organization",
    expectedEvidenceTypes: ["official_web_page", "official_document"],
  },
  products_services: {
    question: "Which products and services does the organization currently offer?",
    purpose: "business_model",
    reusableScope: "organization",
    expectedEvidenceTypes: ["official_web_page", "official_document"],
  },
  operating_markets: {
    question: "In which markets and locations does the organization operate?",
    purpose: "identity",
    reusableScope: "organization",
    expectedEvidenceTypes: ["official_web_page", "legal_registry", "map_listing"],
  },
  ownership_structure: {
    question: "What parent, subsidiary, brand, or operating relationships are public?",
    purpose: "relationship",
    reusableScope: "organization",
    expectedEvidenceTypes: ["official_document", "legal_registry", "official_web_page"],
  },
  procurement_authority: {
    question: "Which organization appears to control procurement and with what autonomy?",
    purpose: "procurement",
    reusableScope: "organization",
    expectedEvidenceTypes: ["official_web_page", "job_posting", "official_document"],
  },
};

const PURPOSE_PAGES: Record<ResearchPurpose, WebsitePageKind[]> = {
  identity: ["home", "about", "locations", "legal", "contact"],
  business_model: ["home", "products_services", "about", "wholesale_b2b"],
  relationship: ["about", "brands_partners", "investor_relations", "legal"],
  procurement: ["supplier_procurement", "careers", "about", "contact"],
  freshness: ["news", "home", "products_services"],
  conflict_resolution: ["legal", "about", "contact"],
  eligibility: ["products_services", "about"],
  qualification_factor: ["products_services", "about", "news"],
  commercial_potential: ["products_services", "locations", "news"],
};

function buildQuestion(
  key: string,
  required: boolean,
  priority: number,
  purposeOverride?: ResearchPurpose,
): CandidateResearchQuestion {
  const catalog = QUESTION_CATALOG[key];
  return {
    id: `research:${key}`,
    key,
    question:
      catalog?.question ?? `Resolve the research question: ${key.replaceAll("_", " ")}.`,
    purpose: purposeOverride ?? catalog?.purpose ?? "qualification_factor",
    required,
    priority,
    reusableScope: catalog?.reusableScope ?? "campaign_only",
    expectedEvidenceTypes: catalog?.expectedEvidenceTypes ?? ["official_web_page"],
  };
}

export function compileCandidateResearchPlan(
  input: ResearchPlanInput,
): CandidateResearchPlan {
  const resolved = new Set(input.resolvedQuestionKeys ?? []);
  const questions = new Map<string, CandidateResearchQuestion>();
  input.requiredQuestionKeys
    .filter((key) => !resolved.has(key))
    .forEach((key, index) => questions.set(key, buildQuestion(key, true, 90 - index)));
  (input.optionalQuestionKeys ?? [])
    .filter((key) => !resolved.has(key) && !questions.has(key))
    .forEach((key, index) => questions.set(key, buildQuestion(key, false, 60 - index)));
  (input.staleQuestionKeys ?? []).forEach((key, index) =>
    questions.set(key, buildQuestion(key, true, 95 - index, "freshness")),
  );
  (input.conflictQuestionKeys ?? []).forEach((key, index) =>
    questions.set(key, buildQuestion(key, true, 100 - index, "conflict_resolution")),
  );
  if (input.procurementUnknown && !questions.has("procurement_authority")) {
    questions.set(
      "procurement_authority",
      buildQuestion("procurement_authority", false, 70),
    );
  }

  const ordered = [...questions.values()].sort(
    (left, right) =>
      Number(right.required) - Number(left.required) ||
      right.priority - left.priority ||
      left.key.localeCompare(right.key),
  );
  const preferredPages = [
    ...new Set(ordered.flatMap((question) => PURPOSE_PAGES[question.purpose])),
  ];
  const pageBudget = Math.max(1, Math.min(input.pageBudget ?? 8, 15));

  return {
    organizationId: input.organizationId,
    campaignCandidateId: input.campaignCandidateId,
    strategyVersionId: input.strategyVersionId,
    researchType: input.campaignCandidateId ? "campaign_specific" : "reusable",
    questions: ordered,
    preferredPages: preferredPages.slice(0, pageBudget),
    pageBudget,
    stopPolicy: {
      stopWhenRequiredQuestionsResolved: true,
      minimumEvidenceQuality: "strong",
      maximumPages: pageBudget,
      maximumRuntimeSeconds: 180,
    },
  };
}
