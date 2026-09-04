export type CandidateEvidenceType =
  | "official_web_page"
  | "official_document"
  | "legal_registry"
  | "company_database"
  | "directory_profile"
  | "news_article"
  | "job_posting"
  | "social_company_profile"
  | "map_listing"
  | "marketplace_profile"
  | "user_input"
  | "system_observation";

export type ResearchPurpose =
  | "identity"
  | "business_model"
  | "relationship"
  | "eligibility"
  | "qualification_factor"
  | "commercial_potential"
  | "procurement"
  | "freshness"
  | "conflict_resolution";

export type ResearchScope = "organization" | "offering_context" | "campaign_only";

export type CandidateResearchQuestion = {
  id: string;
  key: string;
  question: string;
  purpose: ResearchPurpose;
  required: boolean;
  priority: number;
  reusableScope: ResearchScope;
  expectedEvidenceTypes: CandidateEvidenceType[];
};

export type CandidateResearchPlan = {
  organizationId: string;
  campaignCandidateId?: string;
  strategyVersionId?: string;
  researchType: "reusable" | "campaign_specific";
  researchBlueprintVersionIds?: string[];
  questions: CandidateResearchQuestion[];
  preferredPages: WebsitePageKind[];
  pageBudget: number;
  stopPolicy: {
    stopWhenRequiredQuestionsResolved: boolean;
    minimumEvidenceQuality: "authoritative" | "strong" | "supporting";
    maximumPages: number;
    maximumRuntimeSeconds: number;
  };
};

export type WebsitePageKind =
  | "home"
  | "about"
  | "products_services"
  | "brands_partners"
  | "locations"
  | "legal"
  | "supplier_procurement"
  | "careers"
  | "investor_relations"
  | "news"
  | "contact"
  | "wholesale_b2b";

export type CandidateClaimInput = {
  key: string;
  fieldPath: string;
  statement: string;
  value: unknown;
  status:
    | "confirmed_fact"
    | "evidence_backed_inference"
    | "hypothesis"
    | "unknown"
    | "conflicting";
  confidence: number;
  evidenceIds: string[];
  observedAt?: string;
  freshnessClass: FreshnessClass;
  sourceScope: "system_public" | "workspace_private";
};

export type FreshnessClass = "stable" | "slow_changing" | "dynamic" | "volatile";
export type FreshnessState = "current" | "acceptable" | "stale" | "unknown";

export type CandidateIntelligenceSnapshot = {
  organizationId: string;
  versionNumber: number;
  sourceCutoffAt: string;
  claims: CandidateClaimInput[];
  unresolvedQuestionKeys: string[];
  conflictKeys: string[];
};
