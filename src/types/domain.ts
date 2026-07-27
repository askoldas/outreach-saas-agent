export type CampaignStatus = "planning" | "running" | "paused" | "completed";
export type LeadStatus =
  | "needs_review"
  | "approved"
  | "rejected"
  | "draft_ready"
  | "researching"
  | "archived";
export type Confidence = "high" | "medium" | "low";
export type EvidenceKind = "fact" | "inference" | "unknown" | "conflict";
export type DraftStatus = "needs_review" | "approved" | "edited" | "rejected";
export type LeadQualificationStatus =
  | "pending"
  | "qualified"
  | "failed"
  | "needs_manual_review"
  | "non_ai_manual_review";
export type ContactDiscoveryStatus = "not_run" | "pending" | "completed";

export type DiscoveryReportResult = {
  query: string;
  title: string;
  url: string;
};

export type DiscoveryReportRejectedResult = DiscoveryReportResult & {
  reason: string;
};

export type DiscoveryReportAiFailure = {
  error: string;
  leadId: string;
};

export type ContactDiscoveryAttempt = {
  error: string;
  status: "failed" | "fetched" | "skipped";
  url: string;
};

export type ContactDiscoveryReport = {
  attempts: ContactDiscoveryAttempt[];
  leadId: string;
  routesFound: number;
};

export type DiscoveryReport = {
  aiQualificationFailures: DiscoveryReportAiFailure[];
  aiQualificationSuccesses: string[];
  contactDiscovery: ContactDiscoveryReport[];
  contactRoutesFound: number;
  duplicateResults: DiscoveryReportRejectedResult[];
  finalReviewableLeads: string[];
  generatedAt: string;
  leadsSavedBeforeAiQualification: string[];
  queriesExecuted: string[];
  rawTavilyResults: DiscoveryReportResult[];
  rejectedResults: DiscoveryReportRejectedResult[];
  targetSkippedResults: DiscoveryReportRejectedResult[];
};

export type DiscoveryProgress = {
  contactEnrichedCount: number;
  desiredLeadCount: number;
  leadCount: number;
  qualificationAttemptedCount: number;
  qualifiedCount: number;
};

export type ResearchProgress = {
  candidatesDiscovered?: number;
  candidatesUnique?: number;
  candidatesClassified?: number;
  companiesEvaluated?: number;
  companiesQualified?: number;
  currentIteration?: number;
  completedTasks: number;
  currentStep: string;
  failedTasks: number;
  lastError: string;
  progress: number;
  runId: string;
  status: "cancelled" | "completed" | "failed" | "pending" | "running";
  totalTasks: number;
};

export type Campaign = {
  id: string;
  name: string;
  objective: string;
  geography: string;
  industryTerms: string[];
  targetSegments: string[];
  progress: number;
  leadCount: number;
  desiredLeadCount: number;
  awaitingReview: number;
  status: CampaignStatus;
  lastActivity: string;
  preferredOutreachLanguage: string;
  discoveryLanguages: string[];
  warnings: string[];
  latestDiscoveryReport: DiscoveryReport | null;
  strategyVersion?: number;
  strategy: {
    terms: string[];
    localizedTerms: string[];
    sources: string[];
    criteria: string[];
    exclusions: string[];
    limitations: string[];
  };
};

export type QualificationDimension = {
  label: string;
  score: number;
  confidence: Confidence;
  explanation: string;
};

export type EvidenceClaim = {
  id: string;
  kind: EvidenceKind;
  text: string;
  sourceType: string;
  sourceLabel: string;
  sourceUrl: string;
  retrievedAt: string;
  confidence: Confidence;
};

export type ContactRoute = {
  id?: string;
  type: string;
  value: string;
  suggestedRole: string;
  verification: "source_confirmed" | "unverified" | "unknown";
  source: string;
  verificationProvenance?: {
    provider: string;
    query: string;
    sourceTitle: string;
    sourceUrl: string;
    verifiedAt: string;
  } | null;
};

export type Lead = {
  id: string;
  company: string;
  website: string;
  country: string;
  city: string;
  campaignId: string;
  companyType: string;
  industry: string;
  estimatedSize: string;
  description: string;
  fitScore: number;
  confidence: Confidence;
  contactability: Confidence;
  contactDiscoveryStatus: ContactDiscoveryStatus;
  qualificationError: string;
  qualificationStatus: LeadQualificationStatus;
  status: LeadStatus;
  summary: string;
  qualification: QualificationDimension[];
  evidence: EvidenceClaim[];
  contacts: ContactRoute[];
};

export type OutreachDraft = {
  id: string;
  leadId: string;
  campaignId: string;
  recipientRoute: string;
  subject: string;
  body: string;
  variant: "primary" | "short" | "follow_up";
  language: string;
  status: DraftStatus;
  lastEdited: string;
  sellerClaims: string[];
  evidenceUsed: string[];
  warnings: string[];
  promptVersion?: string | null;
  generatedAt?: string | null;
};

export type ActivityItem = {
  id: string;
  time: string;
  label: string;
  description: string;
};

export type ReviewState = "ready" | "approved" | "rejected" | "excluded" | "issues";
export type FitLabel = "Strong fit" | "Good fit" | "Possible fit" | "Weak fit";
export type StrategyState = "draft" | "ready" | "used" | "superseded";
export type CampaignStrategyVersion = {
  id: string | null;
  version: number;
  status: StrategyState;
  targetGeography: string;
  companyTypes: string[];
  industries: string[];
  characteristics: string[];
  relevanceReasons: string[];
  opportunityAssumptions: string[];
  qualificationCriteria: string[];
  positiveSignals: string[];
  exclusions: string[];
  contactRoles: string[];
  contactDepartments: string[];
  acceptableContactRoutes: string[];
  searchLanguages: string[];
  sourceCategories: string[];
  searchTerms: string[];
  localizedTerms: string[];
  limitations: string[];
  targetCompanyCount: number;
  refinementSummary: string[];
};
export type EnrichmentState =
  | "not_started"
  | "queued"
  | "in_progress"
  | "contacts_ready"
  | "not_found"
  | "issue";
export type RecipientType =
  | "named_person"
  | "department"
  | "sales"
  | "general"
  | "form"
  | "none";

export type CompanyProfile = {
  id: string | null;
  version: number;
  companyName: string;
  website: string | null;
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
  lastAnalyzed: string | null;
  provenance: "workspace" | "legacy_offer" | "manual" | "website_analysis";
  structuredProfile: StructuredCompanyProfile | null;
  extractedFacts: ExtractedProfileFact[];
  reviewQuestions: ReviewQuestion[];
  profileStatus: "draft" | "needs_input" | "ready" | "published";
  readinessScore: number;
};

export type RecommendedRecipient = {
  leadId: string;
  contactRouteId: string | null;
  company: string;
  name: string;
  role: string;
  route: string;
  type: RecipientType;
  verification: "verified" | "source_confirmed" | "unverified";
  reason: string;
};

export type ExportRecord = {
  id: string;
  campaignId: string;
  type: "outreach_csv" | "lead_research_csv";
  fileName: string;
  rowCount: number;
  createdAt: string;
  creator: string;
};
export type UsageEvent = {
  id: string;
  campaignId: string | null;
  operation: string;
  estimatedCredits: number;
  actualCredits: number;
  createdAt: string;
};
import type {
  ExtractedProfileFact,
  ReviewQuestion,
  StructuredCompanyProfile,
} from "@/lib/company-profile/structured-profile";
